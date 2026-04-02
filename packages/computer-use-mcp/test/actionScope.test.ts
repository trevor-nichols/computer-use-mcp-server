import test from 'node:test'
import assert from 'node:assert/strict'
import { CleanupRegistry } from '../src/session/cleanupRegistry.js'
import { createSessionContext } from '../src/session/sessionContext.js'
import { filterDisallowedBundleIdsForTargetDisplay, prepareForAction } from '../src/tools/actionScope.js'
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

test('prepareForAction excludes the host from hiding while keeping it in screenshot exclusions', async () => {
  const session = createSessionContext({
    sessionId: 'action-scope-host-session',
    connectionId: 'action-scope-host-connection',
    approvalMode: 'local-ui',
  })
  session.allowedApps = [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }]
  session.hostIdentity = {
    bundleId: 'com.apple.Terminal',
    displayName: 'Terminal',
    source: 'initialize-metadata',
  }
  session.hostIdentityResolutionAttempted = true

  const hiddenCalls: string[][] = []

  const ctx = {
    session,
    runtime: {
      logger: {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
      nativeHost: {
        screenshots: {
          async listDisplays() {
            return [{
              displayId: 1,
              name: 'Built-in',
              originX: 0,
              originY: 0,
              width: 100,
              height: 100,
              scaleFactor: 2,
              isPrimary: true,
            }]
          },
        },
        apps: {
          async listRunningApps() {
            return [
              { bundleId: 'com.apple.TextEdit', displayName: 'TextEdit', pid: 1, isFrontmost: true },
              { bundleId: 'com.apple.Notes', displayName: 'Notes', pid: 2, isFrontmost: false },
              { bundleId: 'com.apple.Terminal', displayName: 'Terminal', pid: 3, isFrontmost: false },
            ]
          },
          async findWindowDisplays() {
            return {
              'com.apple.Notes': [1],
            }
          },
          async hideApplications(bundleIds: string[]) {
            hiddenCalls.push(bundleIds)
            return bundleIds
          },
          async unhideApplications() {},
        },
      },
    },
  } as any

  const cleanup = new CleanupRegistry()
  const prepared = await prepareForAction(ctx, cleanup, {
    hideDisallowedApps: true,
    excludeDisallowedApps: true,
    excludeHostFromScreenshots: true,
  })

  assert.deepEqual(prepared.excludedBundleIds, ['com.apple.Notes', 'com.apple.Terminal'])
  assert.deepEqual(prepared.fallbackHideBundleIds, ['com.apple.Notes'])
  assert.deepEqual(prepared.hiddenBundleIds, ['com.apple.Notes'])
  assert.equal(prepared.hostBundleId, 'com.apple.Terminal')
  assert.deepEqual(hiddenCalls, [['com.apple.Notes']])
})
