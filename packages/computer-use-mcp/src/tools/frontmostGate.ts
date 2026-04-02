import { TargetApplicationDeniedError, TargetApplicationResolutionError } from '../errors/errorTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { isAppAllowed } from '../permissions/appAllowlist.js'
import type { CursorPosition, RunningAppInfo } from '../native/bridgeTypes.js'

function shouldEnforceTargetAppGate(ctx: ToolExecutionContext): boolean {
  return ctx.session.allowedApps.length > 0
}

function allowedBundleIds(ctx: ToolExecutionContext): string[] {
  return ctx.session.allowedApps.map(app => app.bundleId)
}

function isResolvedHostApp(ctx: ToolExecutionContext, resolvedApp: RunningAppInfo): boolean {
  return resolvedApp.bundleId === ctx.session.hostIdentity?.bundleId
}

function assertAllowedResolvedApp(
  ctx: ToolExecutionContext,
  resolvedApp: RunningAppInfo | null,
  action: string,
  target: string,
  point?: CursorPosition,
): RunningAppInfo | undefined {
  if (!shouldEnforceTargetAppGate(ctx)) {
    return undefined
  }

  if (!resolvedApp) {
    ctx.runtime.logger.warn('blocked input because target application could not be resolved', {
      sessionId: ctx.session.sessionId,
      action,
      target,
      point,
      allowedBundleIds: allowedBundleIds(ctx),
    })
    throw new TargetApplicationResolutionError(`Could not resolve the ${target} before ${action}.`)
  }

  if (isResolvedHostApp(ctx, resolvedApp) && !isAppAllowed(ctx.session, resolvedApp.bundleId)) {
    ctx.runtime.logger.warn('blocked input because host application became the target', {
      sessionId: ctx.session.sessionId,
      action,
      target,
      point,
      resolvedApp,
      hostIdentity: ctx.session.hostIdentity,
      allowedBundleIds: allowedBundleIds(ctx),
    })
    throw new TargetApplicationDeniedError(
      `Host app ${resolvedApp.bundleId} is the ${target}. Focus a granted application before ${action}.`,
    )
  }

  if (!isAppAllowed(ctx.session, resolvedApp.bundleId)) {
    ctx.runtime.logger.warn('blocked input because target application is not granted', {
      sessionId: ctx.session.sessionId,
      action,
      target,
      point,
      resolvedApp,
      allowedBundleIds: allowedBundleIds(ctx),
    })
    throw new TargetApplicationDeniedError(
      `App ${resolvedApp.bundleId} is not granted for this session. Call request_access first.`,
    )
  }

  return resolvedApp
}

export async function ensureFrontmostAppAllowed(
  ctx: ToolExecutionContext,
  action: string,
): Promise<RunningAppInfo | undefined> {
  const resolvedApp = shouldEnforceTargetAppGate(ctx)
    ? await ctx.runtime.nativeHost.apps.getFrontmostApp()
    : null

  return assertAllowedResolvedApp(ctx, resolvedApp, action, 'frontmost app')
}

export async function ensureAppUnderPointAllowed(
  ctx: ToolExecutionContext,
  point: CursorPosition,
  action: string,
): Promise<RunningAppInfo | undefined> {
  const resolvedApp = shouldEnforceTargetAppGate(ctx)
    ? await ctx.runtime.nativeHost.apps.appUnderPoint(point.x, point.y)
    : null

  return assertAllowedResolvedApp(
    ctx,
    resolvedApp,
    action,
    `app under point (${Math.round(point.x)}, ${Math.round(point.y)})`,
    point,
  )
}
