import type { AllowedApp, GrantFlags } from '../native/bridgeTypes.js'
import type { SessionContext } from '../session/sessionContext.js'

export function isAppAllowed(session: SessionContext, bundleId: string): boolean {
  return session.allowedApps.some(app => app.bundleId === bundleId)
}

export function mergeAllowedApps(existing: AllowedApp[], incoming: AllowedApp[]): AllowedApp[] {
  const byId = new Map<string, AllowedApp>()
  for (const app of existing) byId.set(app.bundleId, app)
  for (const app of incoming) byId.set(app.bundleId, app)
  return [...byId.values()]
}

export function mergeGrantFlags(current: GrantFlags, requested: Partial<GrantFlags>): GrantFlags {
  return {
    clipboardRead: requested.clipboardRead ?? current.clipboardRead,
    clipboardWrite: requested.clipboardWrite ?? current.clipboardWrite,
    systemKeyCombos: requested.systemKeyCombos ?? current.systemKeyCombos,
  }
}

export function requestedAppsStillMissing(session: SessionContext, requestedApps: AllowedApp[]): AllowedApp[] {
  return requestedApps.filter(app => !isAppAllowed(session, app.bundleId))
}

export function requiresAdditionalFlags(session: SessionContext, requestedFlags: Partial<GrantFlags>): boolean {
  return Boolean(
    (requestedFlags.clipboardRead && !session.grantFlags.clipboardRead) ||
    (requestedFlags.clipboardWrite && !session.grantFlags.clipboardWrite) ||
    (requestedFlags.systemKeyCombos && !session.grantFlags.systemKeyCombos),
  )
}
