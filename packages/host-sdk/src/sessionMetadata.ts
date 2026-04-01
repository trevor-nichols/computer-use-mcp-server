import type { HostApprovalCallbacks } from './approvalCallbacks.js'
import { createHostApprovalCapabilityDescriptor } from './approvalCallbacks.js'

export interface HostSessionMetadata {
  sessionId?: string
  clientId?: string
  clientName?: string
  hostName?: string
  approvalMode?: 'local-ui' | 'host-callback' | 'hybrid'
  capabilities?: {
    appApproval?: boolean
    tccPromptRelay?: boolean
  }
}

export function buildInitializeExperimental(metadata: HostSessionMetadata, callbacks?: HostApprovalCallbacks) {
  return {
    sessionId: metadata.sessionId,
    clientId: metadata.clientId,
    computerUseApprovalMode: metadata.approvalMode,
    computerUseApprovalCallbacks: callbacks ? createHostApprovalCapabilityDescriptor(callbacks) : metadata.capabilities,
  }
}
