import test from 'node:test'
import assert from 'node:assert/strict'
import { AppResolutionError } from '../src/errors/errorTypes.js'
import type { AllowedApp, InstalledAppInfo, RunningAppInfo } from '../src/native/bridgeTypes.js'
import { createSessionContext } from '../src/session/sessionContext.js'
import { searchApplicationsTool } from '../src/tools/searchApplications.js'

function createContext(input?: {
  runningApps?: RunningAppInfo[]
  installedApps?: InstalledAppInfo[]
  grantedApps?: AllowedApp[]
}) {
  const session = createSessionContext({
    sessionId: 'search-applications-session',
    connectionId: 'search-applications-connection',
    approvalMode: 'local-ui',
  })
  session.allowedApps = input?.grantedApps ?? []

  return {
    session,
    runtime: {
      nativeHost: {
        apps: {
          async listRunningApps() {
            return input?.runningApps ?? []
          },
          async listInstalledApps() {
            return input?.installedApps ?? []
          },
        },
      },
    },
  } as any
}

test('searchApplicationsTool returns bounded deterministic matches for all sources', async () => {
  const ctx = createContext({
    runningApps: [
      { bundleId: 'com.apple.Notes', displayName: 'Notes', pid: 10, isFrontmost: true },
      { bundleId: 'com.apple.TextEdit', displayName: 'TextEdit', pid: 11, isFrontmost: false },
    ],
    installedApps: [
      { bundleId: 'com.apple.Notes', displayName: 'Notes', path: '/System/Applications/Notes.app' },
      { bundleId: 'com.example.NotesWriter', displayName: 'NotesWriter', path: '/Applications/NotesWriter.app' },
      { bundleId: 'com.apple.Calculator', displayName: 'Calculator', path: '/System/Applications/Calculator.app' },
    ],
    grantedApps: [
      { bundleId: 'com.example.NotesWriter', displayName: 'NotesWriter', path: '/Applications/NotesWriter.app' },
    ],
  })

  const result = await searchApplicationsTool(ctx, {
    query: 'notes',
    source: 'all',
    includePaths: false,
    limit: 1,
  })

  assert.equal(result.structuredContent.ok, true)
  assert.equal(result.structuredContent.query, 'notes')
  assert.equal(result.structuredContent.source, 'all')
  assert.equal(result.structuredContent.limit, 1)
  assert.equal(result.structuredContent.totalMatches, 2)
  assert.equal(result.structuredContent.hasMore, true)
  assert.deepEqual(result.structuredContent.apps, [
    { bundleId: 'com.apple.Notes', displayName: 'Notes' },
  ])
})

test('searchApplicationsTool can return installed-only matches including paths', async () => {
  const ctx = createContext({
    runningApps: [
      { bundleId: 'com.apple.Notes', displayName: 'Notes', pid: 10, isFrontmost: true },
    ],
    installedApps: [
      { bundleId: 'com.apple.Notes', displayName: 'Notes', path: '/System/Applications/Notes.app' },
      { bundleId: 'com.example.NotesWriter', displayName: 'NotesWriter', path: '/Applications/NotesWriter.app' },
    ],
  })

  const result = await searchApplicationsTool(ctx, {
    query: 'notes',
    source: 'installed',
    includePaths: true,
    limit: 10,
  })

  assert.equal(result.structuredContent.totalMatches, 2)
  assert.equal(result.structuredContent.hasMore, false)
  assert.deepEqual(result.structuredContent.apps, [
    { bundleId: 'com.apple.Notes', displayName: 'Notes', path: '/System/Applications/Notes.app' },
    { bundleId: 'com.example.NotesWriter', displayName: 'NotesWriter', path: '/Applications/NotesWriter.app' },
  ])
})

test('searchApplicationsTool deduplicates installed and running entries by bundle id', async () => {
  const ctx = createContext({
    runningApps: [
      { bundleId: 'com.apple.TextEdit', displayName: 'TextEdit', pid: 10, isFrontmost: true },
    ],
    installedApps: [
      { bundleId: 'com.apple.TextEdit', displayName: 'TextEdit', path: '/System/Applications/TextEdit.app' },
    ],
  })

  const result = await searchApplicationsTool(ctx, {
    query: 'textedit',
    includePaths: true,
    source: 'all',
    limit: 5,
  })

  assert.equal(result.structuredContent.totalMatches, 1)
  assert.deepEqual(result.structuredContent.apps, [
    {
      bundleId: 'com.apple.TextEdit',
      displayName: 'TextEdit',
      path: '/System/Applications/TextEdit.app',
    },
  ])
})

test('searchApplicationsTool validates arguments at runtime', async () => {
  const ctx = createContext()

  await assert.rejects(
    searchApplicationsTool(ctx, {
      query: '   ',
    } as any),
    AppResolutionError,
  )

  await assert.rejects(
    searchApplicationsTool(ctx, {
      query: 'notes',
      limit: 100,
    } as any),
    AppResolutionError,
  )
})
