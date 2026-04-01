import type { RuntimeConfig } from '../config.js'
import type { ActionScopeOptions } from './actionScope.js'

export function createCaptureActionScopeOptions(
  config: RuntimeConfig,
  explicitDisplayId?: number,
  autoTargetDisplay = false,
): ActionScopeOptions {
  const hideDisallowedApps = config.hideDisallowedBeforeAction && !config.excludeDisallowedFromScreenshots

  return {
    acquireLock: hideDisallowedApps || config.excludeDisallowedFromScreenshots,
    hideDisallowedApps,
    excludeDisallowedApps: config.excludeDisallowedFromScreenshots,
    explicitDisplayId,
    autoTargetDisplay: autoTargetDisplay && explicitDisplayId === undefined,
  }
}
