import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig, type RuntimeConfig } from '../src/config.js'
import { createLogger } from '../src/observability/logger.js'
import { SessionStore } from '../src/session/sessionStore.js'
import { DesktopLockManager } from '../src/session/lock.js'
import { createNativeHost } from '../src/native/nativeHost.js'
import { CaptureAssetStore } from '../src/assets/captureAssetStore.js'
import { LocalUiApprovalProvider } from '../src/approvals/localUiProvider.js'
import { HostCallbackApprovalProvider } from '../src/approvals/hostCallbackProvider.js'
import { ApprovalCoordinator } from '../src/approvals/approvalCoordinator.js'
import { ComputerUseMcpServer } from '../src/mcp/server.js'
import { StreamableHttpTransport } from '../src/mcp/streamableHttpTransport.js'
import { extractCaptureId } from './captureResultHelpers.js'

const DEFAULT_PROTOCOL_VERSION = '2025-11-25'

interface HttpJsonResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: unknown
  rawBody: string
}

interface HttpHarness {
  config: RuntimeConfig
  captureAssetStore: CaptureAssetStore
  transport: StreamableHttpTransport
  stop: () => Promise<void>
}

function transportPort(harness: HttpHarness): number {
  assert.equal(typeof harness.transport.port, 'number')
  return harness.transport.port as number
}

function requestJson(options: Parameters<typeof http.request>[0], body?: unknown): Promise<HttpJsonResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res: any) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        raw += chunk
      })
      res.on('end', () => {
        let parsed: unknown = undefined
        if (raw) {
          try {
            parsed = JSON.parse(raw)
          } catch {
            parsed = raw
          }
        }

        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: parsed,
          rawBody: raw,
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

async function createHttpHarness(overrides: Partial<RuntimeConfig> = {}): Promise<HttpHarness> {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  config.enableStreamableHttp = true
  config.streamableHttpPort = 0
  Object.assign(config, overrides)

  const logger = createLogger()
  const captureAssetStore = new CaptureAssetStore(config.captureAssetRoot, logger)
  await captureAssetStore.initialize()
  const sessionStore = new SessionStore()
  const lockManager = new DesktopLockManager(`${config.lockPath}.http-test`)
  const nativeHost = createNativeHost(config, logger)
  const localApprovalProvider = new LocalUiApprovalProvider(config, logger)
  const hostApprovalProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const approvalCoordinator = new ApprovalCoordinator(nativeHost, localApprovalProvider, hostApprovalProvider, logger)
  const runtime = { config, sessionStore, lockManager, approvalCoordinator, nativeHost, captureAssetStore, logger }
  const server = new ComputerUseMcpServer(runtime)
  const transport = new StreamableHttpTransport(server, config, sessionStore, captureAssetStore, logger)
  await transport.start()

  return {
    config,
    captureAssetStore,
    transport,
    stop: async () => {
      await transport.stop()
      await captureAssetStore.cleanupAll()
    },
  }
}

function postHeaders(config: RuntimeConfig, port: number, sessionId?: string, protocolVersion?: string): Parameters<typeof http.request>[0] {
  return {
    method: 'POST',
    host: config.streamableHttpBindHost,
    port,
    path: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      origin: 'http://localhost',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      ...(protocolVersion ? { 'mcp-protocol-version': protocolVersion } : {}),
    },
  }
}

function deleteHeaders(config: RuntimeConfig, port: number, sessionId: string, protocolVersion: string): Parameters<typeof http.request>[0] {
  return {
    method: 'DELETE',
    host: config.streamableHttpBindHost,
    port,
    path: '/mcp',
    headers: {
      origin: 'http://localhost',
      'mcp-session-id': sessionId,
      'mcp-protocol-version': protocolVersion,
    },
  }
}

async function initializeHttpSession(
  harness: HttpHarness,
  options: {
    protocolVersion?: string
    experimental?: Record<string, unknown>
    clientInfo?: { name: string; version: string }
    sendInitializedNotification?: boolean
  } = {},
): Promise<{ sessionId: string; protocolVersion: string; init: HttpJsonResponse }> {
  const protocolVersion = options.protocolVersion ?? DEFAULT_PROTOCOL_VERSION
  const clientInfo = options.clientInfo ?? { name: 'http-test', version: '0.1.0' }

  const init = await requestJson(
    postHeaders(harness.config, transportPort(harness)),
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion,
        capabilities: {},
        ...(options.experimental ? { experimental: options.experimental } : {}),
        clientInfo,
      },
    },
  )

  assert.equal(init.statusCode, 200)
  assert.equal((init.body as any).result.serverInfo.name, 'computer-use')

  const sessionId = String(init.headers['mcp-session-id'])
  assert.equal(sessionId.length > 0, true)

  const negotiatedProtocolVersion = String(
    init.headers['mcp-protocol-version'] ?? (init.body as any).result.protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
  )
  assert.equal(negotiatedProtocolVersion, DEFAULT_PROTOCOL_VERSION)

  if (options.sendInitializedNotification !== false) {
    const initialized = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionId, negotiatedProtocolVersion),
      {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      },
    )

    assert.equal(initialized.statusCode, 202)
    assert.equal(initialized.rawBody, '')
  }

  return { sessionId, protocolVersion: negotiatedProtocolVersion, init }
}

test('streamable HTTP transport can initialize and list tools', async () => {
  const harness = await createHttpHarness()

  try {
    const { sessionId, protocolVersion } = await initializeHttpSession(harness)
    const tools = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionId, protocolVersion),
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    )

    assert.equal(tools.statusCode, 200)
    const toolNames = (tools.body as any).result.tools.map((tool: any) => tool.name)
    assert.equal(toolNames.includes('computer_batch'), true)
    assert.equal(toolNames.includes('zoom'), true)
    assert.equal(toolNames.includes('capture_metadata'), true)
    assert.equal(toolNames.includes('search_applications'), true)
  } finally {
    await harness.stop()
  }
})

test('streamable HTTP transport ignores client session hints for transport routing', async () => {
  const harness = await createHttpHarness()

  try {
    const { sessionId, protocolVersion } = await initializeHttpSession(harness, {
      experimental: {
        sessionId: 'client-hint-session',
      },
    })

    const tools = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionId, protocolVersion),
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    )

    assert.equal(tools.statusCode, 200)
    assert.equal(Array.isArray((tools.body as any).result.tools), true)
  } finally {
    await harness.stop()
  }
})

test('streamable HTTP transport returns capture image paths and cleans them up on delete', async () => {
  const captureAssetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-assets-http-'))
  const harness = await createHttpHarness({ captureAssetRoot })

  try {
    const sessionOne = await initializeHttpSession(harness)
    const screenshot = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionOne.sessionId, sessionOne.protocolVersion),
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

    const captureId = extractCaptureId((screenshot.body as any).result)
    assert.equal((screenshot.body as any).result.content[0]?.type, 'text')
    assert.equal((screenshot.body as any).result.content[1]?.type, 'image')
    assert.equal(typeof (screenshot.body as any).result.content[1]?.data, 'string')
    assert.equal((screenshot.body as any).result.content[1]?.mimeType, 'image/jpeg')
    assert.equal((screenshot.body as any).result.structuredContent, undefined)

    const captureMetadata = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionOne.sessionId, sessionOne.protocolVersion),
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
    const imagePath = String((captureMetadata.body as any).result.structuredContent.imagePath)
    assert.equal((captureMetadata.body as any).result.structuredContent.captureId, captureId)
    assert.equal((await fs.stat(imagePath)).isFile(), true)

    const sessionTwo = await initializeHttpSession(harness, {
      clientInfo: { name: 'http-resource-test', version: '0.1.0' },
    })
    const wrongSessionMetadata = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionTwo.sessionId, sessionTwo.protocolVersion),
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
    assert.equal((wrongSessionMetadata.body as any).result.isError, true)
    assert.equal((wrongSessionMetadata.body as any).result.structuredContent.error.name, 'CaptureAssetNotFoundError')

    const screenshotTwo = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionTwo.sessionId, sessionTwo.protocolVersion),
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

    const captureIdTwo = extractCaptureId((screenshotTwo.body as any).result)
    assert.equal((screenshotTwo.body as any).result.content[1]?.type, 'image')
    const captureMetadataTwo = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionTwo.sessionId, sessionTwo.protocolVersion),
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
    const imagePathTwo = String((captureMetadataTwo.body as any).result.structuredContent.imagePath)
    assert.equal((await fs.stat(imagePathTwo)).isFile(), true)
    assert.notEqual(imagePathTwo, imagePath)

    const deleted = await requestJson(
      deleteHeaders(harness.config, transportPort(harness), sessionOne.sessionId, sessionOne.protocolVersion),
    )

    assert.equal(deleted.statusCode, 204)
    assert.equal(harness.captureAssetStore.listSessionAssets(sessionOne.sessionId).length, 0)
    await assert.rejects(fs.stat(imagePath))
    assert.equal((await fs.stat(imagePathTwo)).isFile(), true)
  } finally {
    await harness.stop()
    await fs.rm(captureAssetRoot, { recursive: true, force: true })
  }
})

test('streamable HTTP transport rejects requests before notifications/initialized', async () => {
  const harness = await createHttpHarness()

  try {
    const { sessionId, protocolVersion } = await initializeHttpSession(harness, { sendInitializedNotification: false })
    const tools = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionId, protocolVersion),
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    )

    assert.equal(tools.statusCode, 200)
    assert.equal((tools.body as any).error.code, -32600)
    assert.match(String((tools.body as any).error.message), /waiting for notifications\/initialized/i)
  } finally {
    await harness.stop()
  }
})

test('streamable HTTP transport rejects invalid protocol version headers after initialization', async () => {
  const harness = await createHttpHarness()

  try {
    const { sessionId } = await initializeHttpSession(harness)
    const tools = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionId, '9999-99-99'),
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    )

    assert.equal(tools.statusCode, 400)
    assert.equal((tools.body as any).error.code, -32600)
    assert.match(String((tools.body as any).error.message), /unsupported mcp-protocol-version/i)
  } finally {
    await harness.stop()
  }
})

test('streamable HTTP transport rejects JSON-RPC batch payloads', async () => {
  const harness = await createHttpHarness()

  try {
    const response = await requestJson(
      postHeaders(harness.config, transportPort(harness)),
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: DEFAULT_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'http-batch-test', version: '0.1.0' },
          },
        },
      ],
    )

    assert.equal(response.statusCode, 400)
    assert.equal((response.body as any).error.code, -32600)
    assert.match(String((response.body as any).error.message), /batches are not supported/i)
  } finally {
    await harness.stop()
  }
})

test('streamable HTTP transport returns unknown tool as a protocol error', async () => {
  const harness = await createHttpHarness()

  try {
    const { sessionId, protocolVersion } = await initializeHttpSession(harness)
    const response = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionId, protocolVersion),
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'not_a_real_tool',
          arguments: {},
        },
      },
    )

    assert.equal(response.statusCode, 200)
    assert.equal((response.body as any).error.code, -32602)
    assert.match(String((response.body as any).error.message), /unknown tool/i)
  } finally {
    await harness.stop()
  }
})

test('streamable HTTP transport returns tool input validation failures as CallToolResult errors', async () => {
  const harness = await createHttpHarness()

  try {
    const { sessionId, protocolVersion } = await initializeHttpSession(harness)
    const response = await requestJson(
      postHeaders(harness.config, transportPort(harness), sessionId, protocolVersion),
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'wait',
          arguments: { durationMs: '100' },
        },
      },
    )

    assert.equal(response.statusCode, 200)
    assert.equal((response.body as any).result.isError, true)
    assert.equal((response.body as any).result.structuredContent.error.name, 'ToolInputValidationError')
  } finally {
    await harness.stop()
  }
})
