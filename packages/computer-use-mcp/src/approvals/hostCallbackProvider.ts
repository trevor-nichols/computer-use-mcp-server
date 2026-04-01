import { ApprovalProviderTimeoutError, UnsupportedHostApprovalError } from '../errors/errorTypes.js'
import type { Logger } from '../observability/logger.js'
import type { SessionContext } from '../session/sessionContext.js'
import type {
  AppAccessRequest,
  AppAccessResult,
  ApprovalProvider,
  TccApprovalRequest,
  TccApprovalResult,
} from './approvalProvider.js'

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

export class HostCallbackApprovalProvider implements ApprovalProvider {
  readonly name = 'host-callback'

  constructor(
    private readonly timeoutMs: number,
    private readonly logger: Logger,
  ) {}

  supports(session: SessionContext, kind: 'tcc' | 'app-access'): boolean {
    if (!session.connection) return false
    const capabilities = session.hostApprovalCapabilities
    if (!capabilities) return false
    return kind === 'tcc' ? Boolean(capabilities.tccPromptRelay) : Boolean(capabilities.appApproval)
  }

  async requestTccApproval(session: SessionContext, req: TccApprovalRequest): Promise<TccApprovalResult> {
    if (!session.connection || !this.supports(session, 'tcc')) {
      throw new UnsupportedHostApprovalError('Host does not support relayed TCC prompts.')
    }

    try {
      const result = await session.connection.request('computer_use/request_tcc_approval', req, this.timeoutMs)
      const object = asObject(result)
      return {
        acknowledged: Boolean(object.acknowledged),
        recheckedState: object.recheckedState && typeof object.recheckedState === 'object'
          ? {
              accessibility: Boolean((object.recheckedState as Record<string, unknown>).accessibility),
              screenRecording: Boolean((object.recheckedState as Record<string, unknown>).screenRecording),
            }
          : undefined,
      }
    } catch (error) {
      this.logger.warn('host callback provider failed for TCC', error)
      throw new ApprovalProviderTimeoutError('Timed out waiting for host TCC approval response.')
    }
  }

  async requestAppAccess(session: SessionContext, req: AppAccessRequest): Promise<AppAccessResult> {
    if (!session.connection || !this.supports(session, 'app-access')) {
      throw new UnsupportedHostApprovalError('Host does not support relayed app approval prompts.')
    }

    try {
      const result = await session.connection.request('computer_use/request_app_access', req, this.timeoutMs)
      const object = asObject(result)
      const flags = asObject(object.effectiveFlags)
      return {
        approved: Boolean(object.approved),
        grantedApps: Array.isArray(object.grantedApps) ? (object.grantedApps as AppAccessResult['grantedApps']) : [],
        deniedApps: Array.isArray(object.deniedApps) ? (object.deniedApps as AppAccessResult['deniedApps']) : [],
        effectiveFlags: {
          clipboardRead: Boolean(flags.clipboardRead),
          clipboardWrite: Boolean(flags.clipboardWrite),
          systemKeyCombos: Boolean(flags.systemKeyCombos),
        },
      }
    } catch (error) {
      this.logger.warn('host callback provider failed for app access', error)
      throw new ApprovalProviderTimeoutError('Timed out waiting for host app approval response.')
    }
  }
}
