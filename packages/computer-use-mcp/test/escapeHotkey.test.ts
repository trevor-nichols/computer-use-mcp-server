import test from 'node:test'
import assert from 'node:assert/strict'
import { executeKey } from '../src/tools/key.js'
import { executeHoldKey } from '../src/tools/holdKey.js'
import { createSessionContext } from '../src/session/sessionContext.js'

function createContext() {
  const session = createSessionContext({
    sessionId: 'escape-hotkey-session',
    connectionId: 'escape-hotkey-connection',
    approvalMode: 'local-ui',
  })
  session.tccState = {
    accessibility: true,
    screenRecording: true,
  }
  session.grantFlags.systemKeyCombos = true

  const markedEscapes: Array<{ sessionId: string; windowMs: number }> = []

  const ctx = {
    session,
    runtime: {
      nativeHost: {
        tcc: {
          async getState() {
            return session.tccState
          },
        },
        hotkeys: {
          async markExpectedEscape(sessionId: string, windowMs: number) {
            markedEscapes.push({ sessionId, windowMs })
          },
        },
        input: {
          async keySequence() {},
          async keyDown() {},
          async keyUp() {},
        },
      },
    },
  } as any

  return {
    ctx,
    markedEscapes,
  }
}

test('executeKey marks expected escape before sending an escape key sequence', async () => {
  const { ctx, markedEscapes } = createContext()

  const result = await executeKey(
    ctx,
    { sequence: 'escape' },
    {
      async delayWithAbort() {},
    },
  )

  assert.equal((result as any).structuredContent.ok, true)
  assert.deepEqual(markedEscapes, [{ sessionId: 'escape-hotkey-session', windowMs: 1_000 }])
})

test('executeHoldKey marks expected escape before pressing escape', async () => {
  const { ctx, markedEscapes } = createContext()

  const result = await executeHoldKey(
    ctx,
    { keys: ['escape'], durationMs: 10 },
    {
      async delayWithAbort() {},
    },
  )

  assert.equal((result as any).structuredContent.ok, true)
  assert.deepEqual(markedEscapes, [{ sessionId: 'escape-hotkey-session', windowMs: 1_000 }])
})
