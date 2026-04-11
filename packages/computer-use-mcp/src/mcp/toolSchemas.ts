import type { JsonSchemaObject } from './schemaValidator.js'

const allowedAppItem: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bundleId: { type: 'string' },
    displayName: { type: 'string' },
    path: { type: 'string' },
  },
  required: ['bundleId', 'displayName'],
}

const grantFlagsSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    clipboardRead: { type: 'boolean' },
    clipboardWrite: { type: 'boolean' },
    systemKeyCombos: { type: 'boolean' },
  },
  required: ['clipboardRead', 'clipboardWrite', 'systemKeyCombos'],
}

const tccStateSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    accessibility: { type: 'boolean' },
    screenRecording: { type: 'boolean' },
  },
  required: ['accessibility', 'screenRecording'],
}

const pointStructuredContentProperties: Record<string, unknown> = {
  x: { type: 'number' },
  y: { type: 'number' },
}

const pointStructuredContentRequired = ['x', 'y']

const pointStructuredContentSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: pointStructuredContentProperties,
  required: pointStructuredContentRequired,
}

export const requestAccessSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    apps: {
      type: 'array',
      items: allowedAppItem,
      default: [],
    },
    flags: {
      type: 'object',
      additionalProperties: false,
      properties: {
        clipboardRead: { type: 'boolean' },
        clipboardWrite: { type: 'boolean' },
        systemKeyCombos: { type: 'boolean' },
      },
      default: {},
    },
  },
}

export const requestAccessOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    grantedApps: {
      type: 'array',
      items: allowedAppItem,
    },
    deniedApps: {
      type: 'array',
      items: allowedAppItem,
    },
    effectiveFlags: grantFlagsSchema,
    tccState: tccStateSchema,
  },
  required: ['ok', 'grantedApps', 'deniedApps', 'effectiveFlags', 'tccState'],
}

export const screenshotSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    displayId: { type: 'integer' },
  },
}

export const displayInfoSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    displayId: { type: 'integer' },
    name: { type: 'string' },
    originX: { type: 'number' },
    originY: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
    scaleFactor: { type: 'number' },
    isPrimary: { type: 'boolean' },
  },
  required: ['displayId', 'originX', 'originY', 'width', 'height', 'scaleFactor', 'isPrimary'],
}

export const listDisplaysOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    displayPinnedByModel: { type: 'boolean' },
    selectedDisplayId: {
      anyOf: [{ type: 'integer' }, { type: 'null' }],
    },
    displays: {
      type: 'array',
      items: displayInfoSchema,
    },
  },
  required: ['ok', 'displayPinnedByModel', 'selectedDisplayId', 'displays'],
}

export const selectDisplaySchema: JsonSchemaObject = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        displayId: { type: 'integer' },
      },
      required: ['displayId'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        displayName: { type: 'string', minLength: 1 },
      },
      required: ['displayName'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        auto: { const: true },
      },
      required: ['auto'],
    },
  ],
}

export const selectDisplayOutputSchema: JsonSchemaObject = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean' },
        mode: { const: 'auto' },
        displayPinnedByModel: { const: false },
        selectedDisplayId: { type: 'null' },
        availableDisplays: {
          type: 'array',
          items: displayInfoSchema,
        },
      },
      required: ['ok', 'mode', 'displayPinnedByModel', 'selectedDisplayId', 'availableDisplays'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean' },
        mode: { const: 'pinned' },
        displayPinnedByModel: { const: true },
        selectedDisplayId: { type: 'integer' },
        selectedDisplay: displayInfoSchema,
        availableDisplays: {
          type: 'array',
          items: displayInfoSchema,
        },
      },
      required: ['ok', 'mode', 'displayPinnedByModel', 'selectedDisplayId', 'selectedDisplay', 'availableDisplays'],
    },
  ],
}

export const zoomSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number', exclusiveMinimum: 0 },
    height: { type: 'number', exclusiveMinimum: 0 },
    displayId: { type: 'integer' },
  },
  required: ['x', 'y', 'width', 'height'],
}

export const captureOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    captureId: { type: 'string' },
    imagePath: { type: 'string' },
    mimeType: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    displayId: { type: 'number' },
    originX: { type: 'number' },
    originY: { type: 'number' },
    logicalWidth: { type: 'number' },
    logicalHeight: { type: 'number' },
    scaleFactor: { type: 'number' },
    excludedBundleIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['ok', 'captureId', 'imagePath', 'mimeType', 'width', 'height', 'displayId', 'originX', 'originY', 'excludedBundleIds'],
}

export const captureMetadataSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    captureId: { type: 'string', minLength: 1 },
  },
  required: ['captureId'],
}

export const pointSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
  },
  required: ['x', 'y'],
}

export const cursorPositionOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    ...pointStructuredContentProperties,
  },
  required: ['ok', ...pointStructuredContentRequired],
}

export const pointOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    ...pointStructuredContentProperties,
  },
  required: ['ok', ...pointStructuredContentRequired],
}

export const clickOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    ...pointStructuredContentProperties,
    button: { type: 'string', enum: ['left', 'right', 'middle'] },
    count: { type: 'integer', enum: [1, 2, 3] },
  },
  required: ['ok', 'x', 'y', 'button', 'count'],
}

export const dragSchema: JsonSchemaObject = {
  allOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        fromX: { type: 'number' },
        fromY: { type: 'number' },
        toX: { type: 'number' },
        toY: { type: 'number' },
      },
      required: ['toX', 'toY'],
    },
    {
      oneOf: [
        {
          not: {
            anyOf: [{ required: ['fromX'] }, { required: ['fromY'] }],
          },
        },
        {
          required: ['fromX', 'fromY'],
        },
      ],
    },
  ],
}

export const dragOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    from: pointStructuredContentSchema,
    to: pointStructuredContentSchema,
  },
  required: ['ok', 'from', 'to'],
}

export const scrollSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    dx: { type: 'number' },
    dy: { type: 'number' },
  },
  required: ['x', 'y', 'dx', 'dy'],
}

export const scrollOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    x: { type: 'number' },
    y: { type: 'number' },
    dx: { type: 'number' },
    dy: { type: 'number' },
  },
  required: ['ok', 'x', 'y', 'dx', 'dy'],
}

export const typeTextSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    viaClipboard: { type: 'boolean', default: true },
  },
  required: ['text'],
}

export const typeTextOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    viaClipboard: { type: 'boolean' },
  },
  required: ['ok', 'viaClipboard'],
}

export const keySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sequence: { type: 'string', minLength: 1 },
    repeat: { type: 'integer', minimum: 1, maximum: 20, default: 1 },
  },
  required: ['sequence'],
}

export const keyOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    sequence: { type: 'string' },
    repeat: { type: 'integer' },
  },
  required: ['ok', 'sequence', 'repeat'],
}

export const holdKeySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    keys: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
    durationMs: { type: 'integer', minimum: 1, maximum: 10000 },
  },
  required: ['keys', 'durationMs'],
}

export const holdKeyOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    keys: { type: 'array', items: { type: 'string' } },
    durationMs: { type: 'integer' },
  },
  required: ['ok', 'keys', 'durationMs'],
}

export const openApplicationSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bundleId: { type: 'string', minLength: 1 },
  },
  required: ['bundleId'],
}

export const openApplicationOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    bundleId: { type: 'string' },
  },
  required: ['ok', 'bundleId'],
}

export const listGrantedApplicationsOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    apps: {
      type: 'array',
      items: allowedAppItem,
    },
  },
  required: ['ok', 'apps'],
}

export const searchApplicationsSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', minLength: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 25, default: 8 },
    source: {
      type: 'string',
      enum: ['all', 'running', 'installed'],
      default: 'all',
    },
    includePaths: { type: 'boolean', default: false },
  },
  required: ['query'],
}

export const searchApplicationsOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    query: { type: 'string' },
    source: {
      type: 'string',
      enum: ['all', 'running', 'installed'],
    },
    limit: { type: 'integer' },
    totalMatches: { type: 'integer' },
    hasMore: { type: 'boolean' },
    apps: {
      type: 'array',
      items: allowedAppItem,
    },
  },
  required: ['ok', 'query', 'source', 'limit', 'totalMatches', 'hasMore', 'apps'],
}

export const waitSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    durationMs: { type: 'integer', minimum: 1, maximum: 10000 },
  },
  required: ['durationMs'],
}

export const waitOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    durationMs: { type: 'integer' },
  },
  required: ['ok', 'durationMs'],
}

export const writeClipboardSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
  },
  required: ['text'],
}

export const clipboardOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    text: { type: 'string' },
  },
  required: ['ok', 'text'],
}

function batchActionSchema(tool: string, argumentsSchema: JsonSchemaObject, argumentsOptional = false): JsonSchemaObject {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      tool: { const: tool },
      arguments: argumentsSchema,
    },
    required: argumentsOptional ? ['tool'] : ['tool', 'arguments'],
  }
}

const noArgumentSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
}

export const batchableToolInputSchemas: Record<string, JsonSchemaObject> = {
  mouse_move: pointSchema,
  left_click: pointSchema,
  right_click: pointSchema,
  middle_click: pointSchema,
  double_click: pointSchema,
  triple_click: pointSchema,
  left_click_drag: dragSchema,
  scroll: scrollSchema,
  key: keySchema,
  hold_key: holdKeySchema,
  type: typeTextSchema,
  read_clipboard: noArgumentSchema,
  write_clipboard: writeClipboardSchema,
  wait: waitSchema,
  open_application: openApplicationSchema,
}

export const computerBatchSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    actions: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          batchActionSchema('mouse_move', pointSchema),
          batchActionSchema('left_click', pointSchema),
          batchActionSchema('right_click', pointSchema),
          batchActionSchema('middle_click', pointSchema),
          batchActionSchema('double_click', pointSchema),
          batchActionSchema('triple_click', pointSchema),
          batchActionSchema('left_click_drag', dragSchema),
          batchActionSchema('scroll', scrollSchema),
          batchActionSchema('key', keySchema),
          batchActionSchema('hold_key', holdKeySchema),
          batchActionSchema('type', typeTextSchema),
          batchActionSchema('read_clipboard', noArgumentSchema, true),
          batchActionSchema('write_clipboard', writeClipboardSchema),
          batchActionSchema('wait', waitSchema),
          batchActionSchema('open_application', openApplicationSchema),
        ],
      },
    },
  },
  required: ['actions'],
}

export const computerBatchOutputSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tool: { type: 'string' },
          result: { type: 'object' },
        },
        required: ['tool', 'result'],
      },
    },
  },
  required: ['ok', 'results'],
}
