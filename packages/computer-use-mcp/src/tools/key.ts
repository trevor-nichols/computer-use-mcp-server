import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError, PermissionDeniedError } from '../errors/errorTypes.js'
import type { ActionExecutionContext } from './actionScope.js'
import { sequenceContainsEscape, sequenceRequiresSystemKeyCombos, withActionScope } from './actionScope.js'
import { ensureFrontmostAppAllowed } from './frontmostGate.js'

export interface KeyArgs {
  sequence: string
  repeat?: number
}

export async function executeKey(
  ctx: ToolExecutionContext,
  args: KeyArgs,
  scope: Pick<ActionExecutionContext, 'delayWithAbort'>,
) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.accessibility) {
    throw new MissingOsPermissionsError('Accessibility permission is required before key can run.')
  }

  if (sequenceRequiresSystemKeyCombos(args.sequence) && !ctx.session.grantFlags.systemKeyCombos) {
    throw new PermissionDeniedError('System key combinations are not granted for this session.')
  }

  await ensureFrontmostAppAllowed(ctx, 'key')

  const repeat = Math.max(1, Math.min(20, args.repeat ?? 1))
  if (sequenceContainsEscape(args.sequence)) {
    await ctx.runtime.nativeHost.hotkeys.markExpectedEscape(ctx.session.sessionId, 1_000)
  }

  for (let index = 0; index < repeat; index += 1) {
    await ctx.runtime.nativeHost.input.keySequence(args.sequence)
    if (index + 1 < repeat) {
      await scope.delayWithAbort(25)
    }
  }

  return {
    content: [{ type: 'text', text: `Sent key sequence ${args.sequence}.` }],
    structuredContent: {
      ok: true,
      sequence: args.sequence,
      repeat,
    },
  }
}

export async function keyTool(ctx: ToolExecutionContext, args: KeyArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
      hideDisallowedApps: ctx.runtime.config.hideDisallowedBeforeAction,
    },
    scope => executeKey(ctx, args, scope),
  )
}
