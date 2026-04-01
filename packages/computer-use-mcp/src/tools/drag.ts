import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import { mapScreenshotPointToDesktop } from '../transforms/coordinates.js'
import type { ActionExecutionContext } from './actionScope.js'
import { withActionScope } from './actionScope.js'
import { ensureAppUnderPointAllowed } from './frontmostGate.js'

export interface DragArgs {
  fromX?: number
  fromY?: number
  toX: number
  toY: number
}

export async function executeLeftClickDrag(
  ctx: ToolExecutionContext,
  args: DragArgs,
  scope: Pick<ActionExecutionContext, 'delayWithAbort' | 'throwIfAbortRequested'>,
) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.accessibility) {
    throw new MissingOsPermissionsError('Accessibility permission is required before left_click_drag can run.')
  }

  const start =
    typeof args.fromX === 'number' && typeof args.fromY === 'number'
      ? mapScreenshotPointToDesktop({ x: args.fromX, y: args.fromY }, ctx.session.lastScreenshotDims)
      : await ctx.runtime.nativeHost.input.getCursorPosition()
  const end = mapScreenshotPointToDesktop({ x: args.toX, y: args.toY }, ctx.session.lastScreenshotDims)

  await ensureAppUnderPointAllowed(ctx, start, 'left_click_drag start')
  await ensureAppUnderPointAllowed(ctx, end, 'left_click_drag end')

  await ctx.runtime.nativeHost.input.moveMouse(start.x, start.y)
  await scope.delayWithAbort(ctx.runtime.config.clickSettleMs)
  await ctx.runtime.nativeHost.input.mouseDown('left')

  try {
    const steps = Math.max(3, Math.round(ctx.runtime.config.dragAnimationMs / 16))
    for (let step = 1; step <= steps; step += 1) {
      await scope.throwIfAbortRequested()
      const progress = step / steps
      const x = start.x + (end.x - start.x) * progress
      const y = start.y + (end.y - start.y) * progress
      await ctx.runtime.nativeHost.input.moveMouse(x, y)
      await scope.delayWithAbort(Math.max(8, Math.round(ctx.runtime.config.dragAnimationMs / steps)))
    }
  } finally {
    await ctx.runtime.nativeHost.input.mouseUp('left')
  }

  return {
    content: [{ type: 'text', text: `Dragged cursor to (${Math.round(end.x)}, ${Math.round(end.y)}).` }],
    structuredContent: {
      ok: true,
      from: start,
      to: end,
    },
  }
}

export async function leftClickDragTool(ctx: ToolExecutionContext, args: DragArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
      hideDisallowedApps: ctx.runtime.config.hideDisallowedBeforeAction,
    },
    scope => executeLeftClickDrag(ctx, args, scope),
  )
}
