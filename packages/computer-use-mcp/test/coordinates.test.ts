import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../src/config.js'
import { createNativeHost } from '../src/native/nativeHost.js'
import { createLogger } from '../src/observability/logger.js'
import { createSessionContext } from '../src/session/sessionContext.js'
import { leftClickTool } from '../src/tools/click.js'
import { leftClickDragTool } from '../src/tools/drag.js'
import { screenshotTool } from '../src/tools/screenshot.js'
import { zoomTool } from '../src/tools/zoom.js'
import { mapScreenshotPointToDesktop } from '../src/transforms/coordinates.js'

const zoomRegressionDisplay = {
  displayId: 1,
  name: 'Built-in',
  originX: 10,
  originY: 20,
  width: 200,
  height: 100,
  scaleFactor: 2,
  isPrimary: true,
}

function createZoomRegressionRuntime() {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  config.clickSettleMs = 0
  config.dragAnimationMs = 16

  const logger = createLogger()
  const nativeHost = createNativeHost(config, logger)

  const captureCalls: Array<Record<string, unknown>> = []
  const moveCalls: Array<{ x: number; y: number }> = []
  const clickCalls: Array<{ button: string; count: number; cursor: { x: number; y: number } }> = []
  const mouseDownCalls: Array<{ button: string; cursor: { x: number; y: number } }> = []
  const mouseUpCalls: Array<{ button: string; cursor: { x: number; y: number } }> = []
  let cursor = { x: 0, y: 0 }
  let captureSequence = 0

  const runtime = {
    config,
    logger,
    captureAssetStore: {
      async createAsset(sessionId: string, _capture: unknown, screenshotDims: any, excludedBundleIds: string[]) {
        captureSequence += 1
        const captureId = `capture-${captureSequence}`
        return {
          captureId,
          sessionId,
          imagePath: `/tmp/${captureId}.png`,
          mimeType: 'image/png',
          createdAt: new Date().toISOString(),
          sizeBytes: 3,
          excludedBundleIds,
          ...screenshotDims,
        }
      },
    },
    lockManager: {
      async acquire() {
        return async () => {}
      },
    },
    nativeHost: {
      ...nativeHost,
      screenshots: {
        async listDisplays() {
          return [zoomRegressionDisplay]
        },
        async capture(options: Record<string, unknown>) {
          captureCalls.push(options)
          return {
            dataBase64: 'abc',
            mimeType: 'image/png',
            width: Number(options.targetWidth ?? zoomRegressionDisplay.width),
            height: Number(options.targetHeight ?? zoomRegressionDisplay.height),
            display: zoomRegressionDisplay,
          }
        },
      },
      input: {
        ...nativeHost.input,
        async getCursorPosition() {
          return cursor
        },
        async moveMouse(x: number, y: number) {
          cursor = { x, y }
          moveCalls.push(cursor)
        },
        async mouseDown(button: 'left' | 'right' | 'middle') {
          mouseDownCalls.push({ button, cursor })
        },
        async mouseUp(button: 'left' | 'right' | 'middle') {
          mouseUpCalls.push({ button, cursor })
        },
        async click(button: 'left' | 'right' | 'middle', count: 1 | 2 | 3) {
          clickCalls.push({ button, count, cursor })
        },
      },
    },
  }

  return {
    runtime,
    captureCalls,
    moveCalls,
    clickCalls,
    mouseDownCalls,
    mouseUpCalls,
  }
}

function createZoomRegressionSession() {
  const session = createSessionContext({
    sessionId: 'zoom-regression-session',
    connectionId: 'zoom-regression-connection',
    approvalMode: 'local-ui',
  })
  session.tccState = {
    accessibility: true,
    screenRecording: true,
  }
  return session
}

test('mapScreenshotPointToDesktop maps screenshot coordinates into logical display space', () => {
  const point = mapScreenshotPointToDesktop(
    { x: 50, y: 25 },
    {
      width: 100,
      height: 50,
      displayId: 1,
      originX: 10,
      originY: 20,
      logicalWidth: 200,
      logicalHeight: 100,
      scaleFactor: 2,
    },
  )

  assert.equal(point.x, 110)
  assert.equal(point.y, 70)
})

test('zoom stores cropped logical geometry so a later zoom maps through the current zoom region', async () => {
  const { runtime, captureCalls } = createZoomRegressionRuntime()
  const session = createZoomRegressionSession()

  await screenshotTool({ runtime, session } as any, {})
  const firstZoom = await zoomTool({ runtime, session } as any, { x: 50, y: 20, width: 100, height: 40 })
  await zoomTool({ runtime, session } as any, { x: 100, y: 50, width: 50, height: 25 })

  assert.equal((firstZoom as any).structuredContent, undefined)
  assert.equal((firstZoom as any).content[0]?.type, 'text')
  assert.match((firstZoom as any).content[0]?.text ?? '', /captureId=capture-2/)
  assert.equal((firstZoom as any).content[1]?.type, 'image')
  assert.deepEqual(captureCalls[1]?.region, { x: 60, y: 40, width: 100, height: 40 })
  assert.deepEqual(captureCalls[2]?.region, { x: 110, y: 60, width: 25, height: 10 })
  assert.deepEqual(session.lastScreenshotDims, {
    width: 200,
    height: 100,
    displayId: 1,
    originX: 110,
    originY: 60,
    logicalWidth: 25,
    logicalHeight: 10,
    scaleFactor: 2,
  })
})

test('left_click maps through the zoomed logical region instead of the prior full screenshot', async () => {
  const { runtime, moveCalls, clickCalls } = createZoomRegressionRuntime()
  const session = createZoomRegressionSession()

  await screenshotTool({ runtime, session } as any, {})
  await zoomTool({ runtime, session } as any, { x: 50, y: 20, width: 100, height: 40 })

  const result = await leftClickTool({ runtime, session } as any, { x: 150, y: 75 })

  assert.deepEqual(moveCalls[0], { x: 135, y: 70 })
  assert.deepEqual(clickCalls[0], {
    button: 'left',
    count: 1,
    cursor: { x: 135, y: 70 },
  })
  assert.deepEqual((result as any).structuredContent, {
    ok: true,
    x: 135,
    y: 70,
    button: 'left',
    count: 1,
  })
})

test('left_click_drag maps both endpoints through the zoomed logical region', async () => {
  const { runtime, moveCalls, mouseDownCalls, mouseUpCalls } = createZoomRegressionRuntime()
  const session = createZoomRegressionSession()

  await screenshotTool({ runtime, session } as any, {})
  await zoomTool({ runtime, session } as any, { x: 50, y: 20, width: 100, height: 40 })

  const result = await leftClickDragTool({ runtime, session } as any, {
    fromX: 20,
    fromY: 25,
    toX: 160,
    toY: 90,
  })

  assert.deepEqual(moveCalls[0], { x: 70, y: 50 })
  assert.deepEqual(moveCalls.at(-1), { x: 140, y: 76 })
  assert.deepEqual(mouseDownCalls[0], {
    button: 'left',
    cursor: { x: 70, y: 50 },
  })
  assert.deepEqual(mouseUpCalls[0], {
    button: 'left',
    cursor: { x: 140, y: 76 },
  })
  assert.deepEqual((result as any).structuredContent, {
    ok: true,
    from: { x: 70, y: 50 },
    to: { x: 140, y: 76 },
  })
})
