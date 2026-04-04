import type {
  AppBridge,
  CaptureOptions,
  CaptureResult,
  ClipboardBridge,
  CursorPosition,
  DisplayInfo,
  HotkeyBridge,
  InputBridge,
  NativeHostAdapter,
  RunLoopPump,
  ScreenshotBridge,
  TccBridge,
  TccState,
} from './bridgeTypes.js'
import type { Logger } from '../observability/logger.js'
import type { RuntimeConfig } from '../config.js'
import { SwiftBridgeClient } from './helperClient.js'

const ONE_BY_ONE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3tQ0AAAAAASUVORK5CYII='

export interface SwiftClientLike {
  send<T>(method: string, params?: Record<string, unknown>): Promise<T>
}

function fakeDisplay(): DisplayInfo {
  return {
    displayId: 1,
    name: 'Fake Display',
    originX: 0,
    originY: 0,
    width: 1440,
    height: 900,
    scaleFactor: 2,
    isPrimary: true,
  }
}

export function createFakeScreenshotBridge(): ScreenshotBridge {
  return {
    async listDisplays() {
      return [fakeDisplay()]
    },
    async capture(options: CaptureOptions): Promise<CaptureResult> {
      const display = fakeDisplay()
      return {
        dataBase64: ONE_BY_ONE_PNG_BASE64,
        mimeType: options.format === 'png' ? 'image/png' : 'image/jpeg',
        width: options.targetWidth ?? 1440,
        height: options.targetHeight ?? 900,
        display,
      }
    },
  }
}

export function createFakeAppBridge(logger: Logger): AppBridge {
  const fakeActiveApp = {
    bundleId: 'com.apple.TextEdit',
    displayName: 'TextEdit',
    pid: 100,
    isFrontmost: true,
  }

  return {
    async listInstalledApps() {
      return [
        { bundleId: 'com.apple.TextEdit', displayName: 'TextEdit', path: '/System/Applications/TextEdit.app' },
        { bundleId: 'com.apple.Notes', displayName: 'Notes', path: '/System/Applications/Notes.app' },
      ]
    },
    async listRunningApps() {
      return []
    },
    async getFrontmostApp() {
      return fakeActiveApp
    },
    async appUnderPoint() {
      return fakeActiveApp
    },
    async openApplication(bundleId: string) {
      logger.info('fake openApplication', { bundleId })
    },
    async hideApplications(bundleIds: string[]) {
      logger.info('fake hideApplications', { bundleIds })
      return bundleIds
    },
    async unhideApplications(bundleIds: string[]) {
      logger.info('fake unhideApplications', { bundleIds })
    },
    async findWindowDisplays(bundleIds: string[]) {
      return Object.fromEntries(bundleIds.map(bundleId => [bundleId, [1]]))
    },
  }
}

export function createFakeInputBridge(logger: Logger): InputBridge {
  let cursor: CursorPosition = { x: 0, y: 0 }

  return {
    async getCursorPosition() {
      return cursor
    },
    async moveMouse(x: number, y: number) {
      cursor = { x, y }
      logger.info('fake moveMouse', cursor)
    },
    async mouseDown(button) {
      logger.info('fake mouseDown', { button })
    },
    async mouseUp(button) {
      logger.info('fake mouseUp', { button })
    },
    async click(button, count) {
      logger.info('fake click', { button, count, cursor })
    },
    async scroll(dx, dy) {
      logger.info('fake scroll', { dx, dy, cursor })
    },
    async keySequence(sequence) {
      logger.info('fake keySequence', { sequence })
    },
    async keyDown(key) {
      logger.info('fake keyDown', { key })
    },
    async keyUp(key) {
      logger.info('fake keyUp', { key })
    },
    async typeText(text) {
      logger.info('fake typeText', { text })
    },
  }
}

export function createFakeClipboardBridge(): ClipboardBridge {
  let value = ''
  return {
    async readText() {
      return value
    },
    async writeText(text: string) {
      value = text
    },
  }
}

export function createFakeTccBridge(): TccBridge {
  let state: TccState = {
    accessibility: true,
    screenRecording: true,
  }

  return {
    async getState() {
      return state
    },
    async openAccessibilitySettings() {
      state = { ...state, accessibility: true }
    },
    async openScreenRecordingSettings() {
      state = { ...state, screenRecording: true }
    },
  }
}

export function createFakeHotkeyBridge(): HotkeyBridge {
  return {
    async registerEscapeAbort() { return },
    async markExpectedEscape() { return },
    async unregisterEscapeAbort() { return },
    async consumeAbort() { return false },
  }
}

export function createFakeRunLoopPump(): RunLoopPump {
  return {
    retain() { return },
    release() { return },
  }
}

export function createSwiftScreenshotBridge(client: SwiftClientLike): ScreenshotBridge {
  return {
    async listDisplays() {
      return client.send<DisplayInfo[]>('listDisplays')
    },
    async capture(options: CaptureOptions) {
      return client.send<CaptureResult>('capture', options as unknown as Record<string, unknown>)
    },
  }
}

export function createSwiftAppBridge(client: SwiftClientLike): AppBridge {
  return {
    async listInstalledApps() {
      return client.send('listInstalledApps')
    },
    async listRunningApps() {
      return client.send('listRunningApps')
    },
    async getFrontmostApp() {
      return client.send('getFrontmostApp')
    },
    async appUnderPoint(x: number, y: number) {
      return client.send('appUnderPoint', { x, y })
    },
    async openApplication(bundleId: string) {
      await client.send('openApplication', { bundleId })
    },
    async hideApplications(bundleIds: string[]) {
      return client.send('hideApplications', { bundleIds })
    },
    async unhideApplications(bundleIds: string[]) {
      await client.send('unhideApplications', { bundleIds })
    },
    async findWindowDisplays(bundleIds: string[]) {
      return client.send('findWindowDisplays', { bundleIds })
    },
  }
}

export function createSwiftInputBridge(client: SwiftClientLike): InputBridge {
  return {
    async getCursorPosition() {
      return client.send('getCursorPosition')
    },
    async moveMouse(x: number, y: number) {
      await client.send('moveMouse', { x, y })
    },
    async mouseDown(button) {
      await client.send('mouseDown', { button })
    },
    async mouseUp(button) {
      await client.send('mouseUp', { button })
    },
    async click(button, count) {
      await client.send('click', { button, count })
    },
    async scroll(dx, dy) {
      await client.send('scroll', { dx, dy })
    },
    async keySequence(sequence) {
      await client.send('keySequence', { sequence })
    },
    async keyDown(key) {
      await client.send('keyDown', { key })
    },
    async keyUp(key) {
      await client.send('keyUp', { key })
    },
    async typeText(text) {
      await client.send('typeText', { text })
    },
  }
}

export function createSwiftClipboardBridge(client: SwiftClientLike): ClipboardBridge {
  return {
    async readText() {
      return client.send('readClipboard')
    },
    async writeText(text: string) {
      await client.send('writeClipboard', { text })
    },
  }
}

export function createSwiftTccBridge(client: SwiftClientLike): TccBridge {
  return {
    async getState() {
      return client.send('getTccState')
    },
    async openAccessibilitySettings() {
      await client.send('openAccessibilitySettings')
    },
    async openScreenRecordingSettings() {
      await client.send('openScreenRecordingSettings')
    },
  }
}

export function createSwiftHotkeyBridge(client: SwiftClientLike): HotkeyBridge {
  return {
    async registerEscapeAbort(sessionId: string) {
      await client.send('registerEscapeAbort', { sessionId })
    },
    async markExpectedEscape(sessionId: string, windowMs: number) {
      await client.send('markExpectedEscape', { sessionId, windowMs })
    },
    async unregisterEscapeAbort(sessionId: string) {
      await client.send('unregisterEscapeAbort', { sessionId })
    },
    async consumeAbort(sessionId: string) {
      return client.send<boolean>('consumeAbort', { sessionId })
    },
  }
}

export function createSwiftRunLoopPump(): RunLoopPump {
  return {
    retain() { return },
    release() { return },
  }
}

export function createSwiftNativeHost(
  config: RuntimeConfig,
  logger: Logger,
  deps: { swiftClient?: SwiftClientLike } = {},
): NativeHostAdapter {
  if (config.fakeMode) {
    return {
      screenshots: createFakeScreenshotBridge(),
      apps: createFakeAppBridge(logger),
      input: createFakeInputBridge(logger),
      clipboard: createFakeClipboardBridge(),
      tcc: createFakeTccBridge(),
      hotkeys: createFakeHotkeyBridge(),
      runLoop: createFakeRunLoopPump(),
    }
  }

  const client = deps.swiftClient ?? new SwiftBridgeClient(config, logger)

  return {
    screenshots: createSwiftScreenshotBridge(client),
    apps: createSwiftAppBridge(client),
    input: createSwiftInputBridge(client),
    clipboard: createSwiftClipboardBridge(client),
    tcc: createSwiftTccBridge(client),
    hotkeys: createSwiftHotkeyBridge(client),
    runLoop: createSwiftRunLoopPump(),
  }
}
