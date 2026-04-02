import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionContext } from '../src/session/sessionContext.js'
import {
  collectAncestorPids,
  ensureSessionHostIdentity,
  inferStdioHostIdentity,
  parseHostIdentityFromInitialize,
  parseProcessTable,
} from '../src/runtime/hostIdentity.js'

function createLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  }
}

test('parseHostIdentityFromInitialize reads the explicit computerUseHost object', () => {
  const hostIdentity = parseHostIdentityFromInitialize(
    {
      computerUseHost: {
        bundleId: 'com.openai.chatgpt',
        displayName: 'ChatGPT',
      },
    },
    {},
  )

  assert.deepEqual(hostIdentity, {
    bundleId: 'com.openai.chatgpt',
    displayName: 'ChatGPT',
    source: 'initialize-metadata',
  })
})

test('parseProcessTable and collectAncestorPids walk a process chain in order', () => {
  const table = parseProcessTable(`
    300 200
    200 100
    100 1
  `)

  assert.deepEqual(collectAncestorPids(300, table), [200, 100, 1])
})

test('inferStdioHostIdentity returns the first regular ancestor app in the process tree', async () => {
  const hostIdentity = await inferStdioHostIdentity({
    pid: 300,
    readProcessTable: () => `
      300 200
      200 100
      100 1
    `,
    async listRunningApps() {
      return [
        {
          bundleId: 'com.apple.Terminal',
          displayName: 'Terminal',
          pid: 100,
          isFrontmost: true,
        },
        {
          bundleId: 'com.apple.TextEdit',
          displayName: 'TextEdit',
          pid: 999,
          isFrontmost: false,
        },
      ]
    },
  })

  assert.deepEqual(hostIdentity, {
    bundleId: 'com.apple.Terminal',
    displayName: 'Terminal',
    source: 'stdio-parent',
  })
})

test('ensureSessionHostIdentity caches stdio inference onto the session and connection metadata', async () => {
  const session = createSessionContext({
    sessionId: 'host-identity-session',
    connectionId: 'host-identity-connection',
    approvalMode: 'local-ui',
  })

  const connection = {
    connectionId: 'host-identity-connection',
    transportName: 'stdio',
    metadata: {
      sessionId: 'host-identity-session',
      connectionId: 'host-identity-connection',
      approvalMode: 'local-ui',
      hostApprovalCapabilities: {
        appApproval: false,
        tccPromptRelay: false,
      },
      transportName: 'stdio',
    },
    setMetadata(update: Record<string, unknown>) {
      Object.assign(this.metadata, update)
    },
  }

  session.connection = connection as any

  let listRunningAppsCalls = 0
  const hostIdentity = await ensureSessionHostIdentity(
    {
      logger: createLogger(),
      pid: 300,
      readProcessTable: () => `
        300 200
        200 100
        100 1
      `,
      async listRunningApps() {
        listRunningAppsCalls += 1
        return [
          {
            bundleId: 'com.apple.Terminal',
            displayName: 'Terminal',
            pid: 100,
            isFrontmost: true,
          },
        ]
      },
    },
    session,
    {
      connection: connection as any,
    },
  )

  assert.deepEqual(hostIdentity, {
    bundleId: 'com.apple.Terminal',
    displayName: 'Terminal',
    source: 'stdio-parent',
  })
  assert.deepEqual(session.hostIdentity, hostIdentity)
  assert.equal(session.hostIdentityResolutionAttempted, true)
  assert.deepEqual((connection.metadata as any).hostIdentity, hostIdentity)

  await ensureSessionHostIdentity(
    {
      logger: createLogger(),
      readProcessTable: () => {
        throw new Error('should not read process table twice')
      },
      async listRunningApps() {
        listRunningAppsCalls += 1
        return []
      },
    },
    session,
    {
      connection: connection as any,
    },
  )

  assert.equal(listRunningAppsCalls, 1)
})
