export type JsonRpcId = string | number

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: unknown
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export interface JsonRpcErrorObject {
  code: number
  message: string
  data?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: JsonRpcId
  result?: unknown
  error?: JsonRpcErrorObject
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse

export function success(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

export function failure(id: JsonRpcId | undefined, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    ...(id !== undefined ? { id } : {}),
    error: { code, message, data },
  }
}

export function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === 'string' || typeof value === 'number'
}

export function readJsonRpcId(value: unknown): JsonRpcId | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const maybe = value as Record<string, unknown>
  return isJsonRpcId(maybe.id) ? maybe.id : undefined
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== 'object' || value === null) return false
  const maybe = value as Record<string, unknown>
  return (
    maybe.jsonrpc === '2.0' &&
    typeof maybe.method === 'string' &&
    isJsonRpcId(maybe.id) &&
    !('result' in maybe) &&
    !('error' in maybe)
  )
}

export function isJsonRpcNotification(value: unknown): value is JsonRpcNotification {
  if (typeof value !== 'object' || value === null) return false
  const maybe = value as Record<string, unknown>
  return (
    maybe.jsonrpc === '2.0' &&
    typeof maybe.method === 'string' &&
    !('id' in maybe) &&
    !('result' in maybe) &&
    !('error' in maybe)
  )
}

export function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (typeof value !== 'object' || value === null) return false
  const maybe = value as Record<string, unknown>
  const hasResult = 'result' in maybe
  const hasError = 'error' in maybe

  if (maybe.jsonrpc !== '2.0' || typeof maybe.method === 'string') return false
  if (hasResult === hasError) return false
  if ('id' in maybe && maybe.id !== undefined && !isJsonRpcId(maybe.id)) return false

  if (hasError) {
    if (typeof maybe.error !== 'object' || maybe.error === null) return false
    const error = maybe.error as Record<string, unknown>
    return typeof error.code === 'number' && typeof error.message === 'string'
  }

  return true
}
