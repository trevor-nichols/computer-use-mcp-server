import type { CaptureResult, ScreenshotDims } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'

export async function createCaptureToolResult(
  ctx: ToolExecutionContext,
  capture: CaptureResult,
  screenshotDims: ScreenshotDims,
  excludedBundleIds: string[],
  text: string,
) {
  const asset = await ctx.runtime.captureAssetStore.createAsset(ctx.session.sessionId, capture, screenshotDims)

  return {
    content: [{
      type: 'text' as const,
      text: `${text} Image saved to ${asset.imagePath}. Use your image-viewer tool to inspect it.`,
    }],
    structuredContent: {
      ok: true,
      captureId: asset.captureId,
      imagePath: asset.imagePath,
      mimeType: capture.mimeType,
      ...screenshotDims,
      excludedBundleIds,
    },
  }
}
