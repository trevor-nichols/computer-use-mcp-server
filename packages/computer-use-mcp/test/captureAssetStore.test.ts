import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { CaptureAssetStore } from '../src/assets/captureAssetStore.js'
import { createLogger } from '../src/observability/logger.js'

test('CaptureAssetStore creates, lists, and deletes session-scoped image files', async () => {
  const assetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-asset-store-'))
  const store = new CaptureAssetStore(assetRoot, createLogger())
  await store.initialize()

  const record = await store.createAsset(
    'session-one',
    {
      dataBase64: 'aGVsbG8=',
      mimeType: 'image/png',
      width: 10,
      height: 20,
      display: {
        displayId: 1,
        name: 'Display',
        originX: 0,
        originY: 0,
        width: 100,
        height: 200,
        scaleFactor: 2,
        isPrimary: true,
      },
    },
    {
      width: 10,
      height: 20,
      displayId: 1,
      originX: 0,
      originY: 0,
      logicalWidth: 20,
      logicalHeight: 40,
      scaleFactor: 2,
    },
    ['com.apple.TextEdit'],
  )

  assert.equal(record.sessionId, 'session-one')
  assert.deepEqual(record.excludedBundleIds, ['com.apple.TextEdit'])
  assert.equal((await fs.stat(record.imagePath)).isFile(), true)
  assert.equal((await fs.readFile(record.imagePath, 'utf8')), 'hello')
  assert.equal(store.getSessionAsset('session-one', record.captureId)?.imagePath, record.imagePath)
  assert.equal(store.getSessionAsset('session-two', record.captureId), undefined)

  const listed = store.listSessionAssets('session-one')
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.imagePath, record.imagePath)
  assert.deepEqual(listed[0]?.excludedBundleIds, ['com.apple.TextEdit'])
  assert.equal(store.listSessionAssets('session-two').length, 0)

  await store.deleteSessionAssets('session-one')
  assert.equal(store.listSessionAssets('session-one').length, 0)
  await assert.rejects(fs.stat(record.imagePath))

  await store.cleanupAll()
  await fs.rm(assetRoot, { recursive: true, force: true })
})
