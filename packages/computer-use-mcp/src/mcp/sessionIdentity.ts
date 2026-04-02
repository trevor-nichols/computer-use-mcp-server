import type { ApprovalMode, ClientConnection, HostApprovalCapabilities } from './transport.js'
import type { HostIdentity } from '../runtime/hostIdentity.js'

export interface ToolExtra {
  sessionId?: string
  hostSessionId?: string
  connectionId?: string
  clientId?: string
  clientName?: string
  hostIdentity?: HostIdentity
  approvalMode?: ApprovalMode
  hostApprovalCapabilities?: HostApprovalCapabilities
  connection?: ClientConnection
}

export function resolveSessionId(extra?: ToolExtra): string {
  return extra?.connection?.metadata.sessionId ?? extra?.sessionId ?? `stdio:${process.pid}`
}

export function resolveConnectionId(extra?: ToolExtra): string {
  return extra?.connection?.connectionId ?? extra?.connectionId ?? `stdio-connection:${process.pid}`
}

export function resolveHostSessionId(extra?: ToolExtra): string | undefined {
  return extra?.connection?.metadata.hostSessionId ?? extra?.hostSessionId
}

export function resolveApprovalMode(extra?: ToolExtra): ApprovalMode {
  return extra?.connection?.metadata.approvalMode ?? extra?.approvalMode ?? 'hybrid'
}

export function resolveClientId(extra?: ToolExtra): string | undefined {
  return extra?.connection?.metadata.clientId ?? extra?.clientId
}

export function resolveClientName(extra?: ToolExtra): string | undefined {
  return extra?.connection?.metadata.clientName ?? extra?.clientName
}

export function resolveHostIdentity(extra?: ToolExtra): HostIdentity | undefined {
  return extra?.connection?.metadata.hostIdentity ?? extra?.hostIdentity
}

export function resolveHostApprovalCapabilities(extra?: ToolExtra): HostApprovalCapabilities | undefined {
  return extra?.connection?.metadata.hostApprovalCapabilities ?? extra?.hostApprovalCapabilities
}
