import type { MouseButton } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import { mapScreenshotPointToDesktop } from '../transforms/coordinates.js'
import type { ActionExecutionContext } from './actionScope.js'
import { withActionScope } from './actionScope.js'
import { ensureAppUnderPointAllowed } from './frontmostGate.js'

export interface ClickArgs {
  x: number
  y: number
}

export async function leftClickTool(ctx: ToolExecutionContext, args: ClickArgs) {
  return performClick(ctx, args, 'left', 1)
}

export async function rightClickTool(ctx: ToolExecutionContext, args: ClickArgs) {
  return performClick(ctx, args, 'right', 1)
}

export async function middleClickTool(ctx: ToolExecutionContext, args: ClickArgs) {
  return performClick(ctx, args, 'middle', 1)
}

export async function doubleClickTool(ctx: ToolExecutionContext, args: ClickArgs) {
  return performClick(ctx, args, 'left', 2)
}

export async function tripleClickTool(ctx: ToolExecutionContext, args: ClickArgs) {
  return performClick(ctx, args, 'left', 3)
}

export async function performClick(
  ctx: ToolExecutionContext,
  args: ClickArgs,
  button: MouseButton,
  count: 1 | 2 | 3,
  scope?: Pick<ActionExecutionContext, 'delayWithAbort' | 'throwIfAbortRequested'>,
) {
  const execute = async (helpers: Pick<ActionExecutionContext, 'delayWithAbort' | 'throwIfAbortRequested'>) => {
    const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
    if (!tccState.accessibility) {
      throw new MissingOsPermissionsError(`Accessibility permission is required before ${button}_click can run.`)
    }

    const mapped = mapScreenshotPointToDesktop({ x: args.x, y: args.y }, ctx.session.lastScreenshotDims)
    await ensureAppUnderPointAllowed(ctx, mapped, `${button}_click`)
    await helpers.throwIfAbortRequested()
    await ctx.runtime.nativeHost.input.moveMouse(mapped.x, mapped.y)
    await helpers.delayWithAbort(ctx.runtime.config.clickSettleMs)
    await ctx.runtime.nativeHost.input.click(button, count)
    await helpers.throwIfAbortRequested()

    return {
      content: [{ type: 'text', text: `Clicked at (${Math.round(mapped.x)}, ${Math.round(mapped.y)}).` }],
      structuredContent: {
        ok: true,
        x: mapped.x,
        y: mapped.y,
        button,
        count,
      },
    }
  }

  if (scope) {
    return execute(scope)
  }

  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
      hideDisallowedApps: ctx.runtime.config.hideDisallowedBeforeAction,
    },
    execute,
  )
}
