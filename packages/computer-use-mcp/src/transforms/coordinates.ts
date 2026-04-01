import type { CursorPosition, ScreenshotDims } from '../native/bridgeTypes.js'
import { CoordinateTransformError } from '../errors/errorTypes.js'

export function mapScreenshotPointToDesktop(point: CursorPosition, dims?: ScreenshotDims): CursorPosition {
  if (!dims) {
    return point
  }

  if (dims.width <= 0 || dims.height <= 0) {
    throw new CoordinateTransformError()
  }

  const targetWidth = dims.logicalWidth ?? dims.width
  const targetHeight = dims.logicalHeight ?? dims.height

  return {
    x: dims.originX + (point.x / dims.width) * targetWidth,
    y: dims.originY + (point.y / dims.height) * targetHeight,
  }
}

export function mapScreenshotRectToDesktop(
  rect: { x: number; y: number; width: number; height: number },
  dims?: ScreenshotDims,
): { x: number; y: number; width: number; height: number } {
  if (!dims) {
    return rect
  }

  if (dims.width <= 0 || dims.height <= 0) {
    throw new CoordinateTransformError()
  }

  const targetWidth = dims.logicalWidth ?? dims.width
  const targetHeight = dims.logicalHeight ?? dims.height

  return {
    x: dims.originX + (rect.x / dims.width) * targetWidth,
    y: dims.originY + (rect.y / dims.height) * targetHeight,
    width: (rect.width / dims.width) * targetWidth,
    height: (rect.height / dims.height) * targetHeight,
  }
}
