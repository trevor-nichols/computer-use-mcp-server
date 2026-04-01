import test from 'node:test'
import assert from 'node:assert/strict'
import { mapScreenshotPointToDesktop } from '../src/transforms/coordinates.js'

test('mapScreenshotPointToDesktop maps screenshot coordinates into logical display space', () => {
  const point = mapScreenshotPointToDesktop(
    { x: 50, y: 25 },
    {
      width: 100,
      height: 50,
      displayId: 1,
      originX: 10,
      originY: 20,
      logicalWidth: 200,
      logicalHeight: 100,
      scaleFactor: 2,
    },
  )

  assert.equal(point.x, 110)
  assert.equal(point.y, 70)
})
