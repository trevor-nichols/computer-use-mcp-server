import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../src/config.js'
import { createNativeHost } from '../src/native/nativeHost.js'
import { createLogger } from '../src/observability/logger.js'
import { createSessionContext } from '../src/session/sessionContext.js'
import { computerBatchTool } from '../src/tools/batch.js'

test('computer_batch reuses one action scope for the whole batch', async () => {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  const logger = createLogger()
  const nativeHost = createNativeHost(config, logger)

  let acquireCount = 0
  let releaseCount = 0
  let registerAbortCount = 0
  let unregisterAbortCount = 0

  const runtime = {
    config,
    logger,
    lockManager: {
      async acquire() {
        acquireCount += 1
        return async () => {
          releaseCount += 1
        }
      },
    },
    nativeHost: {
      ...nativeHost,
      hotkeys: {
        ...nativeHost.hotkeys,
        async registerEscapeAbort() {
          registerAbortCount += 1
        },
        async unregisterEscapeAbort() {
          unregisterAbortCount += 1
        },
      },
    },
  }

  const session = createSessionContext({
    sessionId: 'batch-session',
    connectionId: 'batch-connection',
    approvalMode: 'local-ui',
  })
  session.grantFlags.clipboardRead = true
  session.grantFlags.clipboardWrite = true
  session.grantFlags.systemKeyCombos = true

  const result = await computerBatchTool({ runtime, session } as any, {
    actions: [
      { tool: 'write_clipboard', arguments: { text: 'batch-scope' } },
      { tool: 'read_clipboard' },
      { tool: 'wait', arguments: { durationMs: 1 } },
    ],
  })

  assert.equal((result as any).structuredContent.ok, true)
  assert.equal(acquireCount, 1)
  assert.equal(releaseCount, 1)
  assert.equal(registerAbortCount, 1)
  assert.equal(unregisterAbortCount, 1)
})
