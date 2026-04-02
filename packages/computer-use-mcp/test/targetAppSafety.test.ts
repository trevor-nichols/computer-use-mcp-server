import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionContext } from '../src/session/sessionContext.js'
import { performClick } from '../src/tools/click.js'
import { executeLeftClickDrag } from '../src/tools/drag.js'
import { executeTypeText } from '../src/tools/typeText.js'
import { executeKey } from '../src/tools/key.js'
import { executeScroll } from '../src/tools/scroll.js'
import { TargetApplicationDeniedError, TargetApplicationResolutionError } from '../src/errors/errorTypes.js'

function createLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  }
}

function createContext(options?: {
  allowedApps?: Array<{ bundleId: string; displayName: string }>
  hostIdentity?: { bundleId: string; displayName?: string; source?: 'initialize-metadata' | 'stdio-parent' }
  frontmostApp?: { bundleId: string; displayName: string; pid: number; isFrontmost: boolean } | null
  pointApp?: { bundleId: string; displayName: string; pid: number; isFrontmost: boolean } | null
  appUnderPoint?: (x: number, y: number) => Promise<{ bundleId: string; displayName: string; pid: number; isFrontmost: boolean } | null>
}) {
  const session = createSessionContext({
    sessionId: 'target-app-safety-session',
    connectionId: 'target-app-safety-connection',
    approvalMode: 'local-ui',
  })
  session.tccState = {
    accessibility: true,
    screenRecording: true,
  }
  session.allowedApps = options?.allowedApps ?? [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }]
  if (options?.hostIdentity) {
    session.hostIdentity = {
      bundleId: options.hostIdentity.bundleId,
      displayName: options.hostIdentity.displayName,
      source: options.hostIdentity.source ?? 'initialize-metadata',
    }
    session.hostIdentityResolutionAttempted = true
  }

  const calls = {
    moveMouse: [] as Array<{ x: number; y: number }>,
    click: [] as Array<{ button: string; count: number }>,
    mouseDown: [] as string[],
    mouseUp: [] as string[],
    scroll: [] as Array<{ dx: number; dy: number }>,
    keySequence: [] as string[],
    keyDown: [] as string[],
    keyUp: [] as string[],
    typeText: [] as string[],
    clipboardWrite: [] as string[],
  }

  const hasFrontmostOverride = Boolean(options && Object.prototype.hasOwnProperty.call(options, 'frontmostApp'))
  const hasPointOverride = Boolean(options && Object.prototype.hasOwnProperty.call(options, 'pointApp'))

  const defaultApp = {
    bundleId: 'com.apple.TextEdit',
    displayName: 'TextEdit',
    pid: 10,
    isFrontmost: true,
  }

  const ctx = {
    session,
    runtime: {
      config: {
        clickSettleMs: 0,
        dragAnimationMs: 16,
        clipboardSyncDelayMs: 0,
        clipboardPasteSettleMs: 0,
      },
      logger: createLogger(),
      nativeHost: {
        tcc: {
          async getState() {
            return session.tccState
          },
        },
        apps: {
          async getFrontmostApp() {
            return hasFrontmostOverride ? (options?.frontmostApp ?? null) : defaultApp
          },
          async appUnderPoint(x: number, y: number) {
            if (options?.appUnderPoint) {
              return options.appUnderPoint(x, y)
            }

            return hasPointOverride ? (options?.pointApp ?? null) : defaultApp
          },
        },
        input: {
          async getCursorPosition() {
            return { x: 5, y: 5 }
          },
          async moveMouse(x: number, y: number) {
            calls.moveMouse.push({ x, y })
          },
          async mouseDown(button: 'left' | 'right' | 'middle') {
            calls.mouseDown.push(button)
          },
          async mouseUp(button: 'left' | 'right' | 'middle') {
            calls.mouseUp.push(button)
          },
          async click(button: 'left' | 'right' | 'middle', count: 1 | 2 | 3) {
            calls.click.push({ button, count })
          },
          async scroll(dx: number, dy: number) {
            calls.scroll.push({ dx, dy })
          },
          async keySequence(sequence: string) {
            calls.keySequence.push(sequence)
          },
          async keyDown(key: string) {
            calls.keyDown.push(key)
          },
          async keyUp(key: string) {
            calls.keyUp.push(key)
          },
          async typeText(text: string) {
            calls.typeText.push(text)
          },
        },
        clipboard: {
          async readText() {
            return ''
          },
          async writeText(text: string) {
            calls.clipboardWrite.push(text)
          },
        },
        hotkeys: {
          async markExpectedEscape() {},
          async registerEscapeAbort() {},
          async unregisterEscapeAbort() {},
          async consumeAbort() {
            return false
          },
        },
      },
    },
  } as any

  return { ctx, calls }
}

test('performClick blocks when the app under point is not granted', async () => {
  const { ctx, calls } = createContext({
    pointApp: {
      bundleId: 'com.apple.Terminal',
      displayName: 'Terminal',
      pid: 20,
      isFrontmost: true,
    },
  })

  await assert.rejects(
    performClick(
      ctx,
      { x: 10, y: 20 },
      'left',
      1,
      {
        async delayWithAbort() {},
        async throwIfAbortRequested() {},
      },
    ),
    TargetApplicationDeniedError,
  )

  assert.deepEqual(calls.moveMouse, [])
  assert.deepEqual(calls.click, [])
})

test('performClick allows input when the app under point is granted', async () => {
  const { ctx, calls } = createContext()

  const result = await performClick(
    ctx,
    { x: 10, y: 20 },
    'left',
    1,
    {
      async delayWithAbort() {},
      async throwIfAbortRequested() {},
    },
  )

  assert.equal((result as any).structuredContent.ok, true)
  assert.deepEqual(calls.moveMouse, [{ x: 10, y: 20 }])
  assert.deepEqual(calls.click, [{ button: 'left', count: 1 }])
})

test('executeLeftClickDrag blocks when either drag endpoint is not granted', async () => {
  const { ctx, calls } = createContext({
    appUnderPoint: async (x: number) => (
      x >= 20
        ? { bundleId: 'com.apple.Terminal', displayName: 'Terminal', pid: 20, isFrontmost: true }
        : { bundleId: 'com.apple.TextEdit', displayName: 'TextEdit', pid: 10, isFrontmost: true }
    ),
  })

  await assert.rejects(
    executeLeftClickDrag(
      ctx,
      { fromX: 5, fromY: 5, toX: 25, toY: 25 },
      {
        async delayWithAbort() {},
        async throwIfAbortRequested() {},
      },
    ),
    TargetApplicationDeniedError,
  )

  assert.deepEqual(calls.moveMouse, [])
  assert.deepEqual(calls.mouseDown, [])
  assert.deepEqual(calls.mouseUp, [])
})

test('executeTypeText blocks when the frontmost app cannot be resolved', async () => {
  const { ctx, calls } = createContext({
    frontmostApp: null,
  })

  await assert.rejects(
    executeTypeText(
      ctx,
      { text: 'blocked', viaClipboard: false },
      {
        async delayWithAbort() {},
      },
    ),
    TargetApplicationResolutionError,
  )

  assert.deepEqual(calls.typeText, [])
  assert.deepEqual(calls.clipboardWrite, [])
})

test('executeKey blocks when the frontmost app is not granted', async () => {
  const { ctx, calls } = createContext({
    frontmostApp: {
      bundleId: 'com.apple.Terminal',
      displayName: 'Terminal',
      pid: 20,
      isFrontmost: true,
    },
  })

  await assert.rejects(
    executeKey(
      ctx,
      { sequence: 'a' },
      {
        async delayWithAbort() {},
      },
    ),
    TargetApplicationDeniedError,
  )

  assert.deepEqual(calls.keySequence, [])
})

test('executeScroll blocks when the app under point is not granted', async () => {
  const { ctx, calls } = createContext({
    pointApp: {
      bundleId: 'com.apple.Terminal',
      displayName: 'Terminal',
      pid: 20,
      isFrontmost: true,
    },
  })

  await assert.rejects(
    executeScroll(
      ctx,
      { x: 10, y: 20, dx: 0, dy: -50 },
      {
        async throwIfAbortRequested() {},
      },
    ),
    TargetApplicationDeniedError,
  )

  assert.deepEqual(calls.moveMouse, [])
  assert.deepEqual(calls.scroll, [])
})

test('performClick explains when the host application becomes the app under point', async () => {
  const { ctx } = createContext({
    hostIdentity: {
      bundleId: 'com.apple.Terminal',
      displayName: 'Terminal',
    },
    pointApp: {
      bundleId: 'com.apple.Terminal',
      displayName: 'Terminal',
      pid: 20,
      isFrontmost: true,
    },
  })

  await assert.rejects(
    performClick(
      ctx,
      { x: 10, y: 20 },
      'left',
      1,
      {
        async delayWithAbort() {},
        async throwIfAbortRequested() {},
      },
    ),
    (error: unknown) => error instanceof TargetApplicationDeniedError && error.message.includes('Host app com.apple.Terminal'),
  )
})

test('executeKey explains when the host application is frontmost', async () => {
  const { ctx } = createContext({
    hostIdentity: {
      bundleId: 'com.apple.Terminal',
      displayName: 'Terminal',
    },
    frontmostApp: {
      bundleId: 'com.apple.Terminal',
      displayName: 'Terminal',
      pid: 20,
      isFrontmost: true,
    },
  })

  await assert.rejects(
    executeKey(
      ctx,
      { sequence: 'a' },
      {
        async delayWithAbort() {},
      },
    ),
    (error: unknown) => error instanceof TargetApplicationDeniedError && error.message.includes('Host app com.apple.Terminal'),
  )
})

test('target-app gates are skipped when the session has no granted apps', async () => {
  const { ctx, calls } = createContext({
    allowedApps: [],
    pointApp: null,
  })

  const result = await performClick(
    ctx,
    { x: 10, y: 20 },
    'left',
    1,
    {
      async delayWithAbort() {},
      async throwIfAbortRequested() {},
    },
  )

  assert.equal((result as any).structuredContent.ok, true)
  assert.deepEqual(calls.moveMouse, [{ x: 10, y: 20 }])
  assert.deepEqual(calls.click, [{ button: 'left', count: 1 }])
})
