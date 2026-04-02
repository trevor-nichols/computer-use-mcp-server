import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionContext } from '../src/session/sessionContext.js'
import { listDisplaysTool } from '../src/tools/displays.js'

const displays = [
  {
    displayId: 1,
    name: 'Studio Display',
    originX: 0,
    originY: 0,
    width: 1512,
    height: 982,
    scaleFactor: 2,
    isPrimary: true,
  },
  {
    displayId: 2,
    name: 'Projector',
    originX: 1512,
    originY: 0,
    width: 1920,
    height: 1080,
    scaleFactor: 1,
    isPrimary: false,
  },
]

test('listDisplaysTool returns available displays and the current session pin state', async () => {
  const session = createSessionContext({
    sessionId: 'display-session',
    connectionId: 'display-connection',
    approvalMode: 'local-ui',
  })
  session.selectedDisplayId = 2
  session.displayPinnedByModel = true

  const result = await listDisplaysTool({
    runtime: {
      nativeHost: {
        screenshots: {
          async listDisplays() {
            return displays
          },
        },
      },
    },
    session,
  } as any)

  assert.deepEqual(result.structuredContent, {
    ok: true,
    displayPinnedByModel: true,
    selectedDisplayId: 2,
    displays,
  })
  assert.equal(result.content[0]?.type, 'text')
  assert.match(result.content[0]?.text ?? '', /2 displays available/i)
})
