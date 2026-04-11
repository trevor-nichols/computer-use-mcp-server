import * as http from 'node:http'
import { randomUUID } from 'node:crypto'
import type { RuntimeConfig } from '../config.js'
import type { Logger } from '../observability/logger.js'
import type { SessionStore } from '../session/sessionStore.js'
import type { CaptureAssetStore } from '../assets/captureAssetStore.js'
import { BaseClientConnection, type TransportAdapter } from './transport.js'
import {
  failure,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  readJsonRpcId,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './jsonRpc.js'
import type { ComputerUseMcpServer } from './server.js'
import { NotificationRejectedError } from './protocolErrors.js'

type HttpIncomingMessage = InstanceType<typeof http.IncomingMessage>
type HttpServerResponse = InstanceType<typeof http.ServerResponse>

const SESSION_HEADER = 'mcp-session-id'
const PROTOCOL_HEADER = 'mcp-protocol-version'
const ALLOW_HEADER_VALUE = 'GET, POST, DELETE'

class HttpSessionConnection extends BaseClientConnection {
  private sse?: HttpServerResponse
  private readonly queue: string[] = []

  constructor(private readonly logger: Logger, sessionId: string) {
    super(`http-connection:${randomUUID()}`, 'streamable-http', sessionId)
  }

  attachSse(response: HttpServerResponse): void {
    if (this.sse && !this.sse.writableEnded) {
      this.sse.end()
    }
    this.sse = response
    this.flushQueue()
  }

  detachSse(response?: HttpServerResponse): void {
    if (!response || this.sse === response) {
      this.sse = undefined
    }
  }

  protected async sendOutbound(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    const payload = `event: message\ndata: ${JSON.stringify(message)}\n\n`
    if (this.sse && !this.sse.writableEnded) {
      this.sse.write(payload)
      return
    }
    this.queue.push(payload)
    this.logger.warn('queued outbound HTTP transport message until SSE stream is attached', {
      sessionId: this.metadata.sessionId,
      method: message.method,
    })
  }

  protected async closeTransport(): Promise<void> {
    if (this.sse && !this.sse.writableEnded) {
      this.sse.end()
    }
    this.sse = undefined
  }

  private flushQueue(): void {
    if (!this.sse || this.sse.writableEnded) return
    while (this.queue.length > 0) {
      this.sse.write(this.queue.shift()!)
    }
  }
}

export class StreamableHttpTransport implements TransportAdapter {
  readonly name = 'streamable-http'
  private server?: ReturnType<typeof http.createServer>
  private readonly connections = new Map<string, HttpSessionConnection>()
  private cleanupTimer?: ReturnType<typeof setInterval>

  constructor(
    private readonly mcpServer: ComputerUseMcpServer,
    private readonly runtimeConfig: RuntimeConfig,
    private readonly sessionStore: SessionStore,
    private readonly captureAssetStore: CaptureAssetStore,
    private readonly logger: Logger,
  ) {}

  get port(): number | undefined {
    const address = this.server?.address()
    if (address && typeof address === 'object') {
      return address.port
    }
    return undefined
  }

  async start(): Promise<void> {
    if (this.server) return

    this.server = http.createServer((req: HttpIncomingMessage, res: HttpServerResponse) => {
      void this.handleRequest(req, res)
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(this.runtimeConfig.streamableHttpPort, this.runtimeConfig.streamableHttpBindHost, () => {
        this.server!.off('error', reject)
        resolve()
      })
    })

    this.cleanupTimer = setInterval(() => {
      const removed = this.sessionStore.cleanupStaleOlderThan(this.runtimeConfig.sessionTtlMs)
      for (const sessionId of removed) {
        const connection = this.connections.get(sessionId)
        if (connection) {
          void connection.close()
          this.connections.delete(sessionId)
        }
        void this.captureAssetStore.deleteSessionAssets(sessionId).catch(error => {
          this.logger.warn('failed to delete capture assets for stale session', {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          })
        })
      }
    }, 60_000)

    this.logger.info('streamable HTTP transport listening', {
      host: this.runtimeConfig.streamableHttpBindHost,
      port: this.runtimeConfig.streamableHttpPort,
    })
  }

  async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    for (const connection of this.connections.values()) {
      await connection.close()
    }
    this.connections.clear()

    if (!this.server) return
    await new Promise<void>((resolve, reject) => {
      this.server!.close((error?: Error) => (error ? reject(error) : resolve()))
    })
    this.server = undefined
  }

  private async handleRequest(req: HttpIncomingMessage, res: HttpServerResponse): Promise<void> {
    if ((req.url ?? '').split('?')[0] !== '/mcp') {
      res.statusCode = 404
      res.end('Not Found')
      return
    }

    if (!this.isOriginAllowed(req)) {
      this.writeJsonRpcHttpError(res, 403, failure(undefined, -32003, 'Forbidden origin'))
      return
    }

    switch (req.method) {
      case 'GET':
        this.handleGet(req, res)
        return
      case 'DELETE':
        await this.handleDelete(req, res)
        return
      case 'POST':
        await this.handlePost(req, res)
        return
      default:
        res.statusCode = 405
        res.setHeader('allow', ALLOW_HEADER_VALUE)
        res.end('Method Not Allowed')
    }
  }

  private async handlePost(req: HttpIncomingMessage, res: HttpServerResponse): Promise<void> {
    if (!accepts(req, ['application/json', 'text/event-stream'])) {
      res.statusCode = 406
      res.end('Accept header must include application/json and text/event-stream.')
      return
    }

    const body = await readBody(req)
    let payload: unknown
    try {
      payload = JSON.parse(body || '{}')
    } catch {
      this.writeJsonRpcHttpError(res, 400, failure(undefined, -32700, 'Parse error'))
      return
    }

    if (Array.isArray(payload)) {
      this.writeJsonRpcHttpError(res, 400, failure(undefined, -32600, 'JSON-RPC batches are not supported.'))
      return
    }

    if (isJsonRpcResponse(payload)) {
      await this.handleInboundResponse(req, res, payload)
      return
    }

    if (isJsonRpcNotification(payload)) {
      await this.handleInboundNotification(req, res, payload)
      return
    }

    if (isJsonRpcRequest(payload)) {
      await this.handleInboundRequest(req, res, payload)
      return
    }

    this.writeJsonRpcHttpError(res, 400, failure(readJsonRpcId(payload), -32600, 'Invalid Request'))
  }

  private handleGet(req: HttpIncomingMessage, res: HttpServerResponse): void {
    if (!accepts(req, ['text/event-stream'])) {
      res.statusCode = 406
      res.end('Accept header must include text/event-stream.')
      return
    }

    const sessionId = header(req, SESSION_HEADER)
    if (!sessionId) {
      res.statusCode = 400
      res.end('Missing MCP-Session-Id header')
      return
    }

    const connection = this.connections.get(sessionId)
    if (!connection) {
      res.statusCode = 404
      res.end('Unknown session')
      return
    }

    const protocolVersion = this.resolveProtocolVersionForSessionRequest(req, connection, res)
    if (!protocolVersion) {
      return
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      [PROTOCOL_HEADER]: protocolVersion,
      [SESSION_HEADER]: sessionId,
    })

    res.write(`id: ${randomUUID()}\ndata:\n\n`)
    connection.attachSse(res)
    req.on('close', () => {
      connection.detachSse(res)
    })
  }

  private async handleDelete(req: HttpIncomingMessage, res: HttpServerResponse): Promise<void> {
    const sessionId = header(req, SESSION_HEADER)
    if (!sessionId) {
      res.statusCode = 400
      res.end('Missing MCP-Session-Id header')
      return
    }

    const connection = this.connections.get(sessionId)
    if (!connection) {
      res.statusCode = 404
      res.end('Unknown session')
      return
    }

    if (!this.resolveProtocolVersionForSessionRequest(req, connection, res)) {
      return
    }

    await connection.close()
    this.connections.delete(sessionId)
    this.sessionStore.delete(sessionId)
    await this.captureAssetStore.deleteSessionAssets(sessionId)
    res.statusCode = 204
    res.end()
  }

  private async handleInboundResponse(req: HttpIncomingMessage, res: HttpServerResponse, message: JsonRpcResponse): Promise<void> {
    const connection = this.resolveConnectionForExistingSession(req, res, undefined)
    if (!connection) {
      return
    }

    if (!this.resolveProtocolVersionForSessionRequest(req, connection, res)) {
      return
    }

    connection.handleJsonRpcResponse(message)
    res.statusCode = 202
    res.end()
  }

  private async handleInboundNotification(req: HttpIncomingMessage, res: HttpServerResponse, message: JsonRpcNotification): Promise<void> {
    const connection = this.resolveConnectionForIncomingMessage(req, res, message.method)
    if (!connection) {
      return
    }

    if (message.method !== 'initialize' && !this.resolveProtocolVersionForSessionRequest(req, connection, res)) {
      return
    }

    try {
      await this.mcpServer.handleNotification(message, connection)
      res.statusCode = 202
      res.end()
    } catch (error) {
      if (error instanceof NotificationRejectedError) {
        this.writeJsonRpcHttpError(res, error.httpStatus, failure(undefined, error.jsonRpcCode, error.message, error.data))
        return
      }
      throw error
    }
  }

  private async handleInboundRequest(req: HttpIncomingMessage, res: HttpServerResponse, message: JsonRpcRequest): Promise<void> {
    if (message.method === 'initialize') {
      const connection = new HttpSessionConnection(this.logger, randomUUID())
      const response = await this.mcpServer.handleRequest(message, connection)
      const negotiatedProtocolVersion = connection.protocolState.negotiatedProtocolVersion ?? this.runtimeConfig.protocolVersion

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.setHeader(PROTOCOL_HEADER, negotiatedProtocolVersion)

      if (!response.error) {
        this.connections.set(connection.metadata.sessionId, connection)
        res.setHeader(SESSION_HEADER, connection.metadata.sessionId)
      }

      res.end(JSON.stringify(response))
      return
    }

    const connection = this.resolveConnectionForExistingSession(req, res, message.id)
    if (!connection) {
      return
    }

    if (!this.resolveProtocolVersionForSessionRequest(req, connection, res, message.id)) {
      return
    }

    const response = await this.mcpServer.handleRequest(message, connection)
    const negotiatedProtocolVersion = connection.protocolState.negotiatedProtocolVersion ?? this.runtimeConfig.protocolVersion

    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.setHeader(PROTOCOL_HEADER, negotiatedProtocolVersion)
    res.setHeader(SESSION_HEADER, connection.metadata.sessionId)
    res.end(JSON.stringify(response))
  }

  private resolveConnectionForIncomingMessage(
    req: HttpIncomingMessage,
    res: HttpServerResponse,
    method: string,
  ): HttpSessionConnection | undefined {
    if (method === 'initialize') {
      this.writeJsonRpcHttpError(res, 400, failure(undefined, -32600, 'initialize must be sent as a request.'))
      return undefined
    }

    return this.resolveConnectionForExistingSession(req, res, undefined)
  }

  private resolveConnectionForExistingSession(
    req: HttpIncomingMessage,
    res: HttpServerResponse,
    requestId: string | number | undefined,
  ): HttpSessionConnection | undefined {
    const sessionIdHeader = header(req, SESSION_HEADER)
    if (!sessionIdHeader) {
      this.writeJsonRpcHttpError(res, 400, failure(requestId, -32600, 'Missing MCP-Session-Id header'))
      return undefined
    }

    const connection = this.connections.get(sessionIdHeader)
    if (!connection) {
      this.writeJsonRpcHttpError(res, 404, failure(requestId, -32600, 'Unknown MCP session'))
      return undefined
    }

    return connection
  }

  private resolveProtocolVersionForSessionRequest(
    req: HttpIncomingMessage,
    connection: HttpSessionConnection,
    res: HttpServerResponse,
    requestId: string | number | undefined = undefined,
  ): string | undefined {
    const requested = header(req, PROTOCOL_HEADER)
    const negotiated = connection.protocolState.negotiatedProtocolVersion ?? this.runtimeConfig.protocolVersion

    if (!requested) {
      return negotiated
    }

    if (!this.runtimeConfig.supportedProtocolVersions.includes(requested)) {
      this.writeJsonRpcHttpError(res, 400, failure(requestId, -32600, `Unsupported MCP-Protocol-Version: ${requested}`))
      return undefined
    }

    if (requested !== negotiated) {
      this.writeJsonRpcHttpError(
        res,
        400,
        failure(requestId, -32600, `MCP-Protocol-Version ${requested} does not match negotiated session version ${negotiated}.`),
      )
      return undefined
    }

    return requested
  }

  private isOriginAllowed(req: HttpIncomingMessage): boolean {
    if (!this.runtimeConfig.streamableHttpRequireOriginValidation) {
      return true
    }

    const origin = header(req, 'origin')
    if (!origin) {
      return true
    }

    if (this.runtimeConfig.streamableHttpAllowedOrigins.length > 0) {
      return this.runtimeConfig.streamableHttpAllowedOrigins.includes(origin)
    }

    return (
      origin.startsWith('http://127.0.0.1') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('https://127.0.0.1') ||
      origin.startsWith('https://localhost')
    )
  }

  private writeJsonRpcHttpError(res: HttpServerResponse, statusCode: number, body: JsonRpcResponse): void {
    if (res.writableEnded) {
      return
    }
    res.statusCode = statusCode
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
}

function header(req: HttpIncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

function accepts(req: HttpIncomingMessage, requiredTypes: string[]): boolean {
  const value = header(req, 'accept')
  if (!value) return false
  return requiredTypes.every(type => value.includes(type) || value.includes('*/*'))
}

async function readBody(req: HttpIncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}
