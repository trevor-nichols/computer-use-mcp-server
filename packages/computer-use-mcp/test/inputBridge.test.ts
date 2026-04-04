import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { loadConfig } from '../src/config.js'
import { createInputBridge, loadRustInputBridge } from '../src/native/inputBridge.js'

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

async function withTempRustModule(source: string, run: (modulePath: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-input-bridge-'))
  const modulePath = path.join(dir, 'index.cjs')
  await fs.writeFile(modulePath, source, 'utf8')
  try {
    await run(modulePath)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

test('loadRustInputBridge accepts CommonJS exports and preserves method arguments', async () => {
  await withTempRustModule(
    `
      const calls = [];
      module.exports = {
        calls,
        async getCursorPosition() { calls.push(['getCursorPosition']); return { x: 9, y: 4 }; },
        async moveMouse(x, y) { calls.push(['moveMouse', x, y]); },
        async mouseDown(button) { calls.push(['mouseDown', button]); },
        async mouseUp(button) { calls.push(['mouseUp', button]); },
        async click(button, count) { calls.push(['click', button, count]); },
        async scroll(dx, dy) { calls.push(['scroll', dx, dy]); },
        async keySequence(sequence) { calls.push(['keySequence', sequence]); },
        async keyDown(key) { calls.push(['keyDown', key]); },
        async keyUp(key) { calls.push(['keyUp', key]); },
        async typeText(text) { calls.push(['typeText', text]); },
      };
    `,
    async modulePath => {
      await withEnv(
        {
          COMPUTER_USE_FAKE: undefined,
          COMPUTER_USE_INPUT_BACKEND: 'rust',
          COMPUTER_USE_RUST_INPUT_PATH: modulePath,
        },
        async () => {
          const config = loadConfig()
          const logger = createLogger() as any
          const bridge = loadRustInputBridge(config, logger) as any

          const cursor = await bridge.getCursorPosition()
          await bridge.scroll(11, -7)
          await bridge.typeText('hello')

          assert.deepEqual(cursor, { x: 9, y: 4 })
          assert.deepEqual(bridge.calls, [
            ['getCursorPosition'],
            ['scroll', 11, -7],
            ['typeText', 'hello'],
          ])
        },
      )
    },
  )
})

test('loadRustInputBridge accepts a default export object', async () => {
  await withTempRustModule(
    `
      const bridge = {
        async getCursorPosition() { return { x: 1, y: 2 }; },
        async moveMouse() {},
        async mouseDown() {},
        async mouseUp() {},
        async click() {},
        async scroll() {},
        async keySequence() {},
        async keyDown() {},
        async keyUp() {},
        async typeText() {},
      };
      module.exports = { default: bridge };
    `,
    async modulePath => {
      await withEnv(
        {
          COMPUTER_USE_FAKE: undefined,
          COMPUTER_USE_INPUT_BACKEND: 'rust',
          COMPUTER_USE_RUST_INPUT_PATH: modulePath,
        },
        async () => {
          const bridge = loadRustInputBridge(loadConfig(), createLogger() as any)
          assert.deepEqual(await bridge.getCursorPosition(), { x: 1, y: 2 })
        },
      )
    },
  )
})

test('loadRustInputBridge fails fast when the Rust module is missing required methods', async () => {
  await withTempRustModule(
    `module.exports = { async getCursorPosition() { return { x: 0, y: 0 }; } };`,
    async modulePath => {
      await withEnv(
        {
          COMPUTER_USE_FAKE: undefined,
          COMPUTER_USE_INPUT_BACKEND: 'rust',
          COMPUTER_USE_RUST_INPUT_PATH: modulePath,
        },
        async () => {
          assert.throws(
            () => loadRustInputBridge(loadConfig(), createLogger() as any),
            /missing method moveMouse\(\)/,
          )
        },
      )
    },
  )
})

test('createInputBridge returns the fake backend before evaluating explicit Rust selection', async () => {
  await withEnv(
    {
      COMPUTER_USE_FAKE: '1',
      COMPUTER_USE_INPUT_BACKEND: 'rust',
    },
    async () => {
      const config = loadConfig()
      let rustLoadAttempts = 0
      const bridge = createInputBridge(config, createLogger() as any, {
        loadRustInputBridge() {
          rustLoadAttempts += 1
          throw new Error('should not load rust backend in fake mode')
        },
      })

      await bridge.moveMouse(3, 4)
      assert.equal(rustLoadAttempts, 0)
      assert.deepEqual(await bridge.getCursorPosition(), { x: 3, y: 4 })
    },
  )
})
