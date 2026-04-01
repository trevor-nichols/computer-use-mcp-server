import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveScreenshotTargetSize } from '../src/transforms/screenshotSizing.js'

test('resolveScreenshotTargetSize downsizes larger displays proportionally', () => {
  const size = resolveScreenshotTargetSize(
    {
      displayId: 1,
      originX: 0,
      originY: 0,
      width: 3000,
      height: 2000,
      scaleFactor: 2,
      isPrimary: true,
    },
    1500,
  )

  assert.equal(size.width, 1500)
  assert.equal(size.height, 1000)
})
