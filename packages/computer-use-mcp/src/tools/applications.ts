import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { PermissionDeniedError } from '../errors/errorTypes.js'
import { isAppAllowed } from '../permissions/appAllowlist.js'
import { withActionScope } from './actionScope.js'

export interface OpenApplicationArgs {
  bundleId: string
}

export async function executeOpenApplication(ctx: ToolExecutionContext, args: OpenApplicationArgs) {
  if (!isAppAllowed(ctx.session, args.bundleId)) {
    throw new PermissionDeniedError(`App ${args.bundleId} is not granted for this session. Call request_access first.`)
  }

  await ctx.runtime.nativeHost.apps.openApplication(args.bundleId)

  return {
    content: [{ type: 'text', text: `Opened ${args.bundleId}.` }],
    structuredContent: {
      ok: true,
      bundleId: args.bundleId,
    },
  }
}

export async function openApplicationTool(ctx: ToolExecutionContext, args: OpenApplicationArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
    },
    async () => executeOpenApplication(ctx, args),
  )
}

export async function listGrantedApplicationsTool(ctx: ToolExecutionContext) {
  return {
    content: [{ type: 'text', text: `${ctx.session.allowedApps.length} app grants available.` }],
    structuredContent: {
      ok: true,
      apps: ctx.session.allowedApps,
    },
  }
}
