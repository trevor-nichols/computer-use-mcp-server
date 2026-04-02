import { execFileSync } from 'node:child_process'
import type { RunningAppInfo } from '../native/bridgeTypes.js'
import type { Logger } from '../observability/logger.js'
import type { ToolExtra } from '../mcp/sessionIdentity.js'
import type { SessionContext } from '../session/sessionContext.js'

export type HostIdentitySource = 'initialize-metadata' | 'stdio-parent'

export interface HostIdentity {
  bundleId: string
  displayName?: string
  source: HostIdentitySource
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

export function normalizeHostIdentity(value: unknown, source: HostIdentitySource): HostIdentity | undefined {
  const object = asObject(value)
  const bundleId = asTrimmedString(object.bundleId)
  if (!bundleId) {
    return undefined
  }

  return {
    bundleId,
    displayName: asTrimmedString(object.displayName) ?? asTrimmedString(object.name),
    source,
  }
}

export function parseHostIdentityFromInitialize(
  experimental: Record<string, unknown>,
  capabilitiesExperimental: Record<string, unknown>,
): HostIdentity | undefined {
  const object = normalizeHostIdentity(
    capabilitiesExperimental.computerUseHost ?? experimental.computerUseHost,
    'initialize-metadata',
  )
  if (object) {
    return object
  }

  const bundleId = asTrimmedString(
    capabilitiesExperimental.computerUseHostBundleId
      ?? experimental.computerUseHostBundleId
      ?? capabilitiesExperimental.hostBundleId
      ?? experimental.hostBundleId,
  )
  if (!bundleId) {
    return undefined
  }

  return {
    bundleId,
    displayName: asTrimmedString(
      capabilitiesExperimental.computerUseHostName
        ?? experimental.computerUseHostName
        ?? capabilitiesExperimental.hostName
        ?? experimental.hostName,
    ),
    source: 'initialize-metadata',
  }
}

export function parseProcessTable(output: string): Map<number, number> {
  const parentByPid = new Map<number, number>()

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    const match = trimmed.match(/^(\d+)\s+(\d+)$/)
    if (!match) continue
    parentByPid.set(Number(match[1]), Number(match[2]))
  }

  return parentByPid
}

export function collectAncestorPids(startPid: number, parentByPid: Map<number, number>): number[] {
  const ancestors: number[] = []
  const seen = new Set<number>()
  let current = startPid

  while (!seen.has(current)) {
    seen.add(current)
    const parent = parentByPid.get(current)
    if (!parent || parent <= 0) {
      break
    }
    ancestors.push(parent)
    current = parent
  }

  return ancestors
}

function defaultReadProcessTable(): string {
  return execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' })
}

export async function inferStdioHostIdentity(input: {
  pid?: number
  readProcessTable?: () => string
  listRunningApps: () => Promise<RunningAppInfo[]>
}): Promise<HostIdentity | undefined> {
  const parentByPid = parseProcessTable((input.readProcessTable ?? defaultReadProcessTable)())
  const ancestors = collectAncestorPids(input.pid ?? process.pid, parentByPid)
  if (ancestors.length === 0) {
    return undefined
  }

  const runningApps = await input.listRunningApps()
  const runningAppByPid = new Map(runningApps.map(app => [app.pid, app]))

  for (const ancestorPid of ancestors) {
    const app = runningAppByPid.get(ancestorPid)
    if (!app) continue
    return {
      bundleId: app.bundleId,
      displayName: app.displayName,
      source: 'stdio-parent',
    }
  }

  return undefined
}

function explicitHostIdentity(extra?: ToolExtra): HostIdentity | undefined {
  return extra?.connection?.metadata.hostIdentity ?? extra?.hostIdentity
}

export async function ensureSessionHostIdentity(
  input: {
    logger: Logger
    listRunningApps: () => Promise<RunningAppInfo[]>
    pid?: number
    readProcessTable?: () => string
  },
  session: SessionContext,
  extra?: ToolExtra,
): Promise<HostIdentity | undefined> {
  const explicit = explicitHostIdentity(extra)
  if (explicit) {
    session.hostIdentity = explicit
    session.hostIdentityResolutionAttempted = true
    return explicit
  }

  if (session.hostIdentity) {
    return session.hostIdentity
  }

  if (session.hostIdentityResolutionAttempted) {
    return undefined
  }

  session.hostIdentityResolutionAttempted = true
  const transportName = extra?.connection?.transportName ?? session.connection?.transportName
  if (transportName !== 'stdio') {
    return undefined
  }

  try {
    const inferred = await inferStdioHostIdentity({
      pid: input.pid,
      readProcessTable: input.readProcessTable,
      listRunningApps: input.listRunningApps,
    })

    if (inferred) {
      session.hostIdentity = inferred
      extra?.connection?.setMetadata({ hostIdentity: inferred })
      input.logger.info('resolved session host identity from stdio parent app', {
        sessionId: session.sessionId,
        hostIdentity: inferred,
      })
    }

    return inferred
  } catch (error) {
    input.logger.warn('failed to infer host identity from stdio parent app', {
      sessionId: session.sessionId,
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}
