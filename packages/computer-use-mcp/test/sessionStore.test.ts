import test from 'node:test'
import assert from 'node:assert/strict'
import { SessionStore } from '../src/session/sessionStore.js'

test('SessionStore getOrCreate returns the same session instance for the same id', () => {
  const store = new SessionStore()
  const a = store.getOrCreate({ sessionId: 'one', connectionId: 'c1', approvalMode: 'local-ui' })
  const b = store.getOrCreate({ sessionId: 'one', connectionId: 'c1', approvalMode: 'local-ui' })
  assert.equal(a, b)
})
