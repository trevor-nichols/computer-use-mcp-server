import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../src/config.js'
import { createNativeHost } from '../src/native/swiftBridge.js'
import { createLogger } from '../src/observability/logger.js'
import { createSessionContext } from '../src/session/sessionContext.js'
import { zoomTool } from '../src/tools/zoom.js'
import { CaptureAssetStore } from '../src/assets/captureAssetStore.js'

const display = {
  displayId: 1,
  name: 'Built-in',
  originX: 0,
  originY: 0,
  width: 1512,
  height: 982,
  scaleFactor: 2,
  isPrimary: true,
}

test('zoom attaches an MCP image result and still saves a local image path', async () => {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  const logger = createLogger()
  const nativeHost = createNativeHost(config, logger)
  const captureAssetStore = new CaptureAssetStore(path.join(os.tmpdir(), `capture-assets-zoom-${Date.now()}`), logger)
  await captureAssetStore.initialize()
  const captureCalls: Array<{
    displayId?: number
    region?: { x: number; y: number; width: number; height: number }
    format: 'jpeg' | 'png'
    jpegQuality?: number
  }> = []

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
          return [display]
        },
        async capture(options: {
          displayId?: number
          region?: { x: number; y: number; width: number; height: number }
          format: 'jpeg' | 'png'
          jpegQuality?: number
        }) {
          captureCalls.push(options)
          return {
            dataBase64: 'abc',
            mimeType: 'image/png' as const,
            width: 40,
            height: 20,
            display,
          }
        },
      },
    },
  }

  const session = createSessionContext({
    sessionId: 'zoom-session',
    connectionId: 'zoom-connection',
    approvalMode: 'local-ui',
  })
  session.lastScreenshotDims = {
    width: 200,
    height: 100,
    displayId: display.displayId,
    originX: 10,
    originY: 20,
    logicalWidth: 400,
    logicalHeight: 200,
    scaleFactor: display.scaleFactor,
  }

  try {
    const result = await zoomTool({ runtime, session } as any, {
      x: 50,
      y: 25,
      width: 20,
      height: 10,
    })

    assert.deepEqual(captureCalls, [{
      displayId: display.displayId,
      region: { x: 110, y: 70, width: 40, height: 20 },
      format: config.screenshotDefaultFormat,
      jpegQuality: config.screenshotJpegQuality,
      excludeBundleIds: [],
    }])
    assert.equal((result as any).content[0]?.type, 'text')
    assert.equal((result as any).content[1]?.type, 'image')
    assert.equal((result as any).content[1]?.data, 'abc')
    assert.equal((result as any).content[1]?.mimeType, 'image/png')
    assert.equal((result as any).structuredContent, undefined)
    const asset = captureAssetStore.listSessionAssets(session.sessionId)[0]
    assert.equal(typeof asset?.captureId, 'string')
    assert.equal(typeof asset?.imagePath, 'string')
    assert.equal((await fs.stat(asset!.imagePath)).isFile(), true)
    assert.equal(asset?.originX, 110)
    assert.equal(asset?.originY, 70)
  } finally {
    await captureAssetStore.cleanupAll()
  }
})
