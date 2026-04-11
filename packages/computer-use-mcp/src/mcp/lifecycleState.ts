export type LifecyclePhase = 'pre_initialize' | 'initialize_responded' | 'ready' | 'closed'

export interface ProtocolState {
  phase: LifecyclePhase
  initializeSeen: boolean
  initializedSeen: boolean
  negotiatedProtocolVersion?: string
}

export function createProtocolState(): ProtocolState {
  return {
    phase: 'pre_initialize',
    initializeSeen: false,
    initializedSeen: false,
  }
}
