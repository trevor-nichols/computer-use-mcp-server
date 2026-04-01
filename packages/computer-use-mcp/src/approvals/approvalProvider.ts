import type { AllowedApp, GrantFlags, TccState } from '../native/bridgeTypes.js'
import type { SessionContext } from '../session/sessionContext.js'

export interface AppAccessRequest {
  sessionId: string
  requestedApps: AllowedApp[]
  requestedFlags: GrantFlags
  currentTccState: TccState
}

export interface AppAccessResult {
  approved: boolean
  grantedApps: AllowedApp[]
  deniedApps: AllowedApp[]
  effectiveFlags: GrantFlags
}

export interface TccApprovalRequest {
  sessionId: string
  accessibilityRequired: boolean
  screenRecordingRequired: boolean
}

export interface TccApprovalResult {
  acknowledged: boolean
  recheckedState?: TccState
}

export interface ApprovalProvider {
  readonly name: string
  supports(session: SessionContext, kind: 'tcc' | 'app-access'): boolean
  requestTccApproval(session: SessionContext, req: TccApprovalRequest): Promise<TccApprovalResult>
  requestAppAccess(session: SessionContext, req: AppAccessRequest): Promise<AppAccessResult>
}
