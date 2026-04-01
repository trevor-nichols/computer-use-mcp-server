import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DesktopLockManager } from '../src/session/lock.js'

test('DesktopLockManager supports reentrant acquire and release', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cu-lock-'))
  const lockPath = path.join(dir, 'desktop.lock')
  const manager = new DesktopLockManager(lockPath)

  const release1 = await manager.acquire('session-a', 'conn-a')
  const release2 = await manager.acquire('session-a', 'conn-a')

  await release2()
  assert.equal(await exists(lockPath), true)

  await release1()
  assert.equal(await exists(lockPath), false)
})

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
