import type { DisplayInfo } from '../native/bridgeTypes.js'

export function resolveScreenshotTargetSize(display: DisplayInfo, maxDimension: number): { width: number; height: number } {
  const largest = Math.max(display.width, display.height)
  if (largest <= maxDimension) {
    return { width: display.width, height: display.height }
  }

  const ratio = maxDimension / largest
  return {
    width: Math.round(display.width * ratio),
    height: Math.round(display.height * ratio),
  }
}
