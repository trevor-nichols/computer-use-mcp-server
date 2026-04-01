import type { Logger } from '../observability/logger.js'

export class CleanupRegistry {
  private readonly tasks: Array<() => Promise<void> | void> = []

  add(task: () => Promise<void> | void): void {
    this.tasks.push(task)
  }

  async runAll(logger?: Logger): Promise<void> {
    const errors: unknown[] = []
    while (this.tasks.length > 0) {
      const task = this.tasks.pop()
      if (!task) continue
      try {
        await task()
      } catch (error) {
        errors.push(error)
        logger?.warn('cleanup task failed', error)
      }
    }

    if (errors.length > 0) {
      throw errors[0]
    }
  }
}
