import { ClipboardGuardError } from '../errors/errorTypes.js'
import type { SessionContext } from '../session/sessionContext.js'
import type { NativeHostAdapter } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { withActionScope } from './actionScope.js'

export interface WriteClipboardArgs {
  text: string
}

export async function readClipboard(nativeHost: NativeHostAdapter, session: SessionContext): Promise<string> {
  if (!session.grantFlags.clipboardRead) {
    throw new ClipboardGuardError('Clipboard read is not granted for this session.')
  }
  return nativeHost.clipboard.readText()
}

export async function writeClipboard(nativeHost: NativeHostAdapter, session: SessionContext, text: string): Promise<void> {
  if (!session.grantFlags.clipboardWrite) {
    throw new ClipboardGuardError('Clipboard write is not granted for this session.')
  }
  await nativeHost.clipboard.writeText(text)
}

export async function readClipboardTool(ctx: ToolExecutionContext) {
  const text = await readClipboard(ctx.runtime.nativeHost, ctx.session)
  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      ok: true,
      text,
    },
  }
}

export async function writeClipboardTool(ctx: ToolExecutionContext, args: WriteClipboardArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
    },
    async () => {
      await writeClipboard(ctx.runtime.nativeHost, ctx.session, args.text)
      return {
        content: [{ type: 'text', text: 'Updated clipboard text.' }],
        structuredContent: {
          ok: true,
          text: args.text,
        },
      }
    },
  )
}
