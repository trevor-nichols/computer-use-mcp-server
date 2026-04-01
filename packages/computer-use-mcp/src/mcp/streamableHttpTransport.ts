import http from 'node:http'
import { randomUUID } from 'node:crypto'
import type { RuntimeConfig } from '../config.js'
import type { Logger } from '../observability/logger.js'
import type { SessionStore } from '../session/sessionStore.js'
import { BaseClientConnection, type TransportAdapter } from './transport.js'
import { failure, isJsonRpcRequest, isJsonRpcResponse, type JsonRpcRequest } from './jsonRpc.js'
import type { ComputerUseMcpServer } from './server.js'

const SESSION_HEADER = 'mcp-session-id'
const PROTOCOL_HEADER = 'mcp-protocol-version'

class HttpSessionConnection extends BaseClientConnection {
  private sse?: any
  private readonly queue: string[] = []

  constructor(private readonly logger: Logger, sessionId: string) {
    super(`http-connection:${randomUUID()}`, 'streamable-http', sessionId)
  }

  attachSse(response: any): void {
    if (this.sse && !this.sse.writableEnded) {
      this.sse.end()
    }
    this.sse = response
    this.flushQueue()
  }

  detachSse(response?: any): void {
    if (!response || this.sse === response) {
      this.sse = undefined
    }
  }

  protected async sendOutbound(message: JsonRpcRequest): Promise<void> {
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
  private server?: any
  private readonly connections = new Map<string, HttpSessionConnection>()
  private cleanupTimer?: ReturnType<typeof setInterval>

  constructor(
    private readonly mcpServer: ComputerUseMcpServer,
    private readonly runtimeConfig: RuntimeConfig,
    private readonly sessionStore: SessionStore,
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

    this.server = http.createServer((req: any, res: any) => {
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
      this.server!.close((error: any) => (error ? reject(error) : resolve()))
    })
    this.server = undefined
  }

  private async handleRequest(req: any, res: any): Promise<void> {
    if ((req.url ?? '').split('?')[0] !== '/mcp') {
      res.statusCode = 404
      res.end('Not Found')
      return
    }

    if (!this.isOriginAllowed(req)) {
      res.statusCode = 403
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(failure(null, -32003, 'Forbidden origin')))
      return
    }

    if (req.method === 'GET') {
      this.handleGet(req, res)
      return
    }

    if (req.method === 'DELETE') {
      await this.handleDelete(req, res)
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end('Method Not Allowed')
      return
    }

    const body = await readBody(req)
    let payload: unknown
    try {
      payload = JSON.parse(body || '{}')
    } catch {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(failure(null, -32700, 'Parse error')))
      return
    }

    if (Array.isArray(payload)) {
      const responses = []
      for (const item of payload) {
        const response = await this.dispatchMessage(item, req, res)
        if (res.writableEnded) {
          return
        }
        if (response) responses.push(response)
      }
      if (responses.length > 0) {
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(responses))
      } else {
        res.statusCode = 202
        res.end()
      }
      return
    }

    const response = await this.dispatchMessage(payload, req, res)
    if (res.writableEnded) {
      return
    }
    if (response) {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(response))
      return
    }

    res.statusCode = 202
    res.end()
  }

  private handleGet(req: any, res: any): void {
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

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      [PROTOCOL_HEADER]: this.runtimeConfig.protocolVersion,
      [SESSION_HEADER]: sessionId,
    })
    res.write(': connected\n\n')
    connection.attachSse(res)
    req.on('close', () => {
      connection.detachSse(res)
    })
  }

  private async handleDelete(req: any, res: any): Promise<void> {
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

    await connection.close()
    this.connections.delete(sessionId)
    this.sessionStore.delete(sessionId)
    res.statusCode = 204
    res.end()
  }

  private async dispatchMessage(payload: unknown, req: any, res: any) {
    if (isJsonRpcResponse(payload)) {
      const sessionId = header(req, SESSION_HEADER)
      if (!sessionId) {
        res.statusCode = 400
        return failure(null, -32600, 'Missing session header for JSON-RPC response message')
      }
      const connection = this.connections.get(sessionId)
      if (!connection) {
        res.statusCode = 404
        return failure(null, -32600, 'Unknown session for JSON-RPC response message')
      }
      connection.handleJsonRpcResponse(payload)
      return undefined
    }

    if (!isJsonRpcRequest(payload)) {
      res.statusCode = 400
      return failure(null, -32600, 'Invalid Request')
    }

    const connection = this.resolveConnection(req, payload, res)
    if (!connection) {
      return undefined
    }

    const response = await this.mcpServer.handle(payload, connection)
    if (payload.method === 'initialize') {
      res.setHeader(SESSION_HEADER, connection.metadata.sessionId)
    }
    res.setHeader(PROTOCOL_HEADER, this.runtimeConfig.protocolVersion)
    return response
  }

  private resolveConnection(req: any, message: JsonRpcRequest, res: any): HttpSessionConnection | undefined {
    const sessionIdHeader = header(req, SESSION_HEADER)

    if (message.method === 'initialize') {
      const sessionId = sessionIdHeader ?? randomUUID()
      let connection = this.connections.get(sessionId)
      if (!connection) {
        connection = new HttpSessionConnection(this.logger, sessionId)
        this.connections.set(sessionId, connection)
      }
      return connection
    }

    if (!sessionIdHeader) {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(failure(message.id ?? null, -32600, 'Missing MCP-Session-Id header')))
      return undefined
    }

    const connection = this.connections.get(sessionIdHeader)
    if (!connection) {
      res.statusCode = 404
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(failure(message.id ?? null, -32600, 'Unknown MCP session')))
      return undefined
    }

    return connection
  }

  private isOriginAllowed(req: any): boolean {
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

    return origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost') || origin.startsWith('https://127.0.0.1') || origin.startsWith('https://localhost')
  }
}

function header(req: any, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

async function readBody(req: any): Promise<string> {
  const chunks: any[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}
