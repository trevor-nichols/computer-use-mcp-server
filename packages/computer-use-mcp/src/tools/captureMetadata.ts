import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { CaptureAssetNotFoundError } from '../errors/errorTypes.js'

export interface CaptureMetadataArgs {
  captureId: string
}

export async function captureMetadataTool(ctx: ToolExecutionContext, args: CaptureMetadataArgs) {
  const asset = ctx.runtime.captureAssetStore.getSessionAsset(ctx.session.sessionId, args.captureId)
  if (!asset) {
    throw new CaptureAssetNotFoundError()
  }

  return {
    content: [{
      type: 'text' as const,
      text: `Capture ${asset.captureId} metadata.`,
    }],
    structuredContent: {
      ok: true,
      captureId: asset.captureId,
      imagePath: asset.imagePath,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      displayId: asset.displayId,
      originX: asset.originX,
      originY: asset.originY,
      logicalWidth: asset.logicalWidth,
      logicalHeight: asset.logicalHeight,
      scaleFactor: asset.scaleFactor,
      excludedBundleIds: asset.excludedBundleIds,
    },
  }
}
