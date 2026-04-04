import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../src/config.js'
import { createNativeHost } from '../src/native/nativeHost.js'
import type { InputBridge } from '../src/native/bridgeTypes.js'

function createLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  }
}

function withEnv(overrides: Record<string, string | undefined>, run: () => void | Promise<void>) {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key])
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of previous) {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
    })
}

function createRustInputStub(calls: Array<{ method: string; args: unknown[] }>): InputBridge {
  return {
    async getCursorPosition() {
      calls.push({ method: 'getCursorPosition', args: [] })
      return { x: 12, y: 34 }
    },
    async moveMouse(x: number, y: number) {
      calls.push({ method: 'moveMouse', args: [x, y] })
    },
    async mouseDown(button) {
      calls.push({ method: 'mouseDown', args: [button] })
    },
    async mouseUp(button) {
      calls.push({ method: 'mouseUp', args: [button] })
    },
    async click(button, count) {
      calls.push({ method: 'click', args: [button, count] })
    },
    async scroll(dx: number, dy: number) {
      calls.push({ method: 'scroll', args: [dx, dy] })
    },
    async keySequence(sequence: string) {
      calls.push({ method: 'keySequence', args: [sequence] })
    },
    async keyDown(key: string) {
      calls.push({ method: 'keyDown', args: [key] })
    },
    async keyUp(key: string) {
      calls.push({ method: 'keyUp', args: [key] })
    },
    async typeText(text: string) {
      calls.push({ method: 'typeText', args: [text] })
    },
  }
}

test('fake mode wins before backend selection and never loads the Rust package', async () => {
  await withEnv(
    {
      COMPUTER_USE_FAKE: '1',
      COMPUTER_USE_INPUT_BACKEND: 'rust',
    },
    async () => {
      const config = loadConfig()
      const logger = createLogger() as any
      let rustLoadAttempts = 0

      const nativeHost = createNativeHost(config, logger, {
        loadRustInputBridge() {
          rustLoadAttempts += 1
          return createRustInputStub([])
        },
      })

      await nativeHost.input.moveMouse(10, 20)
      const displays = await nativeHost.screenshots.listDisplays()

      assert.equal(config.inputBackend, 'fake')
      assert.equal(rustLoadAttempts, 0)
      assert.equal(displays[0]?.name, 'Fake Display')
    },
  )
})

test('explicit Swift input selection keeps the rest of the native host Swift-backed', async () => {
  await withEnv(
    {
      COMPUTER_USE_FAKE: undefined,
      COMPUTER_USE_INPUT_BACKEND: 'swift',
    },
    async () => {
      const config = loadConfig()
      const logger = createLogger() as any
      const calls: Array<{ method: string; params?: Record<string, unknown> }> = []
      const swiftClient = {
        async send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
          calls.push({ method, params })
          switch (method) {
            case 'listDisplays':
              return [{
                displayId: 9,
                name: 'Swift Display',
                originX: 0,
                originY: 0,
                width: 100,
                height: 100,
                scaleFactor: 2,
                isPrimary: true,
              }] as T
            case 'getCursorPosition':
              return { x: 1, y: 2 } as T
            default:
              return undefined as T
          }
        },
      }

      const nativeHost = createNativeHost(config, logger, { swiftClient })
      await nativeHost.input.keyDown('escape')
      await nativeHost.screenshots.listDisplays()

      assert.deepEqual(calls.map(call => call.method), ['keyDown', 'listDisplays'])
    },
  )
})

test('explicit Rust input selection routes only input through the Rust bridge', async () => {
  await withEnv(
    {
      COMPUTER_USE_FAKE: undefined,
      COMPUTER_USE_INPUT_BACKEND: 'rust',
    },
    async () => {
      const config = loadConfig()
      const logger = createLogger() as any
      const rustCalls: Array<{ method: string; args: unknown[] }> = []
      const swiftCalls: Array<{ method: string; params?: Record<string, unknown> }> = []
      const swiftClient = {
        async send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
          swiftCalls.push({ method, params })
          switch (method) {
            case 'listDisplays':
              return [{
                displayId: 5,
                name: 'Swift Display',
                originX: 0,
                originY: 0,
                width: 200,
                height: 100,
                scaleFactor: 2,
                isPrimary: true,
              }] as T
            case 'readClipboard':
              return 'swift clipboard' as T
            default:
              return undefined as T
          }
        },
      }

      const nativeHost = createNativeHost(config, logger, {
        swiftClient,
        loadRustInputBridge() {
          return createRustInputStub(rustCalls)
        },
      })

      await nativeHost.input.click('left', 2)
      const displays = await nativeHost.screenshots.listDisplays()
      const clipboard = await nativeHost.clipboard.readText()

      assert.equal(displays[0]?.name, 'Swift Display')
      assert.equal(clipboard, 'swift clipboard')
      assert.deepEqual(rustCalls, [{ method: 'click', args: ['left', 2] }])
      assert.deepEqual(swiftCalls.map(call => call.method), ['listDisplays', 'readClipboard'])
    },
  )
})

test('explicit Rust input selection fails fast when the Rust bridge cannot be loaded', async () => {
  await withEnv(
    {
      COMPUTER_USE_FAKE: undefined,
      COMPUTER_USE_INPUT_BACKEND: 'rust',
    },
    async () => {
      const config = loadConfig()
      const logger = createLogger() as any

      assert.throws(
        () => createNativeHost(config, logger, {
          swiftClient: {
            async send<T>(): Promise<T> {
              return undefined as T
            },
          },
          loadRustInputBridge() {
            throw new Error('missing native addon')
          },
        }),
        /missing native addon/,
      )
    },
  )
})
