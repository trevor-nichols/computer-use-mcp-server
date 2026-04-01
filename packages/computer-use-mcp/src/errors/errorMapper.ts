export interface CallToolErrorResult {
  content: Array<{ type: 'text'; text: string }>
  structuredContent: {
    ok: false
    error: {
      name: string
      message: string
    }
  }
  isError: true
}

export function toCallToolErrorResult(error: unknown): CallToolErrorResult {
  const message = error instanceof Error ? error.message : 'Unknown error'
  const name = error instanceof Error ? error.name : 'UnknownError'

  return {
    content: [{ type: 'text', text: `${name}: ${message}` }],
    structuredContent: {
      ok: false,
      error: {
        name,
        message,
      },
    },
    isError: true,
  }
}
