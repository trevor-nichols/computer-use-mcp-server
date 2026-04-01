import test from 'node:test'
import assert from 'node:assert/strict'
import { filterDisallowedBundleIdsForTargetDisplay } from '../src/tools/actionScope.js'
import { resolveTargetDisplayId } from '../src/tools/displayTargeting.js'

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

test('resolveTargetDisplayId prefers an explicit display id when present', () => {
  const result = resolveTargetDisplayId(
    {
      session: {
        displayPinnedByModel: true,
        selectedDisplayId: 3,
        lastScreenshotDims: { displayId: 2 },
      },
    } as any,
    [1, 2, 3],
    1,
  )

  assert.equal(result, 1)
})

test('resolveTargetDisplayId honors a pinned session display', () => {
  const result = resolveTargetDisplayId(
    {
      session: {
        displayPinnedByModel: true,
        selectedDisplayId: 3,
        lastScreenshotDims: { displayId: 2 },
      },
    } as any,
    [1, 2, 3],
  )

  assert.equal(result, 3)
})

test('resolveTargetDisplayId falls back to the last screenshot display when the session is not pinned', () => {
  const result = resolveTargetDisplayId(
    {
      session: {
        displayPinnedByModel: false,
        selectedDisplayId: 3,
        lastScreenshotDims: { displayId: 2 },
      },
    } as any,
    [1, 2, 3],
  )

  assert.equal(result, 2)
})
