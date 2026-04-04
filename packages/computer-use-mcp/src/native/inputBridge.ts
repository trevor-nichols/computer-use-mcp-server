import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { RuntimeConfig } from '../config.js'
import type { InputBridge } from './bridgeTypes.js'
import type { Logger } from '../observability/logger.js'
import {
  createFakeInputBridge,
  createSwiftInputBridge,
  type SwiftClientLike,
} from './swiftBridge.js'

const require = createRequire(import.meta.url)

const REQUIRED_INPUT_METHODS = [
  'getCursorPosition',
  'moveMouse',
  'mouseDown',
  'mouseUp',
  'click',
  'scroll',
  'keySequence',
  'keyDown',
  'keyUp',
  'typeText',
] as const

export interface CreateInputBridgeDeps {
  swiftClient?: SwiftClientLike
  createFakeInputBridge?: (logger: Logger) => InputBridge
  createSwiftInputBridge?: (client: SwiftClientLike) => InputBridge
  loadRustInputBridge?: (config: RuntimeConfig, logger: Logger) => InputBridge
}

function assertInputBridgeShape(value: unknown, source: string): asserts value is InputBridge {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Rust input bridge at ${source} did not export an object.`)
  }

  for (const method of REQUIRED_INPUT_METHODS) {
    const candidate = (value as Record<string, unknown>)[method]
    if (typeof candidate !== 'function') {
      throw new Error(`Rust input bridge at ${source} is missing method ${method}().`)
    }
  }
}

function resolveRustInputBridgeEntry(config: RuntimeConfig): string {
  if (config.rustInputModulePath) {
    return path.resolve(config.rustInputModulePath)
  }

  return path.join(config.repoRoot, 'packages', 'native-input')
}

export function loadRustInputBridge(config: RuntimeConfig, logger: Logger): InputBridge {
  const entry = resolveRustInputBridgeEntry(config)

  if (!existsSync(entry)) {
    throw new Error(`Rust input backend could not be found at ${entry}.`)
  }

  try {
    const loaded = require(entry) as unknown
    const candidate =
      loaded && typeof loaded === 'object' && 'default' in (loaded as Record<string, unknown>)
        ? (loaded as { default: unknown }).default
        : loaded

    assertInputBridgeShape(candidate, entry)
    logger.info('loaded rust input bridge', { entry })
    return candidate
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load rust input backend from ${entry}: ${error.message}`)
    }
    throw new Error(`Failed to load rust input backend from ${entry}.`)
  }
}

export function createInputBridge(
  config: RuntimeConfig,
  logger: Logger,
  deps: CreateInputBridgeDeps = {},
): InputBridge {
  if (config.fakeMode || config.inputBackend === 'fake') {
    return (deps.createFakeInputBridge ?? createFakeInputBridge)(logger)
  }

  if (config.inputBackend === 'swift') {
    if (!deps.swiftClient) {
      throw new Error('Swift input backend requires a Swift bridge client.')
    }
    return (deps.createSwiftInputBridge ?? createSwiftInputBridge)(deps.swiftClient)
  }

  return (deps.loadRustInputBridge ?? loadRustInputBridge)(config, logger)
}
