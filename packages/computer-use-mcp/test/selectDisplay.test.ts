import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDisplaySelection } from '../src/tools/selectDisplay.js'

const displays = [
  {
    displayId: 1,
    name: 'Studio Display',
    originX: 0,
    originY: 0,
    width: 1512,
    height: 982,
    scaleFactor: 2,
    isPrimary: true,
  },
  {
    displayId: 2,
    name: 'Projector',
    originX: 1512,
    originY: 0,
    width: 1920,
    height: 1080,
    scaleFactor: 1,
    isPrimary: false,
  },
]

test('resolveDisplaySelection resolves a display by id', () => {
  const result = resolveDisplaySelection({ displayId: 2 }, displays)

  if (result.mode !== 'pinned') {
    throw new Error('expected a pinned display selection result')
  }

  assert.equal(result.display.displayId, 2)
})

test('resolveDisplaySelection resolves a display by case-insensitive name', () => {
  const result = resolveDisplaySelection({ displayName: ' studio display ' }, displays)

  if (result.mode !== 'pinned') {
    throw new Error('expected a pinned display selection result')
  }

  assert.equal(result.display.displayId, 1)
})

test('resolveDisplaySelection supports auto mode', () => {
  const result = resolveDisplaySelection({ auto: true }, displays)

  assert.deepEqual(result, { mode: 'auto' })
})

test('resolveDisplaySelection requires exactly one selection mode', () => {
  assert.throws(
    () => resolveDisplaySelection({ displayId: 1, auto: true }, displays),
    /exactly one of displayId, displayName, or auto=true/i,
  )
})
