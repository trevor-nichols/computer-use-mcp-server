import { AppResolutionError } from '../errors/errorTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import type { AllowedApp } from '../native/bridgeTypes.js'

export type SearchApplicationsSource = 'all' | 'running' | 'installed'

export interface SearchApplicationsArgs {
  query: string
  limit?: number
  source?: SearchApplicationsSource
  includePaths?: boolean
}

interface SearchCandidate {
  bundleId: string
  displayName: string
  path?: string
  isRunning: boolean
  isInstalled: boolean
  isGranted: boolean
}

interface ScoredSearchCandidate extends SearchCandidate {
  score: number
}

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 25

function normalizeQuery(query: unknown): string {
  if (typeof query !== 'string') {
    throw new AppResolutionError('query must be a non-empty string.')
  }

  const trimmed = query.trim()
  if (trimmed.length === 0) {
    throw new AppResolutionError('query must be a non-empty string.')
  }

  return trimmed
}

function normalizeLimit(limit: unknown): number {
  if (limit === undefined) return DEFAULT_LIMIT
  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    throw new AppResolutionError('limit must be an integer between 1 and 25.')
  }
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new AppResolutionError('limit must be an integer between 1 and 25.')
  }
  return limit
}

function normalizeSource(source: unknown): SearchApplicationsSource {
  if (source === undefined) return 'all'
  if (source === 'all' || source === 'running' || source === 'installed') {
    return source
  }
  throw new AppResolutionError('source must be one of: all, running, installed.')
}

function normalizeIncludePaths(includePaths: unknown): boolean {
  if (includePaths === undefined) return false
  if (typeof includePaths !== 'boolean') {
    throw new AppResolutionError('includePaths must be a boolean.')
  }
  return includePaths
}

function normalizeBundleId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeDisplayName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function normalizePath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function mergeDisplayName(current: string, incoming: string, bundleId: string): string {
  if (current === bundleId && incoming !== bundleId) {
    return incoming
  }
  return current
}

function upsertCandidate(
  candidates: Map<string, SearchCandidate>,
  incoming: Omit<SearchCandidate, 'isGranted'>,
): void {
  const existing = candidates.get(incoming.bundleId)
  if (!existing) {
    candidates.set(incoming.bundleId, {
      ...incoming,
      isGranted: false,
    })
    return
  }

  existing.isRunning = existing.isRunning || incoming.isRunning
  existing.isInstalled = existing.isInstalled || incoming.isInstalled
  existing.displayName = mergeDisplayName(existing.displayName, incoming.displayName, incoming.bundleId)
  if (!existing.path && incoming.path) {
    existing.path = incoming.path
  }
}

async function collectCandidates(
  ctx: ToolExecutionContext,
  source: SearchApplicationsSource,
): Promise<SearchCandidate[]> {
  const candidates = new Map<string, SearchCandidate>()
  const grantedBundleIds = new Set(ctx.session.allowedApps.map(app => app.bundleId))

  if (source === 'all' || source === 'running') {
    const running = await ctx.runtime.nativeHost.apps.listRunningApps()
    for (const app of running) {
      const bundleId = normalizeBundleId(app.bundleId)
      if (!bundleId) continue

      upsertCandidate(candidates, {
        bundleId,
        displayName: normalizeDisplayName(app.displayName, bundleId),
        isRunning: true,
        isInstalled: false,
      })
    }
  }

  if (source === 'all' || source === 'installed') {
    const installed = await ctx.runtime.nativeHost.apps.listInstalledApps()
    for (const app of installed) {
      const bundleId = normalizeBundleId(app.bundleId)
      if (!bundleId) continue

      upsertCandidate(candidates, {
        bundleId,
        displayName: normalizeDisplayName(app.displayName, bundleId),
        path: normalizePath(app.path),
        isRunning: false,
        isInstalled: true,
      })
    }
  }

  for (const candidate of candidates.values()) {
    candidate.isGranted = grantedBundleIds.has(candidate.bundleId)
  }

  return [...candidates.values()]
}

function computeMatchScore(candidate: SearchCandidate, queryLower: string): number {
  const bundle = candidate.bundleId.toLowerCase()
  const name = candidate.displayName.toLowerCase()
  const path = candidate.path?.toLowerCase() ?? ''
  const combined = `${bundle} ${name} ${path}`
  const tokens = queryLower.split(/\s+/).filter(Boolean)
  if (tokens.some(token => !combined.includes(token))) {
    return 0
  }

  let score = 0
  if (bundle === queryLower) {
    score = 1200
  } else if (name === queryLower) {
    score = 1180
  } else if (bundle.startsWith(queryLower)) {
    score = 1120
  } else if (name.startsWith(queryLower)) {
    score = 1090
  } else if (bundle.includes(queryLower)) {
    score = 1030
  } else if (name.includes(queryLower)) {
    score = 1000
  } else if (path.includes(queryLower)) {
    score = 980
  } else if (tokens.length > 1) {
    score = 950
  } else {
    return 0
  }

  if (candidate.isRunning) score += 40
  if (candidate.isGranted) score += 25
  if (candidate.isInstalled) score += 5

  return score
}

function compareCaseInsensitive(a: string, b: string): number {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareScoredCandidates(a: ScoredSearchCandidate, b: ScoredSearchCandidate): number {
  const scoreDiff = b.score - a.score
  if (scoreDiff !== 0) return scoreDiff

  const runningDiff = Number(b.isRunning) - Number(a.isRunning)
  if (runningDiff !== 0) return runningDiff

  const grantedDiff = Number(b.isGranted) - Number(a.isGranted)
  if (grantedDiff !== 0) return grantedDiff

  const displayNameDiff = compareCaseInsensitive(a.displayName, b.displayName)
  if (displayNameDiff !== 0) return displayNameDiff

  return compareCaseInsensitive(a.bundleId, b.bundleId)
}

function toAllowedApp(candidate: SearchCandidate, includePaths: boolean): AllowedApp {
  const app: AllowedApp = {
    bundleId: candidate.bundleId,
    displayName: candidate.displayName,
  }
  if (includePaths && candidate.path) {
    app.path = candidate.path
  }
  return app
}

export async function searchApplicationsTool(ctx: ToolExecutionContext, args: SearchApplicationsArgs) {
  const query = normalizeQuery(args.query)
  const source = normalizeSource(args.source)
  const limit = normalizeLimit(args.limit)
  const includePaths = normalizeIncludePaths(args.includePaths)
  const queryLower = query.toLowerCase()

  const candidates = await collectCandidates(ctx, source)
  const matches = candidates
    .map(candidate => ({
      ...candidate,
      score: computeMatchScore(candidate, queryLower),
    }))
    .filter(candidate => candidate.score > 0)
    .sort(compareScoredCandidates)

  const apps = matches.slice(0, limit).map(candidate => toAllowedApp(candidate, includePaths))
  const totalMatches = matches.length

  return {
    content: [
      {
        type: 'text',
        text: totalMatches > 0
          ? `Found ${totalMatches} matching applications for "${query}". Returning ${apps.length}.`
          : `No applications matched "${query}".`,
      },
    ],
    structuredContent: {
      ok: true,
      query,
      source,
      limit,
      totalMatches,
      hasMore: totalMatches > apps.length,
      apps,
    },
  }
}
