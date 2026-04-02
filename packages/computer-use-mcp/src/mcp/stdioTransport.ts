import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'
import type { Logger } from '../observability/logger.js'
import { BaseClientConnection, type TransportAdapter } from './transport.js'
import { failure, isJsonRpcRequest, isJsonRpcResponse, type JsonRpcRequest } from './jsonRpc.js'
import type { ComputerUseMcpServer } from './server.js'

class StdioConnection extends BaseClientConnection {
  constructor() {
    super(`stdio-connection:${process.pid}`, 'stdio', `stdio:${randomUUID()}`)
  }

  protected async sendOutbound(message: JsonRpcRequest): Promise<void> {
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
        const results = []
        for (const item of parsed) {
          const result = await handleMessage(item, this.server, this.connection)
          if (result) results.push(result)
        }
        if (results.length > 0) {
          process.stdout.write(`${JSON.stringify(results)}\n`)
        }
        return
      }

      const response = await handleMessage(parsed, this.server, this.connection)
      if (response) {
        process.stdout.write(`${JSON.stringify(response)}\n`)
      }
    } catch (error) {
      this.logger.error('stdio transport failed to process line', error)
      process.stdout.write(`${JSON.stringify(failure(null, -32700, 'Parse error'))}\n`)
    }
  }
}

export async function connectStdioTransport(server: ComputerUseMcpServer, logger: Logger): Promise<TransportAdapter> {
  const transport = new StdioTransport(server, logger)
  await transport.start()
  return transport
}

async function handleMessage(parsed: unknown, server: ComputerUseMcpServer, connection: StdioConnection) {
  if (isJsonRpcResponse(parsed)) {
    connection.handleJsonRpcResponse(parsed)
    return undefined
  }

  if (!isJsonRpcRequest(parsed)) {
    return failure(null, -32600, 'Invalid Request')
  }

  return server.handle(parsed, connection)
}
