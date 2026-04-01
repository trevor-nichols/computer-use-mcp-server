import { randomUUID } from 'node:crypto'
import type { JsonRpcRequest, JsonRpcResponse } from './jsonRpc.js'

export type ApprovalMode = 'local-ui' | 'host-callback' | 'hybrid'

export interface HostApprovalCapabilities {
  appApproval: boolean
  tccPromptRelay: boolean
}

export interface ConnectionMetadata {
  sessionId: string
  hostSessionId?: string
  connectionId: string
  clientId?: string
  clientName?: string
  approvalMode: ApprovalMode
  hostApprovalCapabilities: HostApprovalCapabilities
  transportName: string
}

export interface ClientConnection {
  readonly connectionId: string
  readonly transportName: string
  readonly metadata: ConnectionMetadata
  setMetadata(update: Partial<Omit<ConnectionMetadata, 'connectionId' | 'transportName'>>): void
  request(method: string, params?: unknown, timeoutMs?: number): Promise<unknown>
  notify(method: string, params?: unknown): Promise<void>
  handleJsonRpcResponse(message: JsonRpcResponse): boolean
  close(): Promise<void>
}

export interface TransportAdapter {
  readonly name: string
  start(): Promise<void>
  stop(): Promise<void>
}

interface PendingServerRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

export function createDefaultHostApprovalCapabilities(): HostApprovalCapabilities {
  return {
    appApproval: false,
    tccPromptRelay: false,
  }
}

export abstract class BaseClientConnection implements ClientConnection {
  readonly metadata: ConnectionMetadata
  private readonly pending = new Map<string, PendingServerRequest>()

  protected constructor(
    public readonly connectionId: string,
    public readonly transportName: string,
    sessionId: string,
  ) {
    this.metadata = {
      sessionId,
      connectionId,
      approvalMode: 'hybrid',
      hostApprovalCapabilities: createDefaultHostApprovalCapabilities(),
      transportName,
    }
  }

  setMetadata(update: Partial<Omit<ConnectionMetadata, 'connectionId' | 'transportName'>>): void {
    if (update.sessionId) {
      this.metadata.sessionId = update.sessionId
    }
    if (update.hostSessionId !== undefined) {
      this.metadata.hostSessionId = update.hostSessionId
    }
    if (update.clientId !== undefined) {
      this.metadata.clientId = update.clientId
    }
    if (update.clientName !== undefined) {
      this.metadata.clientName = update.clientName
    }
    if (update.approvalMode) {
      this.metadata.approvalMode = update.approvalMode
    }
    if (update.hostApprovalCapabilities) {
      this.metadata.hostApprovalCapabilities = {
        ...this.metadata.hostApprovalCapabilities,
        ...update.hostApprovalCapabilities,
      }
    }
  }

  async request(method: string, params?: unknown, timeoutMs = 10_000): Promise<unknown> {
    const id = `server:${randomUUID()}`
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Client callback timed out for ${method}`))
      }, timeoutMs)

      this.pending.set(id, { resolve, reject, timer })
      this.sendOutbound(payload).catch(error => {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error)
      })
    })
  }

  async notify(method: string, params?: unknown): Promise<void> {
    await this.sendOutbound({
      jsonrpc: '2.0',
      method,
      params,
    })
  }

  handleJsonRpcResponse(message: JsonRpcResponse): boolean {
    const key = String(message.id)
    const pending = this.pending.get(key)
    if (!pending) {
      return false
    }

    clearTimeout(pending.timer)
    this.pending.delete(key)

    if (message.error) {
      pending.reject(new Error(message.error.message))
    } else {
      pending.resolve(message.result)
    }

    return true
  }

  async close(): Promise<void> {
    for (const [key, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(`Connection ${this.connectionId} closed while waiting for ${key}`))
    }
    this.pending.clear()
    await this.closeTransport()
  }

  protected abstract sendOutbound(message: JsonRpcRequest): Promise<void>
  protected abstract closeTransport(): Promise<void>
}
