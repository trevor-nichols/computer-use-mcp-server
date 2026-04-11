import Ajv2020Module, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'

export type JsonSchemaObject = Record<string, unknown>

export interface ValidationIssue {
  instancePath: string
  schemaPath: string
  keyword: string
  message: string
  params: Record<string, unknown>
}

export interface SchemaValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

export interface CompiledSchemaValidator {
  readonly schema: JsonSchemaObject
  validate(value: unknown): SchemaValidationResult
}

const Ajv2020 = Ajv2020Module as unknown as new (options?: Record<string, unknown>) => { compile(schema: object): ValidateFunction }

const ajv = new Ajv2020({
  strict: false,
  allErrors: true,
  allowUnionTypes: true,
  validateFormats: false,
})

function normalizeIssue(error: ErrorObject<string, Record<string, unknown>, unknown>): ValidationIssue {
  return {
    instancePath: error.instancePath || '/',
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? 'Invalid value.',
    params: error.params,
  }
}

export function compileSchemaValidator(schema: JsonSchemaObject): CompiledSchemaValidator {
  const compiled: ValidateFunction = ajv.compile(schema)

  return {
    schema,
    validate(value: unknown): SchemaValidationResult {
      const valid = Boolean(compiled(value))
      return {
        valid,
        issues: valid ? [] : (compiled.errors ?? []).map(normalizeIssue),
      }
    },
  }
}
