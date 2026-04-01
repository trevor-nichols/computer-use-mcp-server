import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import { createScreenshotDims, mapScreenshotRectToDesktop } from '../transforms/coordinates.js'
import { withActionScope } from './actionScope.js'
import { createCaptureActionScopeOptions } from './captureScope.js'
import { captureWithFallback } from './captureWithFallback.js'

export interface ZoomArgs {
  x: number
  y: number
  width: number
  height: number
  displayId?: number
}

export async function zoomTool(ctx: ToolExecutionContext, args: ZoomArgs) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.screenRecording) {
    throw new MissingOsPermissionsError('Screen Recording permission is required before zoom can run.')
  }

  return withActionScope(
    ctx,
    createCaptureActionScopeOptions(ctx.runtime.config, args.displayId),
    async ({ prepared }) => {
      const region = mapScreenshotRectToDesktop(
        { x: args.x, y: args.y, width: args.width, height: args.height },
        ctx.session.lastScreenshotDims,
      )

      const capture = await captureWithFallback(ctx, prepared, {
        displayId: prepared.targetDisplayId,
        region,
        format: ctx.runtime.config.screenshotDefaultFormat,
        jpegQuality: ctx.runtime.config.screenshotJpegQuality,
      })

      const screenshotDims = createScreenshotDims(capture, region)

      ctx.session.lastScreenshotDims = screenshotDims
      ctx.session.selectedDisplayId = capture.display.displayId
      ctx.session.displayResolvedForAppsKey = prepared.displayResolvedForAppsKey

      return {
        content: [
          { type: 'image', data: capture.dataBase64, mimeType: capture.mimeType },
          { type: 'text', text: 'Captured zoom region.' },
        ],
        structuredContent: {
          ok: true,
          image: capture.dataBase64,
          mimeType: capture.mimeType,
          ...screenshotDims,
          excludedBundleIds: prepared.excludedBundleIds,
        },
      }
    },
  )
}
