import { toCallToolErrorResult } from '../errors/errorMapper.js'
import {
  resolveApprovalMode,
  resolveClientId,
  resolveClientName,
  resolveConnectionId,
  resolveHostSessionId,
  resolveHostApprovalCapabilities,
  resolveSessionId,
  type ToolExtra,
} from './sessionIdentity.js'
import type { SessionContext } from '../session/sessionContext.js'
import type { ServerRuntime } from './server.js'

export interface ToolExecutionContext {
  runtime: ServerRuntime
  session: SessionContext
  extra?: ToolExtra
}

export type ToolHandler<TArgs> = (ctx: ToolExecutionContext, args: TArgs) => Promise<unknown>

export function createToolHandler<TArgs>(runtime: ServerRuntime, handler: ToolHandler<TArgs>) {
  return async (args: TArgs, extra?: ToolExtra) => {
    const sessionId = resolveSessionId(extra)
    const connectionId = resolveConnectionId(extra)
    const session = runtime.sessionStore.getOrCreate({
      sessionId,
      hostSessionId: resolveHostSessionId(extra),
      connectionId,
      approvalMode: resolveApprovalMode(extra),
      clientId: resolveClientId(extra),
      clientName: resolveClientName(extra),
      hostApprovalCapabilities: resolveHostApprovalCapabilities(extra),
      connection: extra?.connection,
    })

    try {
      return await handler({ runtime, session, extra }, args)
    } catch (error) {
      runtime.logger.error('tool execution failed', {
        sessionId,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      })
      return toCallToolErrorResult(error)
    }
  }
}
