import type { ToolExecutionContext } from '../mcp/callRouter.js'
import type { ActionExecutionContext } from './actionScope.js'
import { withActionScope } from './actionScope.js'
import { executeMouseMove } from './mouseMove.js'
import { performClick } from './click.js'
import { executeLeftClickDrag } from './drag.js'
import { executeScroll } from './scroll.js'
import { executeKey } from './key.js'
import { executeHoldKey } from './holdKey.js'
import { executeTypeText } from './typeText.js'
import { readClipboard, writeClipboard } from './clipboard.js'
import { executeWait } from './wait.js'
import { executeOpenApplication } from './applications.js'

export interface BatchAction {
  tool: string
  arguments?: Record<string, unknown>
}

export interface ComputerBatchArgs {
  actions: BatchAction[]
}

export async function computerBatchTool(ctx: ToolExecutionContext, args: ComputerBatchArgs) {
  return withActionScope(
    ctx,
    {
      acquireLock: true,
      registerAbort: true,
      hideDisallowedApps: ctx.runtime.config.hideDisallowedBeforeAction,
    },
    async scope => {
      const results = []
      for (const action of args.actions) {
        const result = await executeBatchAction(ctx, action, scope)
        results.push({
          tool: action.tool,
          result: (result as { structuredContent?: unknown }).structuredContent ?? result,
        })
      }

      return {
        content: [{ type: 'text', text: `Executed ${results.length} batched actions.` }],
        structuredContent: {
          ok: true,
          results,
        },
      }
    },
  )
}

async function executeBatchAction(ctx: ToolExecutionContext, action: BatchAction, scope: ActionExecutionContext) {
  switch (action.tool) {
    case 'mouse_move':
      return executeMouseMove(ctx, action.arguments as any, scope)
    case 'left_click':
      return performClick(ctx, action.arguments as any, 'left', 1, scope)
    case 'right_click':
      return performClick(ctx, action.arguments as any, 'right', 1, scope)
    case 'middle_click':
      return performClick(ctx, action.arguments as any, 'middle', 1, scope)
    case 'double_click':
      return performClick(ctx, action.arguments as any, 'left', 2, scope)
    case 'triple_click':
      return performClick(ctx, action.arguments as any, 'left', 3, scope)
    case 'left_click_drag':
      return executeLeftClickDrag(ctx, action.arguments as any, scope)
    case 'scroll':
      return executeScroll(ctx, action.arguments as any, scope)
    case 'key':
      return executeKey(ctx, action.arguments as any, scope)
    case 'hold_key':
      return executeHoldKey(ctx, action.arguments as any, scope)
    case 'type':
      return executeTypeText(ctx, action.arguments as any, scope)
    case 'read_clipboard': {
      const text = await readClipboard(ctx.runtime.nativeHost, ctx.session)
      return {
        content: [{ type: 'text', text }],
        structuredContent: {
          ok: true,
          text,
        },
      }
    }
    case 'write_clipboard': {
      const text = String((action.arguments ?? {}).text ?? '')
      await writeClipboard(ctx.runtime.nativeHost, ctx.session, text)
      return {
        content: [{ type: 'text', text: 'Updated clipboard text.' }],
        structuredContent: {
          ok: true,
          text,
        },
      }
    }
    case 'wait':
      return executeWait(ctx, action.arguments as any, scope)
    case 'open_application':
      return executeOpenApplication(ctx, action.arguments as any)
    default:
      throw new Error(`Unsupported batch action: ${action.tool}`)
  }
}
