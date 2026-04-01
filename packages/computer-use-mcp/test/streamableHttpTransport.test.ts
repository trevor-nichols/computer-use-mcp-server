import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { loadConfig } from '../src/config.js'
import { createLogger } from '../src/observability/logger.js'
import { SessionStore } from '../src/session/sessionStore.js'
import { DesktopLockManager } from '../src/session/lock.js'
import { createNativeHost } from '../src/native/swiftBridge.js'
import { LocalUiApprovalProvider } from '../src/approvals/localUiProvider.js'
import { HostCallbackApprovalProvider } from '../src/approvals/hostCallbackProvider.js'
import { ApprovalCoordinator } from '../src/approvals/approvalCoordinator.js'
import { ComputerUseMcpServer } from '../src/mcp/server.js'
import { StreamableHttpTransport } from '../src/mcp/streamableHttpTransport.js'

function requestJson(options: any, body?: unknown): Promise<{ statusCode: number; headers: any; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res: any) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        raw += chunk
      })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: raw ? JSON.parse(raw) : undefined,
        })
      })
    })
    req.on('error', reject)
    if (body !== undefined) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

test('streamable HTTP transport can initialize and list tools', async () => {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  config.enableStreamableHttp = true
  config.streamableHttpPort = 0
  const logger = createLogger()
  const sessionStore = new SessionStore()
  const lockManager = new DesktopLockManager(config.lockPath + '.http-test')
  const nativeHost = createNativeHost(config, logger)
  const localApprovalProvider = new LocalUiApprovalProvider(config, logger)
  const hostApprovalProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const approvalCoordinator = new ApprovalCoordinator(nativeHost, localApprovalProvider, hostApprovalProvider, logger)
  const runtime = { config, sessionStore, lockManager, approvalCoordinator, nativeHost, logger }
  const server = new ComputerUseMcpServer(runtime)
  const transport = new StreamableHttpTransport(server, config, sessionStore, logger)
  await transport.start()

  try {
    const port = transport.port
    assert.equal(typeof port, 'number')

    const init = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
        },
      },
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'http-test', version: '0.1.0' },
        },
      },
    )

    assert.equal(init.statusCode, 200)
    assert.equal(init.body.result.serverInfo.name, 'computer-use')
    const sessionId = String(init.headers['mcp-session-id'])
    assert.equal(sessionId.length > 0, true)

    const tools = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
          'mcp-session-id': sessionId,
        },
      },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    )

    assert.equal(tools.statusCode, 200)
    const toolNames = tools.body.result.tools.map((tool: any) => tool.name)
    assert.equal(toolNames.includes('computer_batch'), true)
    assert.equal(toolNames.includes('zoom'), true)
  } finally {
    await transport.stop()
  }
})

test('streamable HTTP transport ignores client session hints for transport routing', async () => {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  config.enableStreamableHttp = true
  config.streamableHttpPort = 0
  const logger = createLogger()
  const sessionStore = new SessionStore()
  const lockManager = new DesktopLockManager(config.lockPath + '.http-session-hint-test')
  const nativeHost = createNativeHost(config, logger)
  const localApprovalProvider = new LocalUiApprovalProvider(config, logger)
  const hostApprovalProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const approvalCoordinator = new ApprovalCoordinator(nativeHost, localApprovalProvider, hostApprovalProvider, logger)
  const runtime = { config, sessionStore, lockManager, approvalCoordinator, nativeHost, logger }
  const server = new ComputerUseMcpServer(runtime)
  const transport = new StreamableHttpTransport(server, config, sessionStore, logger)
  await transport.start()

  try {
    const port = transport.port
    assert.equal(typeof port, 'number')

    const init = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
        },
      },
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          experimental: {
            sessionId: 'client-hint-session',
          },
          clientInfo: { name: 'http-test', version: '0.1.0' },
        },
      },
    )

    assert.equal(init.statusCode, 200)
    const transportSessionId = String(init.headers['mcp-session-id'])
    assert.equal(transportSessionId.length > 0, true)

    const tools = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
          'mcp-session-id': transportSessionId,
        },
      },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    )

    assert.equal(tools.statusCode, 200)
    assert.equal(Array.isArray(tools.body.result.tools), true)
  } finally {
    await transport.stop()
  }
})
