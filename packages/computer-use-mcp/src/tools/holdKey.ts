import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError, PermissionDeniedError } from '../errors/errorTypes.js'
import type { ActionExecutionContext } from './actionScope.js'
import { withActionScope } from './actionScope.js'

export interface HoldKeyArgs {
  keys: string[]
  durationMs: number
}

function keysContainEscape(keys: string[]): boolean {
  return keys.some(key => ['escape', 'esc'].includes(key.trim().toLowerCase()))
}

function keysRequireSystemCombos(keys: string[]): boolean {
  return keys.some(key => key.length > 1 || ['command', 'cmd', 'option', 'alt', 'control', 'ctrl', 'fn', 'tab'].includes(key.toLowerCase()))
}

export async function executeHoldKey(
  ctx: ToolExecutionContext,
  args: HoldKeyArgs,
  scope: Pick<ActionExecutionContext, 'delayWithAbort'>,
) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.accessibility) {
    throw new MissingOsPermissionsError('Accessibility permission is required before hold_key can run.')
  }

  if (keysRequireSystemCombos(args.keys) && !ctx.session.grantFlags.systemKeyCombos) {
    throw new PermissionDeniedError('System key combinations are not granted for this session.')
  }

  if (keysContainEscape(args.keys)) {
    await ctx.runtime.nativeHost.hotkeys.markExpectedEscape(ctx.session.sessionId, 1_000)
  }

  const pressed: string[] = []
  try {
    for (const key of args.keys) {
      await ctx.runtime.nativeHost.input.keyDown(key)
      pressed.push(key)
    }
    await scope.delayWithAbort(args.durationMs)
  } finally {
    for (const key of pressed.reverse()) {
      await ctx.runtime.nativeHost.input.keyUp(key).catch(() => undefined)
    }
  }

  return {
    content: [{ type: 'text', text: `Held ${args.keys.join(', ')} for ${args.durationMs}ms.` }],
    structuredContent: {
      ok: true,
      keys: args.keys,
      durationMs: args.durationMs,
    },
  }
}

export async function holdKeyTool(ctx: ToolExecutionContext, args: HoldKeyArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
      hideDisallowedApps: ctx.runtime.config.hideDisallowedBeforeAction,
    },
    scope => executeHoldKey(ctx, args, scope),
  )
}
