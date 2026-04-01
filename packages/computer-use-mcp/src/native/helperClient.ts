import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { RuntimeConfig } from '../config.js'
import type { Logger } from '../observability/logger.js'
import { NativeTimeoutError } from '../errors/errorTypes.js'

interface HelperResponse {
  id: number
  ok: boolean
  result?: unknown
  error?: {
    message: string
  }
}

export class SwiftBridgeClient {
  private child?: ChildProcessWithoutNullStreams
  private nextId = 1
  private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (reason?: unknown) => void; timer: any }>()

  constructor(
    private readonly config: RuntimeConfig,
    private readonly logger: Logger,
  ) {}

  async send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.ensureStarted()
    const id = this.nextId++
    const payload = { id, method, params }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        const error = new NativeTimeoutError(`Swift bridge call timed out for ${method}.`)
        reject(error)
        this.resetBridge(error, { method })
      }, this.config.nativeCallTimeoutMs)

      this.pending.set(id, { resolve, reject, timer })
      this.child!.stdin.write(`${JSON.stringify(payload)}\n`)
    })
  }

  async stop(): Promise<void> {
    this.resetBridge(new Error('Swift bridge stopped by the server.'))
  }

  private async ensureStarted(): Promise<void> {
    if (this.child) return

    const command = this.resolveCommand()
    this.logger.info('starting swift bridge', command)

    const child = spawn(command.command, command.args, {
      cwd: this.config.repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    const rl = createInterface({ input: child.stdout })
    rl.on('line', (line: string) => {
      try {
        const message = JSON.parse(line) as HelperResponse
        const pending = this.pending.get(message.id)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pending.delete(message.id)
        if (message.ok) {
          pending.resolve(message.result)
        } else {
          pending.reject(new Error(message.error?.message ?? 'Unknown bridge error'))
        }
      } catch (error) {
        this.logger.warn('failed to parse swift bridge response', { line, error })
      }
    })

    child.stderr.on('data', (chunk: any) => {
      this.logger.warn('swift bridge stderr', String(chunk))
    })

    child.on('exit', (code: any) => {
      this.logger.warn('swift bridge exited', { code })
      if (this.child === child) {
        this.child = undefined
        this.failPending(new Error(`Swift bridge exited with code ${String(code)}.`))
      }
    })

    this.child = child
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private resetBridge(error: Error, meta?: Record<string, unknown>): void {
    const child = this.child
    if (!child) return

    this.logger.warn('resetting swift bridge', {
      reason: error.message,
      ...meta,
    })

    this.child = undefined
    this.failPending(error)
    child.kill()
  }

  private resolveCommand(): { command: string; args: string[] } {
    if (this.config.swiftBridgePath && existsSync(this.config.swiftBridgePath)) {
      return { command: this.config.swiftBridgePath, args: [] }
    }

    const releaseBinary = path.join(
      this.config.repoRoot,
      'packages',
      'native-swift',
      '.build',
      'release',
      'ComputerUseBridge',
    )

    if (existsSync(releaseBinary)) {
      return { command: releaseBinary, args: [] }
    }

    return {
      command: 'swift',
      args: ['run', '--package-path', path.join(this.config.repoRoot, 'packages', 'native-swift'), 'ComputerUseBridge'],
    }
  }
}
