export const COMPUTER_USE_TCC_APPROVAL_METHOD = 'computer_use/request_tcc_approval'
export const COMPUTER_USE_APP_APPROVAL_METHOD = 'computer_use/request_app_access'

export interface TccApprovalPrompt {
  sessionId: string
  accessibilityRequired: boolean
  screenRecordingRequired: boolean
}

export interface AppApprovalPrompt {
  sessionId: string
  requestedApps: Array<{ bundleId: string; displayName: string; path?: string }>
  requestedFlags: {
    clipboardRead: boolean
    clipboardWrite: boolean
    systemKeyCombos: boolean
  }
}

export interface HostApprovalCallbacks {
  requestTccApproval?(prompt: TccApprovalPrompt): Promise<{
    acknowledged: boolean
    recheckedState?: {
      accessibility: boolean
      screenRecording: boolean
    }
  }>
  requestAppApproval?(prompt: AppApprovalPrompt): Promise<{
    approved: boolean
    grantedApps: AppApprovalPrompt['requestedApps']
    deniedApps: AppApprovalPrompt['requestedApps']
    effectiveFlags: AppApprovalPrompt['requestedFlags']
  }>
}

export function createHostApprovalCapabilityDescriptor(callbacks: HostApprovalCallbacks) {
  return {
    appApproval: typeof callbacks.requestAppApproval === 'function',
    tccPromptRelay: typeof callbacks.requestTccApproval === 'function',
  }
}
