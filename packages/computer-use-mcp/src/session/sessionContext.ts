import type { AllowedApp, GrantFlags, ScreenshotDims, TccState } from '../native/bridgeTypes.js'
import type { ApprovalMode, ClientConnection, HostApprovalCapabilities } from '../mcp/transport.js'

export interface SessionContext {
  sessionId: string
  hostSessionId?: string
  clientId?: string
  clientName?: string
  connectionId: string
  startedAt: string
  lastSeenAt: string
  allowedApps: AllowedApp[]
  grantFlags: GrantFlags
  selectedDisplayId?: number
  displayPinnedByModel: boolean
  displayResolvedForAppsKey?: string
  lastScreenshotDims?: ScreenshotDims
  hiddenDuringTurn: Set<string>
  tccState?: TccState
  approvalMode: ApprovalMode
  hostApprovalCapabilities?: HostApprovalCapabilities
  pendingApproval?: 'tcc' | 'app-access'
  connection?: ClientConnection
}

export function createDefaultGrantFlags(): GrantFlags {
  return {
    clipboardRead: false,
    clipboardWrite: false,
    systemKeyCombos: false,
  }
}

export function createSessionContext(input: {
  sessionId: string
  hostSessionId?: string
  connectionId: string
  approvalMode: ApprovalMode
  clientId?: string
  clientName?: string
  hostApprovalCapabilities?: HostApprovalCapabilities
  connection?: ClientConnection
}): SessionContext {
  const now = new Date().toISOString()
  return {
    sessionId: input.sessionId,
    hostSessionId: input.hostSessionId,
    clientId: input.clientId,
    clientName: input.clientName,
    connectionId: input.connectionId,
    startedAt: now,
    lastSeenAt: now,
    allowedApps: [],
    grantFlags: createDefaultGrantFlags(),
    displayPinnedByModel: false,
    hiddenDuringTurn: new Set<string>(),
    approvalMode: input.approvalMode,
    hostApprovalCapabilities: input.hostApprovalCapabilities,
    connection: input.connection,
  }
}
