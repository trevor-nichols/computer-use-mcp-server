import { AbortRequestedError } from '../errors/errorTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { CleanupRegistry } from '../session/cleanupRegistry.js'
import { resolvePreparedDisplayTarget } from './displayTargeting.js'

export interface ActionScopeOptions {
  acquireLock?: boolean
  registerAbort?: boolean
  hideDisallowedApps?: boolean
  excludeDisallowedApps?: boolean
  excludeHostFromScreenshots?: boolean
  explicitDisplayId?: number
  autoTargetDisplay?: boolean
}

export interface PreparedActionContext {
  targetDisplayId?: number
  displayResolvedForAppsKey?: string
  excludedBundleIds: string[]
  fallbackHideBundleIds: string[]
  hiddenBundleIds: string[]
  hostBundleId?: string
}

export interface ActionExecutionContext {
  cleanup: CleanupRegistry
  prepared: PreparedActionContext
  throwIfAbortRequested: () => Promise<void>
  delayWithAbort: (ms: number) => Promise<void>
}

export async function withActionScope<T>(
  ctx: ToolExecutionContext,
  options: ActionScopeOptions,
  action: (scope: ActionExecutionContext) => Promise<T>,
): Promise<T> {
  const cleanup = new CleanupRegistry()

  if (options.acquireLock) {
    const releaseLock = await ctx.runtime.lockManager.acquire(ctx.session.sessionId, ctx.session.connectionId)
    cleanup.add(releaseLock)
  }

  if (options.registerAbort) {
    await ctx.runtime.nativeHost.hotkeys.registerEscapeAbort(ctx.session.sessionId)
    cleanup.add(() => ctx.runtime.nativeHost.hotkeys.unregisterEscapeAbort(ctx.session.sessionId))
  }

  const prepared = await prepareForAction(ctx, cleanup, options)

  try {
    return await action({
      cleanup,
      prepared,
      throwIfAbortRequested: () => throwIfAbortRequested(ctx),
      delayWithAbort: (ms: number) => delayWithAbort(ctx, ms),
    })
  } finally {
    try {
      await cleanup.runAll(ctx.runtime.logger)
    } finally {
      ctx.session.hiddenDuringTurn.clear()
    }
  }
}

export async function prepareForAction(
  ctx: ToolExecutionContext,
  cleanup: CleanupRegistry,
  options: ActionScopeOptions,
): Promise<PreparedActionContext> {
  const displays = await ctx.runtime.nativeHost.screenshots.listDisplays()
  const displayTarget = await resolvePreparedDisplayTarget(ctx, displays, {
    explicitDisplayId: options.explicitDisplayId,
    autoTargetDisplay: options.autoTargetDisplay,
  })
  const targetDisplayId = displayTarget.targetDisplayId

  let excludedBundleIds: string[] = []
  let fallbackHideBundleIds: string[] = []
  let hiddenBundleIds: string[] = []
  const hostBundleId = options.excludeHostFromScreenshots ? ctx.session.hostIdentity?.bundleId : undefined

  const shouldConsiderDisallowed = (options.excludeDisallowedApps || options.hideDisallowedApps) && ctx.session.allowedApps.length > 0
  if (shouldConsiderDisallowed) {
    const runningApps = await ctx.runtime.nativeHost.apps.listRunningApps()
    const allowedBundleIds = new Set(ctx.session.allowedApps.map(app => app.bundleId))
    const disallowed = runningApps
      .map(app => app.bundleId)
      .filter(bundleId => !allowedBundleIds.has(bundleId))
      .filter(bundleId => bundleId !== hostBundleId)
      .filter((bundleId, index, array) => array.indexOf(bundleId) === index)
    const windowDisplays =
      disallowed.length > 0 ? await ctx.runtime.nativeHost.apps.findWindowDisplays(disallowed) : {}
    const visibleDisallowed = filterDisallowedBundleIdsForTargetDisplay(disallowed, windowDisplays, targetDisplayId)

    if (options.excludeDisallowedApps) {
      excludedBundleIds = visibleDisallowed
      fallbackHideBundleIds = visibleDisallowed
    }

    if (options.hideDisallowedApps && visibleDisallowed.length > 0) {
      hiddenBundleIds = await ctx.runtime.nativeHost.apps.hideApplications(visibleDisallowed)
      ctx.session.hiddenDuringTurn = new Set(hiddenBundleIds)
      cleanup.add(async () => {
        if (hiddenBundleIds.length > 0) {
          await ctx.runtime.nativeHost.apps.unhideApplications(hiddenBundleIds)
        }
      })
    }
  }

  if (hostBundleId) {
    excludedBundleIds = uniqueBundleIds([...excludedBundleIds, hostBundleId])
  }

  return {
    targetDisplayId,
    displayResolvedForAppsKey: displayTarget.displayResolvedForAppsKey,
    excludedBundleIds,
    fallbackHideBundleIds,
    hiddenBundleIds,
    hostBundleId,
  }
}

function uniqueBundleIds(bundleIds: string[]): string[] {
  return [...new Set(bundleIds.filter(Boolean))]
}

export function filterDisallowedBundleIdsForTargetDisplay(
  disallowedBundleIds: string[],
  windowDisplays: Record<string, number[]>,
  targetDisplayId?: number,
): string[] {
  return disallowedBundleIds.filter(bundleId => {
    const displays = windowDisplays[bundleId] ?? []
    if (displays.length === 0) {
      return false
    }

    return targetDisplayId === undefined || displays.includes(targetDisplayId)
  })
}

export async function throwIfAbortRequested(ctx: ToolExecutionContext): Promise<void> {
  const aborted = await ctx.runtime.nativeHost.hotkeys.consumeAbort(ctx.session.sessionId)
  if (aborted) {
    throw new AbortRequestedError()
  }
}

export async function delayWithAbort(ctx: ToolExecutionContext, ms: number): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    await throwIfAbortRequested(ctx)
    const remaining = end - Date.now()
    await new Promise(resolve => setTimeout(resolve, Math.min(remaining, 50)))
  }
  await throwIfAbortRequested(ctx)
}

export function sequenceContainsEscape(sequence: string): boolean {
  return sequence
    .split('+')
    .map(part => part.trim().toLowerCase())
    .includes('escape') || sequence.toLowerCase().includes('esc')
}

export function sequenceRequiresSystemKeyCombos(sequence: string): boolean {
  const tokens = sequence
    .split('+')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean)

  return tokens.some(token => [
    'command',
    'cmd',
    'meta',
    'super',
    'windows',
    'option',
    'alt',
    'control',
    'ctrl',
    'fn',
    'function',
    'tab',
  ].includes(token))
}
