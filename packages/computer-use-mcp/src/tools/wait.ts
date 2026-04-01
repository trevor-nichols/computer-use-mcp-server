import type { ToolExecutionContext } from '../mcp/callRouter.js'
import type { ActionExecutionContext } from './actionScope.js'
import { withActionScope } from './actionScope.js'

export interface WaitArgs {
  durationMs: number
}

export async function executeWait(
  _ctx: ToolExecutionContext,
  args: WaitArgs,
  scope: Pick<ActionExecutionContext, 'delayWithAbort'>,
) {
  await scope.delayWithAbort(args.durationMs)
  return {
    content: [{ type: 'text', text: `Waited ${args.durationMs}ms.` }],
    structuredContent: {
      ok: true,
      durationMs: args.durationMs,
    },
  }
}

export async function waitTool(ctx: ToolExecutionContext, args: WaitArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
    },
    scope => executeWait(ctx, args, scope),
  )
}
