import type { ToolExecutionContext } from '../mcp/callRouter.js'

export async function cursorPositionTool(ctx: ToolExecutionContext) {
  const position = await ctx.runtime.nativeHost.input.getCursorPosition()
  return {
    content: [{ type: 'text', text: `Cursor at (${position.x}, ${position.y}).` }],
    structuredContent: {
      ok: true,
      x: position.x,
      y: position.y,
    },
  }
}
