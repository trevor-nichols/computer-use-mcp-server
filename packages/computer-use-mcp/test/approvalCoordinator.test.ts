import test from 'node:test'
import assert from 'node:assert/strict'
import { ApprovalCoordinator } from '../src/approvals/approvalCoordinator.js'
import { LocalUiApprovalProvider } from '../src/approvals/localUiProvider.js'
import { HostCallbackApprovalProvider } from '../src/approvals/hostCallbackProvider.js'
import { createNativeHost } from '../src/native/swiftBridge.js'
import { createLogger } from '../src/observability/logger.js'
import { createSessionContext } from '../src/session/sessionContext.js'
import { loadConfig } from '../src/config.js'
import type { ClientConnection } from '../src/mcp/transport.js'

test('ApprovalCoordinator grants fake-mode TCC and app access', async () => {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  const logger = createLogger()
  const nativeHost = createNativeHost(config, logger)
  const localProvider = new LocalUiApprovalProvider(config, logger)
  const hostProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const coordinator = new ApprovalCoordinator(nativeHost, localProvider, hostProvider, logger)
  const session = createSessionContext({
    sessionId: 's1',
    connectionId: 'c1',
    approvalMode: 'local-ui',
  })

  const tcc = await coordinator.ensureTcc(session)
  assert.equal(tcc.accessibility, true)
  assert.equal(tcc.screenRecording, true)

  const access = await coordinator.ensureAppAccess(
    session,
    [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }],
    { clipboardWrite: true },
  )
  assert.equal(access.approved, true)
  assert.equal(session.allowedApps.length, 1)
})

test('ApprovalCoordinator can use host callback approvals in hybrid mode', async () => {
  process.env.COMPUTER_USE_FAKE = '1'
  const config = loadConfig()
  const logger = createLogger()
  const nativeHost = createNativeHost(config, logger)
  const localProvider = new LocalUiApprovalProvider(config, logger)
  const hostProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const coordinator = new ApprovalCoordinator(nativeHost, localProvider, hostProvider, logger)

  const connection: ClientConnection = {
    connectionId: 'c-host',
    transportName: 'stdio',
    metadata: {
      sessionId: 's-host',
      connectionId: 'c-host',
      approvalMode: 'hybrid',
      clientName: 'host-client',
      hostApprovalCapabilities: { appApproval: true, tccPromptRelay: true },
      transportName: 'stdio',
    },
    setMetadata() {},
    async request(method, params) {
      if (method === 'computer_use/request_tcc_approval') {
        return {
          acknowledged: true,
          recheckedState: { accessibility: true, screenRecording: true },
        }
      }
      if (method === 'computer_use/request_app_access') {
        const request = params as { requestedApps: Array<{ bundleId: string; displayName: string }>; requestedFlags: { clipboardRead: boolean; clipboardWrite: boolean; systemKeyCombos: boolean } }
        return {
          approved: true,
          grantedApps: request.requestedApps,
          deniedApps: [],
          effectiveFlags: request.requestedFlags,
        }
      }
      return {}
    },
    async notify() {},
    handleJsonRpcResponse() { return false },
    async close() {},
  }

  const session = createSessionContext({
    sessionId: 's-host',
    connectionId: 'c-host',
    approvalMode: 'hybrid',
    hostApprovalCapabilities: { appApproval: true, tccPromptRelay: true },
    connection,
  })

  const access = await coordinator.ensureAppAccess(
    session,
    [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }],
    { clipboardRead: true },
  )

  assert.equal(access.approved, true)
  assert.equal(session.allowedApps[0]?.bundleId, 'com.apple.TextEdit')
  assert.equal(session.grantFlags.clipboardRead, true)
})
