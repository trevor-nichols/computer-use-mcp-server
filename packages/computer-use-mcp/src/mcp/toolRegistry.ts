import { createToolHandler } from './callRouter.js'
import type { ServerRuntime, ToolDefinition } from './server.js'
import {
  captureMetadataSchema,
  computerBatchSchema,
  dragSchema,
  holdKeySchema,
  keySchema,
  listDisplaysOutputSchema,
  openApplicationSchema,
  pointSchema,
  searchApplicationsOutputSchema,
  searchApplicationsSchema,
  requestAccessSchema,
  selectDisplaySchema,
  screenshotSchema,
  scrollSchema,
  typeTextSchema,
  waitSchema,
  writeClipboardSchema,
  zoomSchema,
  captureOutputSchema,
} from './toolSchemas.js'
import { requestAccessTool } from '../tools/requestAccess.js'
import { selectDisplayTool } from '../tools/selectDisplay.js'
import { screenshotTool } from '../tools/screenshot.js'
import { zoomTool } from '../tools/zoom.js'
import { captureMetadataTool } from '../tools/captureMetadata.js'
import { cursorPositionTool } from '../tools/cursorPosition.js'
import { leftClickTool, rightClickTool, middleClickTool, doubleClickTool, tripleClickTool } from '../tools/click.js'
import { mouseMoveTool } from '../tools/mouseMove.js'
import { leftClickDragTool } from '../tools/drag.js'
import { scrollTool } from '../tools/scroll.js'
import { keyTool } from '../tools/key.js'
import { holdKeyTool } from '../tools/holdKey.js'
import { typeTextTool } from '../tools/typeText.js'
import { readClipboardTool, writeClipboardTool } from '../tools/clipboard.js'
import { openApplicationTool, listGrantedApplicationsTool } from '../tools/applications.js'
import { searchApplicationsTool } from '../tools/searchApplications.js'
import { listDisplaysTool } from '../tools/displays.js'
import { waitTool } from '../tools/wait.js'
import { computerBatchTool } from '../tools/batch.js'

function readonlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  }
}

function mutatingAnnotations() {
  return {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  }
}

function sessionStateAnnotations() {
  return {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }
}

export function createToolDefinitions(runtime: ServerRuntime): ToolDefinition[] {
  return [
    {
      name: 'request_access',
      title: 'Request Access',
      description: 'Ask the user to grant macOS permissions, app access, and capability flags for this session.',
      inputSchema: requestAccessSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      handler: createToolHandler(runtime, requestAccessTool),
    },
    {
      name: 'screenshot',
      title: 'Screenshot',
      description: 'Capture a screenshot and attach it to the tool result. Use capture_metadata for geometry or file metadata.',
      inputSchema: screenshotSchema,
      annotations: readonlyAnnotations(),
      handler: createToolHandler(runtime, screenshotTool),
    },
    {
      name: 'list_displays',
      title: 'List Displays',
      description: 'Return the currently available displays and the session display pin state.',
      inputSchema: { type: 'object', additionalProperties: false },
      outputSchema: listDisplaysOutputSchema,
      annotations: readonlyAnnotations(),
      handler: createToolHandler(runtime, async ctx => listDisplaysTool(ctx)),
    },
    {
      name: 'select_display',
      title: 'Select Display',
      description: 'Pin future screenshot-style tools to a specific display, or clear the explicit pin with auto=true.',
      inputSchema: selectDisplaySchema,
      annotations: sessionStateAnnotations(),
      handler: createToolHandler(runtime, selectDisplayTool),
    },
    {
      name: 'zoom',
      title: 'Zoom Screenshot',
      description: 'Capture a cropped screenshot region and attach it to the tool result. Use capture_metadata for geometry or file metadata.',
      inputSchema: zoomSchema,
      annotations: readonlyAnnotations(),
      handler: createToolHandler(runtime, zoomTool),
    },
    {
      name: 'capture_metadata',
      title: 'Capture Metadata',
      description: 'Return saved-path and geometry metadata for a prior screenshot or zoom by captureId.',
      inputSchema: captureMetadataSchema,
      outputSchema: captureOutputSchema,
      annotations: readonlyAnnotations(),
      handler: createToolHandler(runtime, captureMetadataTool),
    },
    {
      name: 'cursor_position',
      title: 'Cursor Position',
      description: 'Return the current cursor position in desktop coordinates.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: readonlyAnnotations(),
      handler: createToolHandler(runtime, async ctx => cursorPositionTool(ctx)),
    },
    {
      name: 'mouse_move',
      title: 'Mouse Move',
      description: 'Move the cursor to screenshot coordinates.',
      inputSchema: pointSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, mouseMoveTool),
    },
    {
      name: 'left_click',
      title: 'Left Click',
      description: 'Move to screenshot coordinates and perform a single left click.',
      inputSchema: pointSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, leftClickTool),
    },
    {
      name: 'right_click',
      title: 'Right Click',
      description: 'Move to screenshot coordinates and perform a right click.',
      inputSchema: pointSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, rightClickTool),
    },
    {
      name: 'middle_click',
      title: 'Middle Click',
      description: 'Move to screenshot coordinates and perform a middle click.',
      inputSchema: pointSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, middleClickTool),
    },
    {
      name: 'double_click',
      title: 'Double Click',
      description: 'Move to screenshot coordinates and perform a double click.',
      inputSchema: pointSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, doubleClickTool),
    },
    {
      name: 'triple_click',
      title: 'Triple Click',
      description: 'Move to screenshot coordinates and perform a triple click.',
      inputSchema: pointSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, tripleClickTool),
    },
    {
      name: 'left_click_drag',
      title: 'Left Click Drag',
      description: 'Drag from the current or explicit start point to the end point.',
      inputSchema: dragSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, leftClickDragTool),
    },
    {
      name: 'scroll',
      title: 'Scroll',
      description: 'Scroll relative to screenshot coordinates.',
      inputSchema: scrollSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, scrollTool),
    },
    {
      name: 'key',
      title: 'Press Key Sequence',
      description: 'Press a key or key chord such as command+a or escape.',
      inputSchema: keySchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, keyTool),
    },
    {
      name: 'hold_key',
      title: 'Hold Keys',
      description: 'Hold one or more keys for a bounded duration.',
      inputSchema: holdKeySchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, holdKeyTool),
    },
    {
      name: 'type',
      title: 'Type Text',
      description: 'Type text into the focused UI element.',
      inputSchema: typeTextSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, typeTextTool),
    },
    {
      name: 'read_clipboard',
      title: 'Read Clipboard',
      description: 'Read the current clipboard text if this session is allowed to do so.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: readonlyAnnotations(),
      handler: createToolHandler(runtime, async ctx => readClipboardTool(ctx)),
    },
    {
      name: 'write_clipboard',
      title: 'Write Clipboard',
      description: 'Write text to the system clipboard if this session is allowed to do so.',
      inputSchema: writeClipboardSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, writeClipboardTool),
    },
    {
      name: 'search_applications',
      title: 'Search Applications',
      description: 'Search installed or running applications and return bounded matches suitable for request_access.',
      inputSchema: searchApplicationsSchema,
      outputSchema: searchApplicationsOutputSchema,
      annotations: readonlyAnnotations(),
      handler: createToolHandler(runtime, searchApplicationsTool),
    },
    {
      name: 'open_application',
      title: 'Open Application',
      description: 'Launch or activate an application by bundle identifier.',
      inputSchema: openApplicationSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, openApplicationTool),
    },
    {
      name: 'list_granted_applications',
      title: 'List Granted Applications',
      description: 'Return the applications this session is allowed to control.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: readonlyAnnotations(),
      handler: createToolHandler(runtime, async ctx => listGrantedApplicationsTool(ctx)),
    },
    {
      name: 'wait',
      title: 'Wait',
      description: 'Sleep for a bounded duration.',
      inputSchema: waitSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, waitTool),
    },
    {
      name: 'computer_batch',
      title: 'Computer Batch',
      description: 'Execute a small sequence of low-risk computer-use actions atomically within one lock scope.',
      inputSchema: computerBatchSchema,
      annotations: mutatingAnnotations(),
      handler: createToolHandler(runtime, computerBatchTool),
    },
  ]
}
