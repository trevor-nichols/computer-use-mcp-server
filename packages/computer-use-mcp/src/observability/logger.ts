export interface Logger {
  debug(message: string, meta?: unknown): void
  info(message: string, meta?: unknown): void
  warn(message: string, meta?: unknown): void
  error(message: string, meta?: unknown): void
}

function write(level: string, message: string, meta?: unknown): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    meta,
  }
  process.stderr.write(`${JSON.stringify(payload)}\n`)
}

export function createLogger(): Logger {
  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  }
}
