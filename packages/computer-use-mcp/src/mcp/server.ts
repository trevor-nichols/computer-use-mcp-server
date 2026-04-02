import type { RuntimeConfig } from '../config.js'
import type { ApprovalCoordinator } from '../approvals/approvalCoordinator.js'
import type { DesktopLockManager } from '../session/lock.js'
import type { SessionStore } from '../session/sessionStore.js'
import type { NativeHostAdapter } from '../native/bridgeTypes.js'
import type { Logger } from '../observability/logger.js'
import type { CaptureAssetStore } from '../assets/captureAssetStore.js'
import { failure, success, type JsonRpcRequest, type JsonRpcResponse } from './jsonRpc.js'
import { createToolDefinitions } from './toolRegistry.js'
import type { ToolExtra } from './sessionIdentity.js'
import type { ApprovalMode, ClientConnection, HostApprovalCapabilities } from './transport.js'
import { parseHostIdentityFromInitialize } from '../runtime/hostIdentity.js'

export interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  annotations?: Record<string, unknown>
  handler: (args: any, extra?: ToolExtra) => Promise<any>
}

export interface ServerRuntime {
  config: RuntimeConfig
  sessionStore: SessionStore
  lockManager: DesktopLockManager
  approvalCoordinator: ApprovalCoordinator
  nativeHost: NativeHostAdapter
  captureAssetStore: CaptureAssetStore
  logger: Logger
}

export class ComputerUseMcpServer {
  private readonly tools: ToolDefinition[]

  constructor(private readonly runtime: ServerRuntime) {
    this.tools = createToolDefinitions(runtime)
  }

  async handle(message: JsonRpcRequest, connection?: ClientConnection): Promise<JsonRpcResponse | undefined> {
    const extra: ToolExtra | undefined = connection
      ? {
          connection,
          sessionId: connection.metadata.sessionId,
          hostSessionId: connection.metadata.hostSessionId,
          connectionId: connection.connectionId,
          clientId: connection.metadata.clientId,
          clientName: connection.metadata.clientName,
          hostIdentity: connection.metadata.hostIdentity,
          approvalMode: connection.metadata.approvalMode,
          hostApprovalCapabilities: connection.metadata.hostApprovalCapabilities,
        }
      : undefined

    switch (message.method) {
      case 'initialize': {
        this.applyInitializeMetadata(message, connection)
        return success(message.id ?? null, {
          protocolVersion: this.resolveNegotiatedProtocolVersion(message),
          capabilities: {
            tools: {
              listChanged: false,
            },
            experimental: {
              computerUseApprovalRequests: {
                tccMethod: 'computer_use/request_tcc_approval',
                appMethod: 'computer_use/request_app_access',
              },
            },
          },
          serverInfo: {
            name: this.runtime.config.serverName,
            version: this.runtime.config.serverVersion,
          },
        })
      }

      case 'notifications/initialized':
        return undefined

      case 'ping':
        return success(message.id ?? null, {})

      case 'tools/list':
        return success(message.id ?? null, {
          tools: this.tools.map(tool => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            annotations: tool.annotations,
          })),
        })

      case 'tools/call': {
        const params = asObject(message.params)
        const toolName = typeof params.name === 'string' ? params.name : ''
        const args = asObject(params.arguments)
        const tool = this.tools.find(item => item.name === toolName)
        if (!tool) {
          return failure(message.id ?? null, -32601, `Unknown tool: ${toolName}`)
        }
        const result = await tool.handler(args, extra)
        return success(message.id ?? null, result)
      }

      default:
        if (message.id === undefined) return undefined
        return failure(message.id ?? null, -32601, `Unknown method: ${message.method}`)
    }
  }

  private resolveNegotiatedProtocolVersion(message: JsonRpcRequest): string {
    const params = asObject(message.params)
    const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : this.runtime.config.protocolVersion
    if (this.runtime.config.supportedProtocolVersions.includes(requested)) {
      return requested
    }
    return this.runtime.config.protocolVersion
  }

  private applyInitializeMetadata(message: JsonRpcRequest, connection?: ClientConnection): void {
    if (!connection) return

    const params = asObject(message.params)
    const clientInfo = asObject(params.clientInfo)
    const capabilities = asObject(params.capabilities)
    const experimental = asObject(params.experimental)
    const capabilitiesExperimental = asObject(capabilities.experimental)
    const callbackCaps = asObject(capabilitiesExperimental.computerUseApprovalCallbacks ?? experimental.computerUseApprovalCallbacks)
    const requestedMode = (experimental.computerUseApprovalMode ?? capabilitiesExperimental.computerUseApprovalMode) as ApprovalMode | undefined
    const requestedSessionId = typeof experimental.sessionId === 'string' ? experimental.sessionId : undefined
    const hostIdentity = parseHostIdentityFromInitialize(experimental, capabilitiesExperimental)

    const hostApprovalCapabilities: HostApprovalCapabilities = {
      appApproval: Boolean(callbackCaps.appApproval),
      tccPromptRelay: Boolean(callbackCaps.tccPromptRelay),
    }

    connection.setMetadata({
      hostSessionId: requestedSessionId,
      clientId: typeof experimental.clientId === 'string' ? experimental.clientId : connection.metadata.clientId,
      clientName: typeof clientInfo.name === 'string' ? clientInfo.name : connection.metadata.clientName,
      hostIdentity,
      approvalMode: requestedMode ?? (hostApprovalCapabilities.appApproval || hostApprovalCapabilities.tccPromptRelay ? 'hybrid' : this.runtime.config.approvalDefaultMode),
      hostApprovalCapabilities,
    })
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}
