const allowedAppItem = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bundleId: { type: 'string' },
    displayName: { type: 'string' },
    path: { type: 'string' },
  },
  required: ['bundleId', 'displayName'],
}

export const requestAccessSchema = {
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

export const screenshotSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    displayId: { type: 'integer' },
  },
}

export const zoomSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
    displayId: { type: 'integer' },
  },
  required: ['x', 'y', 'width', 'height'],
}

export const pointSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
  },
  required: ['x', 'y'],
}

export const dragSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fromX: { type: 'number' },
    fromY: { type: 'number' },
    toX: { type: 'number' },
    toY: { type: 'number' },
  },
  required: ['toX', 'toY'],
}

export const scrollSchema = {
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

export const typeTextSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    viaClipboard: { type: 'boolean', default: true },
  },
  required: ['text'],
}

export const keySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sequence: { type: 'string' },
    repeat: { type: 'integer', minimum: 1, maximum: 20, default: 1 },
  },
  required: ['sequence'],
}

export const holdKeySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    keys: { type: 'array', items: { type: 'string' }, minItems: 1 },
    durationMs: { type: 'integer', minimum: 1, maximum: 10000 },
  },
  required: ['keys', 'durationMs'],
}

export const openApplicationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bundleId: { type: 'string' },
  },
  required: ['bundleId'],
}

export const waitSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    durationMs: { type: 'integer', minimum: 1, maximum: 10000 },
  },
  required: ['durationMs'],
}

export const writeClipboardSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
  },
  required: ['text'],
}

export const computerBatchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tool: { type: 'string' },
          arguments: { type: 'object' },
        },
        required: ['tool'],
      },
      minItems: 1,
    },
  },
  required: ['actions'],
}
