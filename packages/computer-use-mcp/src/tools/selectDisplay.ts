import type { ToolExecutionContext } from '../mcp/callRouter.js'
import type { DisplayInfo } from '../native/bridgeTypes.js'

export interface SelectDisplayArgs {
  displayId?: number
  displayName?: string
  auto?: boolean
}

interface DisplaySelectionAutoResult {
  mode: 'auto'
}

interface DisplaySelectionPinnedResult {
  mode: 'pinned'
  display: DisplayInfo
}

type DisplaySelectionResult =
  | DisplaySelectionAutoResult
  | DisplaySelectionPinnedResult

function normalizeDisplayName(name: string): string {
  return name.trim().toLowerCase()
}

function describeDisplay(display: DisplayInfo): string {
  return display.name ? `${display.displayId} (${display.name})` : String(display.displayId)
}

function listAvailableDisplays(displays: DisplayInfo[]): string {
  return displays.map(describeDisplay).join(', ')
}

export function resolveDisplaySelection(
  args: SelectDisplayArgs,
  displays: DisplayInfo[],
): DisplaySelectionResult {
  const hasDisplayId = typeof args.displayId === 'number'
  const requestedName = typeof args.displayName === 'string' ? args.displayName.trim() : ''
  const hasDisplayName = requestedName.length > 0
  const useAuto = args.auto === true
  const selectionModeCount = [hasDisplayId, hasDisplayName, useAuto].filter(Boolean).length

  if (selectionModeCount !== 1) {
    throw new Error('Provide exactly one of displayId, displayName, or auto=true.')
  }

  if (useAuto) {
    return { mode: 'auto' }
  }

  if (hasDisplayId) {
    const display = displays.find(item => item.displayId === args.displayId)
    if (!display) {
      throw new Error(
        `Unknown displayId ${args.displayId}. Available displays: ${listAvailableDisplays(displays)}.`,
      )
    }

    return {
      mode: 'pinned',
      display,
    }
  }

  const normalizedRequestedName = normalizeDisplayName(requestedName)
  const matches = displays.filter(display => normalizeDisplayName(display.name ?? '') === normalizedRequestedName)

  if (matches.length === 0) {
    throw new Error(
      `Unknown displayName "${requestedName}". Available displays: ${listAvailableDisplays(displays)}.`,
    )
  }

  if (matches.length > 1) {
    throw new Error(
      `Display name "${requestedName}" is ambiguous. Use displayId instead. Matching displays: ${matches.map(describeDisplay).join(', ')}.`,
    )
  }

  return {
    mode: 'pinned',
    display: matches[0]!,
  }
}

export async function selectDisplayTool(
  ctx: ToolExecutionContext,
  args: SelectDisplayArgs,
) {
  const displays = await ctx.runtime.nativeHost.screenshots.listDisplays()
  if (displays.length === 0) {
    throw new Error('No displays are available.')
  }

  const selection = resolveDisplaySelection(args, displays)

  ctx.session.displayResolvedForAppsKey = undefined

  if (selection.mode === 'auto') {
    ctx.session.selectedDisplayId = undefined
    ctx.session.displayPinnedByModel = false

    return {
      content: [
        {
          type: 'text',
          text: 'Cleared the explicit display pin. Future screenshots will auto-target granted app windows when possible.',
        },
      ],
      structuredContent: {
        ok: true,
        mode: 'auto',
        displayPinnedByModel: false,
        selectedDisplayId: null,
        availableDisplays: displays,
      },
    }
  }

  ctx.session.selectedDisplayId = selection.display.displayId
  ctx.session.displayPinnedByModel = true

  return {
    content: [
      {
        type: 'text',
        text: selection.display.name
          ? `Selected display ${selection.display.displayId} (${selection.display.name}).`
          : `Selected display ${selection.display.displayId}.`,
      },
    ],
    structuredContent: {
      ok: true,
      mode: 'pinned',
      displayPinnedByModel: true,
      selectedDisplayId: selection.display.displayId,
      selectedDisplay: selection.display,
      availableDisplays: displays,
    },
  }
}
