import test from 'node:test'
import assert from 'node:assert/strict'
import { filterDisallowedBundleIdsForTargetDisplay } from '../src/tools/actionScope.js'

test('filterDisallowedBundleIdsForTargetDisplay keeps only apps with windows on the target display', () => {
  const result = filterDisallowedBundleIdsForTargetDisplay(
    ['com.apple.Notes', 'com.apple.Terminal', 'com.apple.systemevents'],
    {
      'com.apple.Notes': [3],
      'com.apple.Terminal': [2],
    },
    3,
  )

  assert.deepEqual(result, ['com.apple.Notes'])
})

test('filterDisallowedBundleIdsForTargetDisplay drops background apps without windows', () => {
  const result = filterDisallowedBundleIdsForTargetDisplay(
    ['com.apple.Notes', 'com.apple.systemevents'],
    {
      'com.apple.Notes': [3],
    },
    undefined,
  )

  assert.deepEqual(result, ['com.apple.Notes'])
})
