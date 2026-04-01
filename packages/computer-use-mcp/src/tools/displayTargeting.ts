import type { AllowedApp, DisplayInfo } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'

export interface DisplayTargetOptions {
  explicitDisplayId?: number
  autoTargetDisplay?: boolean
}

export interface DisplayTargetResolution {
  targetDisplayId?: number
  displayResolvedForAppsKey?: string
}

function resolveDefaultDisplayId(displays: DisplayInfo[]): number | undefined {
  return displays.find(display => display.isPrimary)?.displayId ?? displays[0]?.displayId
}

export function buildAllowedAppsKey(allowedApps: AllowedApp[]): string | undefined {
  const bundleIds = [...new Set(allowedApps.map(app => app.bundleId).filter(Boolean))].sort()
  return bundleIds.length > 0 ? bundleIds.join(',') : undefined
}

export function resolveTargetDisplayId(
  ctx: ToolExecutionContext,
  availableDisplayIds: number[],
  explicitDisplayId?: number,
): number | undefined {
  if (explicitDisplayId && availableDisplayIds.includes(explicitDisplayId)) {
    return explicitDisplayId
  }

  if (
    ctx.session.displayPinnedByModel &&
    ctx.session.selectedDisplayId &&
    availableDisplayIds.includes(ctx.session.selectedDisplayId)
  ) {
    return ctx.session.selectedDisplayId
  }

  if (
    ctx.session.lastScreenshotDims?.displayId &&
    availableDisplayIds.includes(ctx.session.lastScreenshotDims.displayId)
  ) {
    return ctx.session.lastScreenshotDims.displayId
  }

  return availableDisplayIds[0]
}

export function pickBestAutoTargetDisplayId(
  displays: DisplayInfo[],
  windowDisplays: Record<string, number[]>,
): number | undefined {
  const availableDisplayIds = new Set(displays.map(display => display.displayId))
  const appCountByDisplayId = new Map<number, number>()

  for (const displayIds of Object.values(windowDisplays)) {
    const uniqueVisibleDisplayIds = [...new Set(displayIds)].filter(displayId => availableDisplayIds.has(displayId))
    for (const displayId of uniqueVisibleDisplayIds) {
      appCountByDisplayId.set(displayId, (appCountByDisplayId.get(displayId) ?? 0) + 1)
    }
  }

  const rankedDisplays = displays
    .map(display => ({
      display,
      appCount: appCountByDisplayId.get(display.displayId) ?? 0,
    }))
    .filter(item => item.appCount > 0)
    .sort((left, right) => {
      if (right.appCount !== left.appCount) {
        return right.appCount - left.appCount
      }

      if (left.display.isPrimary !== right.display.isPrimary) {
        return Number(right.display.isPrimary) - Number(left.display.isPrimary)
      }

      return left.display.displayId - right.display.displayId
    })

  return rankedDisplays[0]?.display.displayId
}

export async function resolvePreparedDisplayTarget(
  ctx: ToolExecutionContext,
  displays: DisplayInfo[],
  options: DisplayTargetOptions,
): Promise<DisplayTargetResolution> {
  const availableDisplayIds = displays.map(display => display.displayId)

  if (options.explicitDisplayId && availableDisplayIds.includes(options.explicitDisplayId)) {
    return {
      targetDisplayId: options.explicitDisplayId,
    }
  }

  if (
    ctx.session.displayPinnedByModel &&
    ctx.session.selectedDisplayId &&
    availableDisplayIds.includes(ctx.session.selectedDisplayId)
  ) {
    return {
      targetDisplayId: ctx.session.selectedDisplayId,
    }
  }

  if (options.autoTargetDisplay) {
    const allowedAppsKey = buildAllowedAppsKey(ctx.session.allowedApps)

    if (allowedAppsKey) {
      const cachedSelectedDisplayId = ctx.session.selectedDisplayId
      if (
        ctx.session.displayResolvedForAppsKey === allowedAppsKey &&
        cachedSelectedDisplayId &&
        availableDisplayIds.includes(cachedSelectedDisplayId)
      ) {
        return {
          targetDisplayId: cachedSelectedDisplayId,
          displayResolvedForAppsKey: allowedAppsKey,
        }
      }

      const windowDisplays = await ctx.runtime.nativeHost.apps.findWindowDisplays(
        ctx.session.allowedApps.map(app => app.bundleId),
      )
      const autoTargetDisplayId = pickBestAutoTargetDisplayId(displays, windowDisplays)
      if (autoTargetDisplayId !== undefined) {
        return {
          targetDisplayId: autoTargetDisplayId,
          displayResolvedForAppsKey: allowedAppsKey,
        }
      }
    }
  }

  if (
    ctx.session.lastScreenshotDims?.displayId &&
    availableDisplayIds.includes(ctx.session.lastScreenshotDims.displayId)
  ) {
    return {
      targetDisplayId: ctx.session.lastScreenshotDims.displayId,
    }
  }

  return {
    targetDisplayId: resolveDefaultDisplayId(displays),
  }
}
