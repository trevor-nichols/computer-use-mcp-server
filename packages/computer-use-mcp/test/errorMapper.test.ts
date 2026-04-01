import test from 'node:test'
import assert from 'node:assert/strict'
import { toCallToolErrorResult } from '../src/errors/errorMapper.js'

test('toCallToolErrorResult preserves error name and message', () => {
  const result = toCallToolErrorResult(new Error('boom'))
  assert.equal(result.isError, true)
  assert.equal(result.structuredContent.error.name, 'Error')
  assert.equal(result.structuredContent.error.message, 'boom')
})
