import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'

interface SpawnedServer {
  child: ChildProcessWithoutNullStreams
  rl: ReturnType<typeof createInterface>
  captureAssetRoot: string
  readResponse: () => Promise<any>
  send: (message: unknown) => void
  stop: () => Promise<void>
}

async function spawnServer(): Promise<SpawnedServer> {
  const entry = path.resolve(process.cwd(), 'dist/computer-use-mcp/src/main.js')
  const captureAssetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'computer-use-protocol-assets-'))
  const child = spawn(process.execPath, [entry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COMPUTER_USE_FAKE: '1',
      COMPUTER_USE_CAPTURE_ASSET_ROOT: captureAssetRoot,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const rl = createInterface({ input: child.stdout })
  const readResponse = () =>
    new Promise<any>((resolve, reject) => {
      rl.once('line', (line: string) => {
        try {
          resolve(JSON.parse(line))
        } catch (error) {
          reject(error)
        }
      })
    })

  return {
    child,
    rl,
    captureAssetRoot,
    readResponse,
    send(message: unknown) {
      child.stdin.write(`${JSON.stringify(message)}\n`)
    },
    async stop() {
      rl.close()
      child.kill()
      await fs.rm(captureAssetRoot, { recursive: true, force: true })
    },
  }
}

test('stdio rejects tools/list before initialize', async () => {
  const server = await spawnServer()

  try {
    server.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    })

    const response = await server.readResponse()
    assert.equal(response.error.code, -32600)
    assert.match(String(response.error.message), /initialize first/i)
  } finally {
    await server.stop()
  }
})

test('stdio rejects tools/call before notifications/initialized', async () => {
  const server = await spawnServer()

  try {
    server.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'protocol-test', version: '0.1.0' },
      },
    })
    const init = await server.readResponse()
    assert.equal(init.result.serverInfo.name, 'computer-use')

    server.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'wait',
        arguments: { durationMs: 1 },
      },
    })
    const response = await server.readResponse()
    assert.equal(response.error.code, -32600)
    assert.match(String(response.error.message), /notifications\/initialized/i)
  } finally {
    await server.stop()
  }
})

test('stdio rejects a second initialize request on the same connection', async () => {
  const server = await spawnServer()

  try {
    const initialize = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'protocol-test', version: '0.1.0' },
      },
    }

    server.send(initialize)
    const first = await server.readResponse()
    assert.equal(first.result.serverInfo.name, 'computer-use')

    server.send({ ...initialize, id: 2 })
    const second = await server.readResponse()
    assert.equal(second.error.code, -32600)
    assert.match(String(second.error.message), /initialize must be the first request/i)
  } finally {
    await server.stop()
  }
})

test('stdio rejects initialize with a null request id', async () => {
  const server = await spawnServer()

  try {
    server.send({
      jsonrpc: '2.0',
      id: null,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'protocol-test', version: '0.1.0' },
      },
    })

    const response = await server.readResponse()
    assert.equal(response.error.code, -32600)
    assert.equal('id' in response, false)
  } finally {
    await server.stop()
  }
})

test('stdio rejects JSON-RPC batches', async () => {
  const server = await spawnServer()

  try {
    server.send([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'protocol-test', version: '0.1.0' },
        },
      },
    ])

    const response = await server.readResponse()
    assert.equal(response.error.code, -32600)
    assert.match(String(response.error.message), /batches are not supported/i)
  } finally {
    await server.stop()
  }
})
