import test from 'node:test'
import assert from 'node:assert/strict'
import { createCaptureActionScopeOptions } from '../src/tools/captureScope.js'

test('capture scope uses screenshot exclusion instead of pre-hiding when both are enabled', () => {
  const options = createCaptureActionScopeOptions({
    hideDisallowedBeforeAction: true,
    excludeDisallowedFromScreenshots: true,
  } as any, 7, true)

  assert.deepEqual(options, {
    acquireLock: true,
    hideDisallowedApps: false,
    excludeDisallowedApps: true,
    explicitDisplayId: 7,
    autoTargetDisplay: false,
  })
})

test('capture scope still hides disallowed apps when screenshot exclusion is disabled', () => {
  const options = createCaptureActionScopeOptions({
    hideDisallowedBeforeAction: true,
    excludeDisallowedFromScreenshots: false,
  } as any, undefined)

  assert.deepEqual(options, {
    acquireLock: true,
    hideDisallowedApps: true,
    excludeDisallowedApps: false,
    explicitDisplayId: undefined,
    autoTargetDisplay: false,
  })
})

test('capture scope can opt screenshot actions into auto-target display resolution', () => {
  const options = createCaptureActionScopeOptions({
    hideDisallowedBeforeAction: false,
    excludeDisallowedFromScreenshots: true,
  } as any, undefined, true)

  assert.deepEqual(options, {
    acquireLock: true,
    hideDisallowedApps: false,
    excludeDisallowedApps: true,
    explicitDisplayId: undefined,
    autoTargetDisplay: true,
  })
})
