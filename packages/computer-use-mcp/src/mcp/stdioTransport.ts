import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'
import type { Logger } from '../observability/logger.js'
import { BaseClientConnection, type TransportAdapter } from './transport.js'
import {
  failure,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  readJsonRpcId,
  type JsonRpcNotification,
  type JsonRpcRequest,
} from './jsonRpc.js'
import type { ComputerUseMcpServer } from './server.js'
import { NotificationRejectedError } from './protocolErrors.js'

class StdioConnection extends BaseClientConnection {
  constructor() {
    super(`stdio-connection:${process.pid}`, 'stdio', `stdio:${randomUUID()}`)
  }

  protected async sendOutbound(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    process.stdout.write(`${JSON.stringify(message)}\n`)
  }

  protected async closeTransport(): Promise<void> {
    return
  }
}

class StdioTransport implements TransportAdapter {
  readonly name = 'stdio'
  private readonly connection = new StdioConnection()
  private rl?: ReturnType<typeof createInterface>
  private closed = false

  constructor(
    private readonly server: ComputerUseMcpServer,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    if (this.rl) return

    this.rl = createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    })

    this.rl.on('line', (line: string) => {
      void this.handleLine(line)
    })

    this.rl.on('close', () => {
      if (this.closed) return
      this.closed = true
      void this.connection.close()
    })
  }

  async stop(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.rl?.close()
    this.rl = undefined
    await this.connection.close()
  }

  private async handleLine(line: string): Promise<void> {
    const trimmed = line.trim()
    if (trimmed.length === 0) return

    try {
      const parsed = JSON.parse(trimmed) as unknown

      if (Array.isArray(parsed)) {
        writeStdioResponse(failure(undefined, -32600, 'JSON-RPC batches are not supported.'))
        return
      }

      const response = await handleMessage(parsed, this.server, this.connection, this.logger)
      if (response) {
        writeStdioResponse(response)
      }
    } catch (error) {
      this.logger.error('stdio transport failed to process line', error)
      writeStdioResponse(failure(undefined, -32700, 'Parse error'))
    }
  }
}

export async function connectStdioTransport(server: ComputerUseMcpServer, logger: Logger): Promise<TransportAdapter> {
  const transport = new StdioTransport(server, logger)
  await transport.start()
  return transport
}

async function handleMessage(
  parsed: unknown,
  server: ComputerUseMcpServer,
  connection: StdioConnection,
  logger: Logger,
) {
  if (isJsonRpcResponse(parsed)) {
    connection.handleJsonRpcResponse(parsed)
    return undefined
  }

  if (isJsonRpcNotification(parsed)) {
    try {
      await server.handleNotification(parsed, connection)
    } catch (error) {
      logger.warn('stdio transport rejected notification', serializeNotificationError(parsed.method, error))
    }
    return undefined
  }

  if (isJsonRpcRequest(parsed)) {
    return server.handleRequest(parsed, connection)
  }

  return failure(readJsonRpcId(parsed), -32600, 'Invalid Request')
}

function serializeNotificationError(method: string, error: unknown) {
  if (error instanceof NotificationRejectedError) {
    return {
      method,
      message: error.message,
      httpStatus: error.httpStatus,
      jsonRpcCode: error.jsonRpcCode,
      data: error.data,
    }
  }

  return {
    method,
    message: error instanceof Error ? error.message : String(error),
  }
}

function writeStdioResponse(response: unknown): void {
  process.stdout.write(`${JSON.stringify(response)}\n`)
}
