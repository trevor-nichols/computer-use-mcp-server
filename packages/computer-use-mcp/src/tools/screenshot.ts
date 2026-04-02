import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import { createScreenshotDims } from '../transforms/coordinates.js'
import { resolveScreenshotTargetSize } from '../transforms/screenshotSizing.js'
import { withActionScope } from './actionScope.js'
import { createCaptureActionScopeOptions } from './captureScope.js'
import { captureWithFallback } from './captureWithFallback.js'
import { createCaptureToolResult } from './captureResult.js'

export interface ScreenshotArgs {
  displayId?: number
}

export async function screenshotTool(ctx: ToolExecutionContext, args: ScreenshotArgs) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.screenRecording) {
    throw new MissingOsPermissionsError('Screen Recording permission is required before screenshot can run.')
  }

  return withActionScope(
    ctx,
    createCaptureActionScopeOptions(ctx.runtime.config, args.displayId, true),
    async ({ prepared }) => {
      const displays = await ctx.runtime.nativeHost.screenshots.listDisplays()
      const display = displays.find(item => item.displayId === prepared.targetDisplayId) ?? displays[0]
      if (!display) {
        throw new Error('No displays are available.')
      }

      const target = resolveScreenshotTargetSize(display, ctx.runtime.config.screenshotTargetMaxDimension)

      const capture = await captureWithFallback(ctx, prepared, {
        displayId: display.displayId,
        format: ctx.runtime.config.screenshotDefaultFormat,
        jpegQuality: ctx.runtime.config.screenshotJpegQuality,
        targetWidth: target.width,
        targetHeight: target.height,
      })

      const screenshotDims = createScreenshotDims(capture)

      ctx.session.lastScreenshotDims = screenshotDims
      ctx.session.selectedDisplayId = capture.display.displayId
      ctx.session.displayResolvedForAppsKey = prepared.displayResolvedForAppsKey

      return createCaptureToolResult(
        ctx,
        capture,
        screenshotDims,
        prepared.excludedBundleIds,
        `Captured display ${capture.display.displayId}.`,
      )
    },
  )
}
