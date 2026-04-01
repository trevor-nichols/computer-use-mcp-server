import { MissingOsPermissionsError, PermissionDeniedError, UnsupportedHostApprovalError, ApprovalProviderTimeoutError } from '../errors/errorTypes.js'
import type { Logger } from '../observability/logger.js'
import { mergeAllowedApps, mergeGrantFlags, requestedAppsStillMissing, requiresAdditionalFlags } from '../permissions/appAllowlist.js'
import { missingTccPermissions } from '../permissions/tcc.js'
import type { AllowedApp, GrantFlags, NativeHostAdapter, TccState } from '../native/bridgeTypes.js'
import type { SessionContext } from '../session/sessionContext.js'
import type { ApprovalProvider, AppAccessResult } from './approvalProvider.js'

export class ApprovalCoordinator {
  constructor(
    private readonly nativeHost: NativeHostAdapter,
    private readonly localProvider: ApprovalProvider,
    private readonly hostProvider: ApprovalProvider,
    private readonly logger: Logger,
  ) {}

  async ensureTcc(session: SessionContext): Promise<TccState> {
    const current = await this.nativeHost.tcc.getState()
    session.tccState = current
    if (missingTccPermissions(current).length === 0) {
      return current
    }

    session.pendingApproval = 'tcc'
    try {
      const provider = this.selectProvider(session, 'tcc')
      const result = await provider.requestTccApproval(session, {
        sessionId: session.sessionId,
        accessibilityRequired: !current.accessibility,
        screenRecordingRequired: !current.screenRecording,
      })

      if (!result.acknowledged) {
        throw new PermissionDeniedError('The user did not acknowledge the required macOS permissions.')
      }

      const rechecked = await this.nativeHost.tcc.getState()
      session.tccState = rechecked
      const missing = missingTccPermissions(rechecked)
      if (missing.length > 0) {
        throw new MissingOsPermissionsError(`Required macOS permissions are still missing: ${missing.join(', ')}`)
      }
      return rechecked
    } finally {
      session.pendingApproval = undefined
    }
  }

  async ensureAppAccess(
    session: SessionContext,
    requestedApps: AllowedApp[],
    requestedFlags: Partial<GrantFlags>,
  ): Promise<AppAccessResult> {
    await this.ensureTcc(session)

    const missingApps = requestedAppsStillMissing(session, requestedApps)
    const needsFlags = requiresAdditionalFlags(session, requestedFlags)
    const desiredFlags = mergeGrantFlags(session.grantFlags, requestedFlags)

    if (missingApps.length === 0 && !needsFlags) {
      return {
        approved: true,
        grantedApps: session.allowedApps,
        deniedApps: [],
        effectiveFlags: session.grantFlags,
      }
    }

    session.pendingApproval = 'app-access'
    try {
      const provider = this.selectProvider(session, 'app-access')
      const result = await provider.requestAppAccess(session, {
        sessionId: session.sessionId,
        requestedApps,
        requestedFlags: desiredFlags,
        currentTccState: session.tccState ?? (await this.nativeHost.tcc.getState()),
      })

      if (!result.approved) {
        throw new PermissionDeniedError('The user denied application access.')
      }

      session.allowedApps = mergeAllowedApps(session.allowedApps, result.grantedApps)
      session.grantFlags = mergeGrantFlags(session.grantFlags, result.effectiveFlags)

      return {
        approved: true,
        grantedApps: session.allowedApps,
        deniedApps: result.deniedApps,
        effectiveFlags: session.grantFlags,
      }
    } finally {
      session.pendingApproval = undefined
    }
  }

  private selectProvider(session: SessionContext, kind: 'tcc' | 'app-access'): ApprovalProvider {
    if (session.approvalMode === 'local-ui') {
      return this.localProvider
    }

    if (session.approvalMode === 'host-callback') {
      if (!this.hostProvider.supports(session, kind)) {
        throw new UnsupportedHostApprovalError('Host callback approval was requested, but the connected host did not advertise support.')
      }
      return this.hostProvider
    }

    if (this.hostProvider.supports(session, kind)) {
      return {
        name: 'hybrid-host-first',
        supports: () => true,
        requestTccApproval: async (hybridSession, req) => {
          try {
            return await this.hostProvider.requestTccApproval(hybridSession, req)
          } catch (error) {
            if (error instanceof UnsupportedHostApprovalError || error instanceof ApprovalProviderTimeoutError || error instanceof Error) {
              this.logger.warn('falling back to local TCC approval', { sessionId: hybridSession.sessionId, error: String(error) })
            }
            return this.localProvider.requestTccApproval(hybridSession, req)
          }
        },
        requestAppAccess: async (hybridSession, req) => {
          try {
            return await this.hostProvider.requestAppAccess(hybridSession, req)
          } catch (error) {
            if (error instanceof UnsupportedHostApprovalError || error instanceof ApprovalProviderTimeoutError || error instanceof Error) {
              this.logger.warn('falling back to local app approval', { sessionId: hybridSession.sessionId, error: String(error) })
            }
            return this.localProvider.requestAppAccess(hybridSession, req)
          }
        },
      }
    }

    return this.localProvider
  }
}
