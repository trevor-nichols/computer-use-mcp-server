import type { AllowedApp, GrantFlags } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'

export interface RequestAccessArgs {
  apps?: AllowedApp[]
  flags?: Partial<GrantFlags>
}

export async function requestAccessTool(ctx: ToolExecutionContext, args: RequestAccessArgs) {
  const tccState = await ctx.runtime.approvalCoordinator.ensureTcc(ctx.session)

  let grantedApps = ctx.session.allowedApps
  let deniedApps: AllowedApp[] = []
  let effectiveFlags = ctx.session.grantFlags

  if ((args.apps?.length ?? 0) > 0 || args.flags) {
    const result = await ctx.runtime.approvalCoordinator.ensureAppAccess(
      ctx.session,
      args.apps ?? [],
      args.flags ?? {},
    )
    grantedApps = result.grantedApps
    deniedApps = result.deniedApps
    effectiveFlags = result.effectiveFlags
  }

  return {
    content: [{ type: 'text', text: 'Access state updated.' }],
    structuredContent: {
      ok: true,
      grantedApps,
      deniedApps,
      effectiveFlags,
      tccState,
    },
  }
}
