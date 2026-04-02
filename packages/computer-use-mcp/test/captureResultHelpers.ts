import assert from 'node:assert/strict'

export function extractCaptureId(result: { content?: Array<{ type?: string; text?: string }> }) {
  const text = result.content?.find(item => item.type === 'text')?.text ?? ''
  const match = /captureId=([A-Za-z0-9-]+)/.exec(text)
  assert.notEqual(match, null, `missing captureId in tool result text: ${text}`)
  return match![1]
}
