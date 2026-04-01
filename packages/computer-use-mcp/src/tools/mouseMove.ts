import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import { mapScreenshotPointToDesktop } from '../transforms/coordinates.js'
import type { ActionExecutionContext } from './actionScope.js'
import { withActionScope } from './actionScope.js'

export interface MouseMoveArgs {
  x: number
  y: number
}

export async function executeMouseMove(ctx: ToolExecutionContext, args: MouseMoveArgs, scope: Pick<ActionExecutionContext, 'throwIfAbortRequested'>) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.accessibility) {
    throw new MissingOsPermissionsError('Accessibility permission is required before mouse_move can run.')
  }

  const mapped = mapScreenshotPointToDesktop({ x: args.x, y: args.y }, ctx.session.lastScreenshotDims)
  await scope.throwIfAbortRequested()
  await ctx.runtime.nativeHost.input.moveMouse(mapped.x, mapped.y)
  await scope.throwIfAbortRequested()
  return {
    content: [{ type: 'text', text: `Moved cursor to (${Math.round(mapped.x)}, ${Math.round(mapped.y)}).` }],
    structuredContent: {
      ok: true,
      x: mapped.x,
      y: mapped.y,
    },
  }
}

export async function mouseMoveTool(ctx: ToolExecutionContext, args: MouseMoveArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
      hideDisallowedApps: ctx.runtime.config.hideDisallowedBeforeAction,
    },
    scope => executeMouseMove(ctx, args, scope),
  )
}
