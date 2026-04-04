import type { RuntimeConfig } from '../config.js'
import type { Logger } from '../observability/logger.js'
import type { InputBridge, NativeHostAdapter } from './bridgeTypes.js'
import { SwiftBridgeClient } from './helperClient.js'
import { createInputBridge } from './inputBridge.js'
import {
  createFakeAppBridge,
  createFakeClipboardBridge,
  createFakeHotkeyBridge,
  createFakeRunLoopPump,
  createFakeScreenshotBridge,
  createFakeTccBridge,
  createSwiftAppBridge,
  createSwiftClipboardBridge,
  createSwiftHotkeyBridge,
  createSwiftRunLoopPump,
  createSwiftScreenshotBridge,
  createSwiftTccBridge,
  type SwiftClientLike,
} from './swiftBridge.js'

export interface CreateNativeHostDeps {
  swiftClient?: SwiftClientLike
  loadRustInputBridge?: (config: RuntimeConfig, logger: Logger) => InputBridge
}

export function createNativeHost(
  config: RuntimeConfig,
  logger: Logger,
  deps: CreateNativeHostDeps = {},
): NativeHostAdapter {
  if (config.fakeMode) {
    logger.info('native host ready', { fakeMode: true, inputBackend: 'fake' })
    return {
      screenshots: createFakeScreenshotBridge(),
      apps: createFakeAppBridge(logger),
      input: createInputBridge(config, logger, deps),
      clipboard: createFakeClipboardBridge(),
      tcc: createFakeTccBridge(),
      hotkeys: createFakeHotkeyBridge(),
      runLoop: createFakeRunLoopPump(),
    }
  }

  const client = deps.swiftClient ?? new SwiftBridgeClient(config, logger)
  const host: NativeHostAdapter = {
    screenshots: createSwiftScreenshotBridge(client),
    apps: createSwiftAppBridge(client),
    input: createInputBridge(config, logger, {
      swiftClient: client,
      loadRustInputBridge: deps.loadRustInputBridge,
    }),
    clipboard: createSwiftClipboardBridge(client),
    tcc: createSwiftTccBridge(client),
    hotkeys: createSwiftHotkeyBridge(client),
    runLoop: createSwiftRunLoopPump(),
  }

  logger.info('native host ready', {
    fakeMode: false,
    inputBackend: config.inputBackend,
  })

  return host
}
