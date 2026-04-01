import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionContext } from '../src/session/sessionContext.js'
import {
  buildAllowedAppsKey,
  pickBestAutoTargetDisplayId,
  resolvePreparedDisplayTarget,
} from '../src/tools/displayTargeting.js'

const displays = [
  {
    displayId: 1,
    name: 'Built-in',
    originX: 0,
    originY: 0,
    width: 1512,
    height: 982,
    scaleFactor: 2,
    isPrimary: true,
  },
  {
    displayId: 2,
    name: 'Studio Display',
    originX: 1512,
    originY: 0,
    width: 2560,
    height: 1440,
    scaleFactor: 2,
    isPrimary: false,
  },
  {
    displayId: 3,
    name: 'Projector',
    originX: 4072,
    originY: 0,
    width: 1920,
    height: 1080,
    scaleFactor: 1,
    isPrimary: false,
  },
]

function createContext() {
  const session = createSessionContext({
    sessionId: 'display-targeting-session',
    connectionId: 'display-targeting-connection',
    approvalMode: 'local-ui',
  })

  let findCalls = 0
  let nextWindowDisplays: Record<string, number[]> = {}

  const ctx = {
    session,
    runtime: {
      nativeHost: {
        apps: {
          async findWindowDisplays() {
            findCalls += 1
            return nextWindowDisplays
          },
        },
      },
    },
  } as any

  return {
    ctx,
    setWindowDisplays(windowDisplays: Record<string, number[]>) {
      nextWindowDisplays = windowDisplays
    },
    getFindCalls() {
      return findCalls
    },
  }
}

test('buildAllowedAppsKey sorts and deduplicates bundle ids', () => {
  const key = buildAllowedAppsKey([
    { bundleId: 'com.apple.Notes', displayName: 'Notes' },
    { bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' },
    { bundleId: 'com.apple.Notes', displayName: 'Notes' },
  ])

  assert.equal(key, 'com.apple.Notes,com.apple.TextEdit')
})

test('pickBestAutoTargetDisplayId chooses the display with the most visible allowed apps', () => {
  const displayId = pickBestAutoTargetDisplayId(displays, {
    'com.apple.Notes': [2],
    'com.apple.TextEdit': [2],
    'com.apple.Calendar': [1],
  })

  assert.equal(displayId, 2)
})

test('pickBestAutoTargetDisplayId breaks ties by primary display and then display id', () => {
  const primaryTie = pickBestAutoTargetDisplayId(displays, {
    'com.apple.Notes': [1],
    'com.apple.TextEdit': [2],
  })
  const lowestIdTie = pickBestAutoTargetDisplayId(displays, {
    'com.apple.Notes': [2],
    'com.apple.TextEdit': [3],
  })

  assert.equal(primaryTie, 1)
  assert.equal(lowestIdTie, 2)
})

test('resolvePreparedDisplayTarget reuses a cached auto-target when the allowed-app set matches', async () => {
  const { ctx, getFindCalls } = createContext()
  ctx.session.allowedApps = [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }]
  ctx.session.selectedDisplayId = 2
  ctx.session.displayPinnedByModel = false
  ctx.session.displayResolvedForAppsKey = 'com.apple.TextEdit'

  const result = await resolvePreparedDisplayTarget(ctx, displays, {
    autoTargetDisplay: true,
  })

  assert.equal(result.targetDisplayId, 2)
  assert.equal(result.displayResolvedForAppsKey, 'com.apple.TextEdit')
  assert.equal(getFindCalls(), 0)
})

test('resolvePreparedDisplayTarget re-resolves when the allowed-app set changes', async () => {
  const { ctx, setWindowDisplays, getFindCalls } = createContext()
  ctx.session.allowedApps = [
    { bundleId: 'com.apple.Notes', displayName: 'Notes' },
    { bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' },
  ]
  ctx.session.selectedDisplayId = 1
  ctx.session.displayPinnedByModel = false
  ctx.session.displayResolvedForAppsKey = 'com.apple.TextEdit'
  setWindowDisplays({
    'com.apple.Notes': [2],
    'com.apple.TextEdit': [2],
  })

  const result = await resolvePreparedDisplayTarget(ctx, displays, {
    autoTargetDisplay: true,
  })

  assert.equal(result.targetDisplayId, 2)
  assert.equal(result.displayResolvedForAppsKey, 'com.apple.Notes,com.apple.TextEdit')
  assert.equal(getFindCalls(), 1)
})

test('resolvePreparedDisplayTarget falls back without caching when no allowed app windows are visible', async () => {
  const { ctx, setWindowDisplays } = createContext()
  ctx.session.allowedApps = [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }]
  ctx.session.displayPinnedByModel = false
  ctx.session.lastScreenshotDims = { displayId: 3, width: 100, height: 100, originX: 0, originY: 0 }
  setWindowDisplays({})

  const result = await resolvePreparedDisplayTarget(ctx, displays, {
    autoTargetDisplay: true,
  })

  assert.equal(result.targetDisplayId, 3)
  assert.equal(result.displayResolvedForAppsKey, undefined)
})
