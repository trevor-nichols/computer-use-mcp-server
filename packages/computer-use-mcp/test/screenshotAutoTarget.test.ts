import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { loadConfig } from '../src/config.js'
import { createNativeHost } from '../src/native/nativeHost.js'
import { createLogger } from '../src/observability/logger.js'
import { createSessionContext } from '../src/session/sessionContext.js'
import { screenshotTool } from '../src/tools/screenshot.js'
import { CaptureAssetStore } from '../src/assets/captureAssetStore.js'

const builtInDisplay = {
  displayId: 1,
  name: 'Built-in',
  originX: 0,
  originY: 0,
  width: 1512,
  height: 982,
  scaleFactor: 2,
  isPrimary: true,
}

const externalDisplay = {
  displayId: 2,
  name: 'Studio Display',
  originX: 1512,
  originY: 0,
  width: 2560,
  height: 1440,
  scaleFactor: 2,
  isPrimary: false,
}

function createRuntimeForScreenshotTests() {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  const logger = createLogger()
  const nativeHost = createNativeHost(config, logger)
  const captureAssetStore = new CaptureAssetStore(path.join(os.tmpdir(), `capture-assets-screenshot-${Date.now()}`), logger)

  const displays = [builtInDisplay, externalDisplay]
  const captureCalls: number[] = []
  let nextWindowDisplays: Record<string, number[]> = {}

  const runtime = {
    config,
    logger,
    captureAssetStore,
    lockManager: {
      async acquire() {
        return async () => {}
      },
    },
    nativeHost: {
      ...nativeHost,
      screenshots: {
        async listDisplays() {
          return displays
        },
        async capture(options: { displayId?: number; targetWidth?: number; targetHeight?: number }) {
          const display = displays.find(item => item.displayId === options.displayId) ?? builtInDisplay
          captureCalls.push(display.displayId)
          return {
            dataBase64: 'abc',
            mimeType: 'image/png',
            width: options.targetWidth ?? display.width,
            height: options.targetHeight ?? display.height,
            display,
          }
        },
      },
      apps: {
        ...nativeHost.apps,
        async findWindowDisplays(bundleIds: string[]) {
          return Object.fromEntries(
            bundleIds
              .filter(bundleId => nextWindowDisplays[bundleId] !== undefined)
              .map(bundleId => [bundleId, nextWindowDisplays[bundleId]!]),
          )
        },
      },
    },
  }

  return {
    runtime,
    captureCalls,
    async initialize() {
      await captureAssetStore.initialize()
    },
    async cleanup() {
      await captureAssetStore.cleanupAll()
      await fs.rm(captureAssetStore.rootDir, { recursive: true, force: true })
    },
    setWindowDisplays(windowDisplays: Record<string, number[]>) {
      nextWindowDisplays = windowDisplays
    },
  }
}

test('screenshot stores the allowed-app cache key after a successful auto-target resolution', async () => {
  const { runtime, captureCalls, setWindowDisplays, initialize, cleanup } = createRuntimeForScreenshotTests()
  await initialize()
  const session = createSessionContext({
    sessionId: 'screenshot-auto-target-session',
    connectionId: 'screenshot-auto-target-connection',
    approvalMode: 'local-ui',
  })
  session.allowedApps = [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }]
  setWindowDisplays({
    'com.apple.TextEdit': [2],
  })

  try {
    const result = await screenshotTool({ runtime, session } as any, {})
    const asset = runtime.captureAssetStore.listSessionAssets(session.sessionId)[0]

    assert.equal((result as any).structuredContent, undefined)
    assert.equal((result as any).content[0]?.type, 'text')
    assert.equal((result as any).content[1]?.type, 'image')
    assert.equal(asset?.displayId, 2)
    assert.equal(typeof asset?.captureId, 'string')
    assert.equal(typeof asset?.imagePath, 'string')
    assert.equal((await fs.stat(asset!.imagePath)).isFile(), true)
    assert.deepEqual(captureCalls, [2])
    assert.equal(session.selectedDisplayId, 2)
    assert.equal(session.displayResolvedForAppsKey, 'com.apple.TextEdit')
  } finally {
    await cleanup()
  }
})

test('screenshot clears a stale allowed-app cache key when auto-targeting does not resolve a display', async () => {
  const { runtime, captureCalls, setWindowDisplays, initialize, cleanup } = createRuntimeForScreenshotTests()
  await initialize()
  const session = createSessionContext({
    sessionId: 'screenshot-auto-target-clear-session',
    connectionId: 'screenshot-auto-target-clear-connection',
    approvalMode: 'local-ui',
  })
  session.displayResolvedForAppsKey = 'com.apple.TextEdit'
  session.selectedDisplayId = 2
  session.allowedApps = []
  setWindowDisplays({})

  try {
    const result = await screenshotTool({ runtime, session } as any, {})
    const asset = runtime.captureAssetStore.listSessionAssets(session.sessionId)[0]

    assert.equal((result as any).structuredContent, undefined)
    assert.equal(asset?.displayId, 1)
    assert.equal(typeof asset?.captureId, 'string')
    assert.equal(typeof asset?.imagePath, 'string')
    assert.equal((await fs.stat(asset!.imagePath)).isFile(), true)
    assert.deepEqual(captureCalls, [1])
    assert.equal(session.selectedDisplayId, 1)
    assert.equal(session.displayResolvedForAppsKey, undefined)
  } finally {
    await cleanup()
  }
})
