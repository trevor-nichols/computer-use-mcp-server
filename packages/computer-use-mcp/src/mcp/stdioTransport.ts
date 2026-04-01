import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'
import type { Logger } from '../observability/logger.js'
import { BaseClientConnection } from './transport.js'
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

export async function connectStdioTransport(server: ComputerUseMcpServer, logger: Logger): Promise<void> {
  const connection = new StdioConnection()
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  })

  rl.on('line', async (line: string) => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        const results = []
        for (const item of parsed) {
          const result = await handleMessage(item, server, connection)
          if (result) results.push(result)
        }
        if (results.length > 0) {
          process.stdout.write(`${JSON.stringify(results)}\n`)
        }
        return
      }

      const response = await handleMessage(parsed, server, connection)
      if (response) {
        process.stdout.write(`${JSON.stringify(response)}\n`)
      }
    } catch (error) {
      logger.error('stdio transport failed to process line', error)
      process.stdout.write(`${JSON.stringify(failure(null, -32700, 'Parse error'))}\n`)
    }
  })

  const close = async () => {
    await connection.close()
    rl.close()
  }
  process.once('SIGINT', () => void close())
  process.once('SIGTERM', () => void close())
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
