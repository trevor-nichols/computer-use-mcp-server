import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import type { TccState } from '../native/bridgeTypes.js'

export function hasAccessibility(tcc: TccState): boolean {
  return Boolean(tcc.accessibility)
}

export function hasScreenRecording(tcc: TccState): boolean {
  return Boolean(tcc.screenRecording)
}

export function missingTccPermissions(tcc: TccState): Array<'accessibility' | 'screenRecording'> {
  const missing: Array<'accessibility' | 'screenRecording'> = []
  if (!hasAccessibility(tcc)) missing.push('accessibility')
  if (!hasScreenRecording(tcc)) missing.push('screenRecording')
  return missing
}

export function assertTccPermissions(tcc: TccState, required: Array<'accessibility' | 'screenRecording'>): void {
  const missing = required.filter(permission => permission === 'accessibility' ? !hasAccessibility(tcc) : !hasScreenRecording(tcc))
  if (missing.length > 0) {
    throw new MissingOsPermissionsError(`Missing macOS permissions: ${missing.join(', ')}`)
  }
}
