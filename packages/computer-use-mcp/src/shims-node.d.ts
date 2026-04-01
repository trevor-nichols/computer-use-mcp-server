declare module 'node:os' {
  const os: any
  export default os
}
declare module 'node:path' {
  const path: any
  export default path
}
declare module 'node:fs/promises' {
  const fs: any
  export default fs
}
declare module 'node:fs' {
  export const existsSync: any
}
declare module 'node:child_process' {
  export const spawn: any
  export type ChildProcessWithoutNullStreams = any
}
declare module 'node:readline' {
  export const createInterface: any
}
declare module 'node:test' {
  const test: any
  export default test
}
declare module 'node:assert/strict' {
  const assert: any
  export default assert
}
declare module 'node:http' {
  const http: any
  export = http
}
declare module 'node:crypto' {
  export const randomUUID: any
}
declare const process: any
declare const Buffer: any
declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string
  }
  interface Timeout {}
}

declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any
declare function clearTimeout(timeoutId: any): void
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any
declare function clearInterval(timeoutId: any): void
