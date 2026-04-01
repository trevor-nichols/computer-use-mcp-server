import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { ClipboardGuardError, MissingOsPermissionsError } from '../errors/errorTypes.js'
import { readClipboard, writeClipboard } from './clipboard.js'
import type { ActionExecutionContext } from './actionScope.js'
import { withActionScope } from './actionScope.js'

export interface TypeArgs {
  text: string
  viaClipboard?: boolean
}

export async function executeTypeText(
  ctx: ToolExecutionContext,
  args: TypeArgs,
  scope: Pick<ActionExecutionContext, 'delayWithAbort'>,
) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.accessibility) {
    throw new MissingOsPermissionsError('Accessibility permission is required before type can run.')
  }

  if (args.viaClipboard ?? true) {
    if (!ctx.session.grantFlags.clipboardWrite) {
      throw new ClipboardGuardError('Clipboard write is not granted for this session.')
    }

    let saved: string | undefined
    if (ctx.session.grantFlags.clipboardRead) {
      try {
        saved = await readClipboard(ctx.runtime.nativeHost, ctx.session)
      } catch {
        saved = undefined
      }
    }

    try {
      await writeClipboard(ctx.runtime.nativeHost, ctx.session, args.text)
      const roundTrip = await ctx.runtime.nativeHost.clipboard.readText().catch(() => '')
      if (roundTrip !== args.text) {
        throw new ClipboardGuardError('Clipboard write did not round-trip.')
      }

      await scope.delayWithAbort(ctx.runtime.config.clipboardSyncDelayMs)
      await ctx.runtime.nativeHost.input.keySequence('command+v')
      await scope.delayWithAbort(ctx.runtime.config.clipboardPasteSettleMs)
    } finally {
      if (typeof saved === 'string') {
        await ctx.runtime.nativeHost.clipboard.writeText(saved).catch(() => undefined)
      }
    }
  } else {
    await ctx.runtime.nativeHost.input.typeText(args.text)
  }

  return {
    content: [{ type: 'text', text: 'Typed text into the focused UI.' }],
    structuredContent: {
      ok: true,
      viaClipboard: args.viaClipboard ?? true,
    },
  }
}

export async function typeTextTool(ctx: ToolExecutionContext, args: TypeArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
      hideDisallowedApps: ctx.runtime.config.hideDisallowedBeforeAction,
    },
    scope => executeTypeText(ctx, args, scope),
  )
}
