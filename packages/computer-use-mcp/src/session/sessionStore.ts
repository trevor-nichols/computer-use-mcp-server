import { createSessionContext, type SessionContext } from './sessionContext.js'
import type { ApprovalMode, ClientConnection, HostApprovalCapabilities } from '../mcp/transport.js'

export class SessionStore {
  private readonly sessions = new Map<string, SessionContext>()

  getOrCreate(input: {
    sessionId: string
    hostSessionId?: string
    connectionId: string
    approvalMode: ApprovalMode
    clientId?: string
    clientName?: string
    hostApprovalCapabilities?: HostApprovalCapabilities
    connection?: ClientConnection
  }): SessionContext {
    const existing = this.sessions.get(input.sessionId)
    if (existing) {
      existing.lastSeenAt = new Date().toISOString()
      existing.connectionId = input.connectionId
      if (input.hostSessionId !== undefined) existing.hostSessionId = input.hostSessionId
      if (input.clientId !== undefined) existing.clientId = input.clientId
      if (input.clientName !== undefined) existing.clientName = input.clientName
      existing.approvalMode = input.approvalMode
      if (input.hostApprovalCapabilities) {
        existing.hostApprovalCapabilities = input.hostApprovalCapabilities
      }
      if (input.connection) {
        existing.connection = input.connection
      }
      return existing
    }

    const created = createSessionContext(input)
    this.sessions.set(input.sessionId, created)
    return created
  }

  get(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId)
  }

  update(sessionId: string, updater: (session: SessionContext) => void): SessionContext {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`)
    }
    updater(session)
    session.lastSeenAt = new Date().toISOString()
    return session
  }

  list(): SessionContext[] {
    return [...this.sessions.values()]
  }

  cleanupStaleOlderThan(maxAgeMs: number): string[] {
    const now = Date.now()
    const removed: string[] = []
    for (const [sessionId, session] of this.sessions) {
      const ageMs = now - Date.parse(session.lastSeenAt)
      if (ageMs > maxAgeMs) {
        this.sessions.delete(sessionId)
        removed.push(sessionId)
      }
    }
    return removed
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}
