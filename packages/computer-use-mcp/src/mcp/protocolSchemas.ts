import type { JsonSchemaObject } from './schemaValidator.js'

const arbitraryObjectSchema: JsonSchemaObject = {
  type: 'object',
}

export const initializeParamsSchema: JsonSchemaObject = {
  type: 'object',
  required: ['protocolVersion', 'capabilities', 'clientInfo'],
  additionalProperties: true,
  properties: {
    protocolVersion: {
      type: 'string',
      minLength: 1,
    },
    capabilities: arbitraryObjectSchema,
    clientInfo: {
      type: 'object',
      required: ['name'],
      additionalProperties: true,
      properties: {
        name: {
          type: 'string',
          minLength: 1,
        },
        version: {
          type: 'string',
        },
      },
    },
  },
}

export const initializedNotificationParamsSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: true,
}

export const toolsListParamsSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cursor: {
      type: 'string',
    },
    _meta: arbitraryObjectSchema,
  },
}

export const toolsCallParamsSchema: JsonSchemaObject = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      minLength: 1,
    },
    arguments: {
      type: 'object',
    },
    _meta: arbitraryObjectSchema,
  },
}
