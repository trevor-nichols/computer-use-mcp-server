import fs from 'node:fs/promises'
import path from 'node:path'
import { DesktopLockHeldError } from '../errors/errorTypes.js'

interface LockPayload {
  sessionId: string
  connectionId: string
  pid: number
  acquiredAt: string
}

export class DesktopLockManager {
  private readonly reentrant = new Map<string, number>()

  constructor(private readonly lockPath: string) {}

  async acquire(sessionId: string, connectionId: string): Promise<() => Promise<void>> {
    const depth = this.reentrant.get(sessionId) ?? 0
    if (depth > 0) {
      this.reentrant.set(sessionId, depth + 1)
      return async () => {
        await this.release(sessionId)
      }
    }

    await fs.mkdir(path.dirname(this.lockPath), { recursive: true })

    const payload: LockPayload = {
      sessionId,
      connectionId,
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const handle = await fs.open(this.lockPath, 'wx')
        await handle.writeFile(JSON.stringify(payload), 'utf8')
        await handle.close()
        this.reentrant.set(sessionId, 1)
        return async () => {
          await this.release(sessionId)
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err.code !== 'EEXIST') {
          throw error
        }
        const recovered = await this.tryRecoverStaleLock()
        if (!recovered) {
          throw new DesktopLockHeldError()
        }
      }
    }

    throw new DesktopLockHeldError()
  }

  private async release(sessionId: string): Promise<void> {
    const depth = this.reentrant.get(sessionId) ?? 0
    if (depth <= 1) {
      this.reentrant.delete(sessionId)
      await fs.rm(this.lockPath, { force: true })
      return
    }
    this.reentrant.set(sessionId, depth - 1)
  }

  private async tryRecoverStaleLock(): Promise<boolean> {
    try {
      const raw = await fs.readFile(this.lockPath, 'utf8')
      const payload = JSON.parse(raw) as LockPayload
      try {
        process.kill(payload.pid, 0)
        return false
      } catch {
        await fs.rm(this.lockPath, { force: true })
        return true
      }
    } catch {
      await fs.rm(this.lockPath, { force: true })
      return true
    }
  }
}
