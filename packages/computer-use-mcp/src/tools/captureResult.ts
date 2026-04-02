import type { CaptureResult, ScreenshotDims } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'

export async function createCaptureToolResult(
  ctx: ToolExecutionContext,
  capture: CaptureResult,
  screenshotDims: ScreenshotDims,
  excludedBundleIds: string[],
  text: string,
) {
  const asset = await ctx.runtime.captureAssetStore.createAsset(
    ctx.session.sessionId,
    capture,
    screenshotDims,
    excludedBundleIds,
  )

  return {
    content: [
      {
        type: 'text' as const,
        text: `${text} captureId=${asset.captureId}. Call capture_metadata with that captureId for geometry or file metadata.`,
      },
      {
        type: 'image' as const,
        data: capture.dataBase64,
        mimeType: capture.mimeType,
      },
    ],
  }
}
