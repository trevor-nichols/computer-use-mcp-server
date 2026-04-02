import type { ToolExecutionContext } from '../mcp/callRouter.js'

export async function listDisplaysTool(ctx: ToolExecutionContext) {
  const displays = await ctx.runtime.nativeHost.screenshots.listDisplays()

  return {
    content: [{ type: 'text', text: `${displays.length} display${displays.length === 1 ? '' : 's'} available.` }],
    structuredContent: {
      ok: true,
      displayPinnedByModel: ctx.session.displayPinnedByModel,
      selectedDisplayId: ctx.session.selectedDisplayId ?? null,
      displays,
    },
  }
}
