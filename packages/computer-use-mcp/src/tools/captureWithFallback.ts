import type { CaptureOptions, CaptureResult } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import type { PreparedActionContext } from './actionScope.js'

type ManagedCaptureOptions = Omit<CaptureOptions, 'excludeBundleIds'>

export async function captureWithFallback(
  ctx: ToolExecutionContext,
  prepared: PreparedActionContext,
  options: ManagedCaptureOptions,
): Promise<CaptureResult> {
  const hiddenBundleIds = new Set(prepared.hiddenBundleIds)
  const effectiveExcludedBundleIds = prepared.excludedBundleIds.filter(bundleId => !hiddenBundleIds.has(bundleId))
  const fallbackHideBundleIds = prepared.fallbackHideBundleIds.filter(bundleId => !hiddenBundleIds.has(bundleId))

  try {
    return await ctx.runtime.nativeHost.screenshots.capture({
      ...options,
      excludeBundleIds: effectiveExcludedBundleIds,
    })
  } catch (error) {
    if (effectiveExcludedBundleIds.length === 0) {
      throw error
    }

    const hideForFallback = fallbackHideBundleIds

    ctx.runtime.logger.warn('falling back to temporary app hiding for screenshot capture', {
      sessionId: ctx.session.sessionId,
      error: error instanceof Error ? error.message : String(error),
      excludedBundleIds: effectiveExcludedBundleIds,
      hideForFallback,
      hostBundleId: prepared.hostBundleId,
    })

    const hiddenForFallback =
      hideForFallback.length > 0 ? await ctx.runtime.nativeHost.apps.hideApplications(hideForFallback) : []

    try {
      return await ctx.runtime.nativeHost.screenshots.capture({
        ...options,
        excludeBundleIds: [],
      })
    } finally {
      if (hiddenForFallback.length > 0) {
        await ctx.runtime.nativeHost.apps.unhideApplications(hiddenForFallback).catch(unhideError => {
          ctx.runtime.logger.warn('failed to restore apps hidden for screenshot fallback', {
            sessionId: ctx.session.sessionId,
            error: unhideError instanceof Error ? unhideError.message : String(unhideError),
            hiddenForFallback,
          })
        })
      }
    }
  }
}
