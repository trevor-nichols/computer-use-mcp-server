import test from 'node:test'
import assert from 'node:assert/strict'
import { captureWithFallback } from '../src/tools/captureWithFallback.js'
import { createLogger } from '../src/observability/logger.js'
import { createSessionContext } from '../src/session/sessionContext.js'

test('captureWithFallback retries with temporary app hiding when exclusion capture fails', async () => {
  const logger = createLogger()
  const session = createSessionContext({
    sessionId: 'capture-fallback-session',
    connectionId: 'capture-fallback-connection',
    approvalMode: 'local-ui',
  })

  const captureCalls: Array<string[]> = []
  const hiddenCalls: string[][] = []
  const unhiddenCalls: string[][] = []

  const runtime = {
    logger,
    nativeHost: {
      screenshots: {
        async capture(options: { excludeBundleIds?: string[] }) {
          captureCalls.push(options.excludeBundleIds ?? [])
          if ((options.excludeBundleIds ?? []).length > 0) {
            throw new Error('ScreenCaptureKit capture failed')
          }
          return {
            dataBase64: 'abc',
            mimeType: 'image/png',
            width: 10,
            height: 10,
            display: {
              displayId: 1,
              originX: 0,
              originY: 0,
              width: 10,
              height: 10,
              scaleFactor: 1,
              isPrimary: true,
            },
          }
        },
      },
      apps: {
        async hideApplications(bundleIds: string[]) {
          hiddenCalls.push(bundleIds)
          return bundleIds
        },
        async unhideApplications(bundleIds: string[]) {
          unhiddenCalls.push(bundleIds)
        },
      },
    },
  }

  const prepared = {
    targetDisplayId: 1,
    excludedBundleIds: ['com.apple.Notes'],
    fallbackHideBundleIds: ['com.apple.Notes'],
    hiddenBundleIds: [],
  }

  const result = await captureWithFallback({ runtime, session } as any, prepared, {
    displayId: 1,
    format: 'png',
    targetWidth: 10,
    targetHeight: 10,
  })

  assert.equal(result.dataBase64, 'abc')
  assert.deepEqual(captureCalls, [['com.apple.Notes'], []])
  assert.deepEqual(hiddenCalls, [['com.apple.Notes']])
  assert.deepEqual(unhiddenCalls, [['com.apple.Notes']])
})

test('captureWithFallback does not hide apps already hidden by the outer scope', async () => {
  const logger = createLogger()
  const session = createSessionContext({
    sessionId: 'capture-fallback-hidden-session',
    connectionId: 'capture-fallback-hidden-connection',
    approvalMode: 'local-ui',
  })

  let hideCalled = false
  let unhideCalled = false
  const captureCalls: Array<string[]> = []

  const runtime = {
    logger,
    nativeHost: {
      screenshots: {
        async capture(options: { excludeBundleIds?: string[] }) {
          captureCalls.push(options.excludeBundleIds ?? [])
          return {
            dataBase64: 'abc',
            mimeType: 'image/png',
            width: 10,
            height: 10,
            display: {
              displayId: 1,
              originX: 0,
              originY: 0,
              width: 10,
              height: 10,
              scaleFactor: 1,
              isPrimary: true,
            },
          }
        },
      },
      apps: {
        async hideApplications() {
          hideCalled = true
          return []
        },
        async unhideApplications() {
          unhideCalled = true
        },
      },
    },
  }

  const result = await captureWithFallback({ runtime, session } as any, {
    targetDisplayId: 1,
    excludedBundleIds: ['com.apple.Notes'],
    fallbackHideBundleIds: ['com.apple.Notes'],
    hiddenBundleIds: ['com.apple.Notes'],
  }, {
    displayId: 1,
    format: 'png',
    targetWidth: 10,
    targetHeight: 10,
  })

  assert.equal(result.dataBase64, 'abc')
  assert.deepEqual(captureCalls, [[]])
  assert.equal(hideCalled, false)
  assert.equal(unhideCalled, false)
})

test('captureWithFallback only excludes apps that remain visible after the outer scope hides others', async () => {
  const logger = createLogger()
  const session = createSessionContext({
    sessionId: 'capture-fallback-partial-hidden-session',
    connectionId: 'capture-fallback-partial-hidden-connection',
    approvalMode: 'local-ui',
  })

  const captureCalls: Array<string[]> = []
  const hiddenCalls: string[][] = []
  const unhiddenCalls: string[][] = []

  const runtime = {
    logger,
    nativeHost: {
      screenshots: {
        async capture(options: { excludeBundleIds?: string[] }) {
          captureCalls.push(options.excludeBundleIds ?? [])
          if ((options.excludeBundleIds ?? []).includes('com.apple.Terminal')) {
            throw new Error('ScreenCaptureKit capture failed')
          }
          return {
            dataBase64: 'abc',
            mimeType: 'image/png',
            width: 10,
            height: 10,
            display: {
              displayId: 1,
              originX: 0,
              originY: 0,
              width: 10,
              height: 10,
              scaleFactor: 1,
              isPrimary: true,
            },
          }
        },
      },
      apps: {
        async hideApplications(bundleIds: string[]) {
          hiddenCalls.push(bundleIds)
          return bundleIds
        },
        async unhideApplications(bundleIds: string[]) {
          unhiddenCalls.push(bundleIds)
        },
      },
    },
  }

  const result = await captureWithFallback({ runtime, session } as any, {
    targetDisplayId: 1,
    excludedBundleIds: ['com.apple.Notes', 'com.apple.Terminal'],
    fallbackHideBundleIds: ['com.apple.Notes', 'com.apple.Terminal'],
    hiddenBundleIds: ['com.apple.Notes'],
  }, {
    displayId: 1,
    format: 'png',
    targetWidth: 10,
    targetHeight: 10,
  })

  assert.equal(result.dataBase64, 'abc')
  assert.deepEqual(captureCalls, [['com.apple.Terminal'], []])
  assert.deepEqual(hiddenCalls, [['com.apple.Terminal']])
  assert.deepEqual(unhiddenCalls, [['com.apple.Terminal']])
})

test('captureWithFallback never hides the host bundle during fallback capture', async () => {
  const logger = createLogger()
  const session = createSessionContext({
    sessionId: 'capture-fallback-host-session',
    connectionId: 'capture-fallback-host-connection',
    approvalMode: 'local-ui',
  })

  const captureCalls: Array<string[]> = []
  const hiddenCalls: string[][] = []

  const runtime = {
    logger,
    nativeHost: {
      screenshots: {
        async capture(options: { excludeBundleIds?: string[] }) {
          captureCalls.push(options.excludeBundleIds ?? [])
          if ((options.excludeBundleIds ?? []).includes('com.apple.Terminal')) {
            throw new Error('ScreenCaptureKit capture failed')
          }
          return {
            dataBase64: 'abc',
            mimeType: 'image/png',
            width: 10,
            height: 10,
            display: {
              displayId: 1,
              originX: 0,
              originY: 0,
              width: 10,
              height: 10,
              scaleFactor: 1,
              isPrimary: true,
            },
          }
        },
      },
      apps: {
        async hideApplications(bundleIds: string[]) {
          hiddenCalls.push(bundleIds)
          return bundleIds
        },
        async unhideApplications() {},
      },
    },
  }

  const result = await captureWithFallback({ runtime, session } as any, {
    targetDisplayId: 1,
    excludedBundleIds: ['com.apple.Terminal'],
    fallbackHideBundleIds: [],
    hiddenBundleIds: [],
    hostBundleId: 'com.apple.Terminal',
  }, {
    displayId: 1,
    format: 'png',
    targetWidth: 10,
    targetHeight: 10,
  })

  assert.equal(result.dataBase64, 'abc')
  assert.deepEqual(captureCalls, [['com.apple.Terminal'], []])
  assert.deepEqual(hiddenCalls, [])
})
