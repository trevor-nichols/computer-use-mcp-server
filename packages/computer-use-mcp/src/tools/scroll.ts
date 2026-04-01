import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import { mapScreenshotPointToDesktop } from '../transforms/coordinates.js'
import type { ActionExecutionContext } from './actionScope.js'
import { withActionScope } from './actionScope.js'

export interface ScrollArgs {
  x: number
  y: number
  dx: number
  dy: number
}

export async function executeScroll(
  ctx: ToolExecutionContext,
  args: ScrollArgs,
  scope: Pick<ActionExecutionContext, 'throwIfAbortRequested'>,
) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.accessibility) {
    throw new MissingOsPermissionsError('Accessibility permission is required before scroll can run.')
  }

  const mapped = mapScreenshotPointToDesktop({ x: args.x, y: args.y }, ctx.session.lastScreenshotDims)
  await ctx.runtime.nativeHost.input.moveMouse(mapped.x, mapped.y)
  await scope.throwIfAbortRequested()
  await ctx.runtime.nativeHost.input.scroll(args.dx, args.dy)
  await scope.throwIfAbortRequested()

  return {
    content: [{ type: 'text', text: `Scrolled at (${Math.round(mapped.x)}, ${Math.round(mapped.y)}).` }],
    structuredContent: {
      ok: true,
      x: mapped.x,
      y: mapped.y,
      dx: args.dx,
      dy: args.dy,
    },
  }
}

export async function scrollTool(ctx: ToolExecutionContext, args: ScrollArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
      hideDisallowedApps: ctx.runtime.config.hideDisallowedBeforeAction,
    },
    scope => executeScroll(ctx, args, scope),
  )
}
