import type { RuntimeConfig } from '../config.js'
import type { ApprovalCoordinator } from '../approvals/approvalCoordinator.js'
import type { DesktopLockManager } from '../session/lock.js'
import type { SessionStore } from '../session/sessionStore.js'
import type { NativeHostAdapter } from '../native/bridgeTypes.js'
import type { Logger } from '../observability/logger.js'
import type { CaptureAssetStore } from '../assets/captureAssetStore.js'
import { failure, success, type JsonRpcNotification, type JsonRpcRequest, type JsonRpcResponse } from './jsonRpc.js'
import { createToolDefinitions } from './toolRegistry.js'
import type { ToolExtra } from './sessionIdentity.js'
import type { ApprovalMode, ClientConnection, HostApprovalCapabilities } from './transport.js'
import { parseHostIdentityFromInitialize } from '../runtime/hostIdentity.js'
import { compileSchemaValidator, type CompiledSchemaValidator, type JsonSchemaObject, type ValidationIssue } from './schemaValidator.js'
import { initializedNotificationParamsSchema, initializeParamsSchema, toolsCallParamsSchema, toolsListParamsSchema } from './protocolSchemas.js'
import { toCallToolErrorResult } from '../errors/errorMapper.js'
import { ToolInputValidationError } from '../errors/errorTypes.js'
import { NotificationRejectedError } from './protocolErrors.js'

export interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: JsonSchemaObject
  outputSchema?: JsonSchemaObject
  annotations?: Record<string, unknown>
  handler: (args: any, extra?: ToolExtra) => Promise<any>
  inputValidator?: CompiledSchemaValidator
  outputValidator?: CompiledSchemaValidator
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

const initializeValidator = compileSchemaValidator(initializeParamsSchema)
const initializedNotificationValidator = compileSchemaValidator(initializedNotificationParamsSchema)
const toolsListValidator = compileSchemaValidator(toolsListParamsSchema)
const toolsCallValidator = compileSchemaValidator(toolsCallParamsSchema)

export class ComputerUseMcpServer {
  private readonly tools: ToolDefinition[]
  private readonly toolMap: Map<string, ToolDefinition>

  constructor(private readonly runtime: ServerRuntime) {
    this.tools = createToolDefinitions(runtime).map(tool => ({
      ...tool,
      inputValidator: compileSchemaValidator(tool.inputSchema),
      outputValidator: tool.outputSchema ? compileSchemaValidator(tool.outputSchema) : undefined,
    }))
    this.toolMap = new Map(this.tools.map(tool => [tool.name, tool]))
  }

  async handleRequest(message: JsonRpcRequest, connection: ClientConnection): Promise<JsonRpcResponse> {
    const extra = buildToolExtra(connection)

    switch (message.method) {
      case 'initialize':
        return this.handleInitializeRequest(message, connection)

      case 'notifications/initialized':
        return failure(message.id, -32600, 'notifications/initialized must be sent as a notification.')

      case 'ping':
        return success(message.id, {})

      case 'tools/list':
        if (!isReady(connection)) {
          return failure(message.id, -32600, readinessErrorMessage(connection))
        }
        return this.handleToolsListRequest(message)

      case 'tools/call':
        if (!isReady(connection)) {
          return failure(message.id, -32600, readinessErrorMessage(connection))
        }
        return this.handleToolsCallRequest(message, extra)

      default:
        if (!isReady(connection) && message.method !== 'ping') {
          return failure(message.id, -32600, readinessErrorMessage(connection))
        }
        return failure(message.id, -32601, `Unknown method: ${message.method}`)
    }
  }

  async handleNotification(message: JsonRpcNotification, connection: ClientConnection): Promise<void> {
    switch (message.method) {
      case 'initialize':
        throw new NotificationRejectedError('initialize must be sent as a request.', 400, -32600)

      case 'notifications/initialized': {
        if (connection.protocolState.phase !== 'initialize_responded') {
          throw new NotificationRejectedError(
            'notifications/initialized is only valid after a successful initialize response.',
            400,
            -32600,
          )
        }

        const validation = initializedNotificationValidator.validate(asObject(message.params))
        if (!validation.valid) {
          throw new NotificationRejectedError('Invalid notifications/initialized params.', 400, -32600, { issues: validation.issues })
        }

        connection.markReady()
        return
      }

      default:
        if (!message.method.startsWith('notifications/')) {
          throw new NotificationRejectedError(`Method ${message.method} must be sent as a request.`, 400, -32600)
        }
        return
    }
  }

  private handleInitializeRequest(message: JsonRpcRequest, connection: ClientConnection): JsonRpcResponse {
    if (connection.protocolState.phase !== 'pre_initialize' || connection.protocolState.initializeSeen) {
      return failure(message.id, -32600, 'initialize must be the first request and may only be sent once per connection.')
    }

    const validation = initializeValidator.validate(asObject(message.params))
    if (!validation.valid) {
      return failure(message.id, -32602, 'Invalid initialize params.', { issues: validation.issues })
    }

    const negotiatedProtocolVersion = this.resolveNegotiatedProtocolVersion(message)
    this.applyInitializeMetadata(message, connection)
    connection.markInitializeResponded(negotiatedProtocolVersion)

    return success(message.id, {
      protocolVersion: negotiatedProtocolVersion,
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

  private handleToolsListRequest(message: JsonRpcRequest): JsonRpcResponse {
    const validation = toolsListValidator.validate(asObject(message.params))
    if (!validation.valid) {
      return failure(message.id, -32602, 'Invalid tools/list params.', { issues: validation.issues })
    }

    return success(message.id, {
      tools: this.tools.map(tool => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      })),
    })
  }

  private async handleToolsCallRequest(message: JsonRpcRequest, extra: ToolExtra | undefined): Promise<JsonRpcResponse> {
    const validation = toolsCallValidator.validate(asObject(message.params))
    if (!validation.valid) {
      return failure(message.id, -32602, 'Invalid tools/call params.', { issues: validation.issues })
    }

    const params = asObject(message.params)
    const toolName = String(params.name)
    const tool = this.toolMap.get(toolName)
    if (!tool) {
      return failure(message.id, -32602, `Unknown tool: ${toolName}`)
    }

    const rawArguments = params.arguments === undefined ? {} : params.arguments
    const inputValidation = tool.inputValidator!.validate(rawArguments)
    if (!inputValidation.valid) {
      return success(message.id, toCallToolErrorResult(new ToolInputValidationError(formatValidationIssues(inputValidation.issues))))
    }

    const result = await tool.handler(rawArguments, extra)

    if (tool.outputValidator && !isToolErrorResult(result) && hasStructuredContent(result)) {
      const outputValidation = tool.outputValidator.validate(result.structuredContent)
      if (!outputValidation.valid) {
        this.runtime.logger.error('tool returned structuredContent that does not satisfy outputSchema', {
          tool: tool.name,
          issues: outputValidation.issues,
        })
        return failure(message.id, -32603, `Tool ${tool.name} returned invalid structuredContent for its outputSchema.`, {
          issues: outputValidation.issues,
        })
      }
    }

    return success(message.id, result)
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

function buildToolExtra(connection?: ClientConnection): ToolExtra | undefined {
  if (!connection) return undefined

  return {
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
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function isReady(connection?: ClientConnection): boolean {
  return connection?.protocolState.phase === 'ready'
}

function readinessErrorMessage(connection?: ClientConnection): string {
  const phase = connection?.protocolState.phase ?? 'pre_initialize'
  if (phase === 'pre_initialize') {
    return 'Server is not initialized. Send initialize first.'
  }
  if (phase === 'initialize_responded') {
    return 'Server is waiting for notifications/initialized before normal operations.'
  }
  if (phase === 'closed') {
    return 'Connection is closed.'
  }
  return 'Server is not ready to process this request.'
}

function hasStructuredContent(value: unknown): value is { structuredContent: unknown } {
  return typeof value === 'object' && value !== null && 'structuredContent' in value
}

function isToolErrorResult(value: unknown): value is { isError: true } {
  return typeof value === 'object' && value !== null && (value as { isError?: unknown }).isError === true
}

function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues
    .map(issue => `${issue.instancePath} ${issue.message}`.trim())
    .join('; ')
}
