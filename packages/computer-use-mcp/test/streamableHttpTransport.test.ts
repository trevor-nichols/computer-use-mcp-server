import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../src/config.js'
import { createLogger } from '../src/observability/logger.js'
import { SessionStore } from '../src/session/sessionStore.js'
import { DesktopLockManager } from '../src/session/lock.js'
import { createNativeHost } from '../src/native/swiftBridge.js'
import { CaptureAssetStore } from '../src/assets/captureAssetStore.js'
import { LocalUiApprovalProvider } from '../src/approvals/localUiProvider.js'
import { HostCallbackApprovalProvider } from '../src/approvals/hostCallbackProvider.js'
import { ApprovalCoordinator } from '../src/approvals/approvalCoordinator.js'
import { ComputerUseMcpServer } from '../src/mcp/server.js'
import { StreamableHttpTransport } from '../src/mcp/streamableHttpTransport.js'
import { extractCaptureId } from './captureResultHelpers.js'

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
  const captureAssetStore = new CaptureAssetStore(config.captureAssetRoot, logger)
  await captureAssetStore.initialize()
  const sessionStore = new SessionStore()
  const lockManager = new DesktopLockManager(config.lockPath + '.http-test')
  const nativeHost = createNativeHost(config, logger)
  const localApprovalProvider = new LocalUiApprovalProvider(config, logger)
  const hostApprovalProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const approvalCoordinator = new ApprovalCoordinator(nativeHost, localApprovalProvider, hostApprovalProvider, logger)
  const runtime = { config, sessionStore, lockManager, approvalCoordinator, nativeHost, captureAssetStore, logger }
  const server = new ComputerUseMcpServer(runtime)
  const transport = new StreamableHttpTransport(server, config, sessionStore, captureAssetStore, logger)
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
    assert.equal(toolNames.includes('capture_metadata'), true)
    assert.equal(toolNames.includes('search_applications'), true)
  } finally {
    await transport.stop()
    await captureAssetStore.cleanupAll()
  }
})

test('streamable HTTP transport ignores client session hints for transport routing', async () => {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  config.enableStreamableHttp = true
  config.streamableHttpPort = 0
  const logger = createLogger()
  const captureAssetStore = new CaptureAssetStore(config.captureAssetRoot, logger)
  await captureAssetStore.initialize()
  const sessionStore = new SessionStore()
  const lockManager = new DesktopLockManager(config.lockPath + '.http-session-hint-test')
  const nativeHost = createNativeHost(config, logger)
  const localApprovalProvider = new LocalUiApprovalProvider(config, logger)
  const hostApprovalProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const approvalCoordinator = new ApprovalCoordinator(nativeHost, localApprovalProvider, hostApprovalProvider, logger)
  const runtime = { config, sessionStore, lockManager, approvalCoordinator, nativeHost, captureAssetStore, logger }
  const server = new ComputerUseMcpServer(runtime)
  const transport = new StreamableHttpTransport(server, config, sessionStore, captureAssetStore, logger)
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
    await captureAssetStore.cleanupAll()
  }
})

test('streamable HTTP transport returns capture image paths and cleans them up on delete', async () => {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  config.enableStreamableHttp = true
  config.streamableHttpPort = 0
  config.captureAssetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-assets-http-'))
  const logger = createLogger()
  const captureAssetStore = new CaptureAssetStore(config.captureAssetRoot, logger)
  await captureAssetStore.initialize()
  const sessionStore = new SessionStore()
  const lockManager = new DesktopLockManager(config.lockPath + '.http-resource-test')
  const nativeHost = createNativeHost(config, logger)
  const localApprovalProvider = new LocalUiApprovalProvider(config, logger)
  const hostApprovalProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const approvalCoordinator = new ApprovalCoordinator(nativeHost, localApprovalProvider, hostApprovalProvider, logger)
  const runtime = { config, sessionStore, lockManager, approvalCoordinator, nativeHost, captureAssetStore, logger }
  const server = new ComputerUseMcpServer(runtime)
  const transport = new StreamableHttpTransport(server, config, sessionStore, captureAssetStore, logger)
  await transport.start()

  const initializeSession = async () => {
    const init = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port: transport.port,
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
          clientInfo: { name: 'http-resource-test', version: '0.1.0' },
        },
      },
    )

    return String(init.headers['mcp-session-id'])
  }

  try {
    const sessionOne = await initializeSession()
    const screenshot = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port: transport.port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
          'mcp-session-id': sessionOne,
        },
      },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'screenshot',
          arguments: {},
        },
      },
    )

    const captureId = extractCaptureId(screenshot.body.result)
    assert.equal(screenshot.body.result.content[0]?.type, 'text')
    assert.equal(screenshot.body.result.content[1]?.type, 'image')
    assert.equal(typeof screenshot.body.result.content[1]?.data, 'string')
    assert.equal(screenshot.body.result.content[1]?.mimeType, 'image/jpeg')
    assert.equal(screenshot.body.result.structuredContent, undefined)

    const captureMetadata = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port: transport.port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
          'mcp-session-id': sessionOne,
        },
      },
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'capture_metadata',
          arguments: { captureId },
        },
      },
    )
    const imagePath = String(captureMetadata.body.result.structuredContent.imagePath)
    assert.equal(captureMetadata.body.result.structuredContent.captureId, captureId)
    assert.equal((await fs.stat(imagePath)).isFile(), true)

    const sessionTwo = await initializeSession()
    const wrongSessionMetadata = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port: transport.port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
          'mcp-session-id': sessionTwo,
        },
      },
      {
        jsonrpc: '2.0',
        id: 31,
        method: 'tools/call',
        params: {
          name: 'capture_metadata',
          arguments: { captureId },
        },
      },
    )
    assert.equal(wrongSessionMetadata.body.result.isError, true)
    assert.equal(wrongSessionMetadata.body.result.structuredContent.error.name, 'CaptureAssetNotFoundError')

    const screenshotTwo = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port: transport.port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
          'mcp-session-id': sessionTwo,
        },
      },
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'screenshot',
          arguments: {},
        },
      },
    )

    const captureIdTwo = extractCaptureId(screenshotTwo.body.result)
    assert.equal(screenshotTwo.body.result.content[1]?.type, 'image')
    const captureMetadataTwo = await requestJson(
      {
        method: 'POST',
        host: config.streamableHttpBindHost,
        port: transport.port,
        path: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost',
          'mcp-session-id': sessionTwo,
        },
      },
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'capture_metadata',
          arguments: { captureId: captureIdTwo },
        },
      },
    )
    const imagePathTwo = String(captureMetadataTwo.body.result.structuredContent.imagePath)
    assert.equal((await fs.stat(imagePathTwo)).isFile(), true)
    assert.notEqual(imagePathTwo, imagePath)

    const deleted = await requestJson(
      {
        method: 'DELETE',
        host: config.streamableHttpBindHost,
        port: transport.port,
        path: '/mcp',
        headers: {
          origin: 'http://localhost',
          'mcp-session-id': sessionOne,
        },
      },
    )

    assert.equal(deleted.statusCode, 204)
    assert.equal(captureAssetStore.listSessionAssets(sessionOne).length, 0)
    await assert.rejects(fs.stat(imagePath))
    assert.equal((await fs.stat(imagePathTwo)).isFile(), true)
  } finally {
    await transport.stop()
    await captureAssetStore.cleanupAll()
    await fs.rm(config.captureAssetRoot, { recursive: true, force: true })
  }
})
