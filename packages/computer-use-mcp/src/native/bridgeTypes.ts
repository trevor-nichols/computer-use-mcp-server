export interface GrantFlags {
  clipboardRead: boolean
  clipboardWrite: boolean
  systemKeyCombos: boolean
}

export interface AllowedApp {
  bundleId: string
  displayName: string
  path?: string
}

export interface ScreenshotDims {
  width: number
  height: number
  displayId: number
  originX: number
  originY: number
  logicalWidth?: number
  logicalHeight?: number
  scaleFactor?: number
}

export interface TccState {
  accessibility: boolean
  screenRecording: boolean
}

export interface DisplayInfo {
  displayId: number
  name?: string
  originX: number
  originY: number
  width: number
  height: number
  scaleFactor: number
  isPrimary: boolean
}

export interface CaptureOptions {
  displayId?: number
  region?: { x: number; y: number; width: number; height: number }
  format: 'jpeg' | 'png'
  jpegQuality?: number
  targetWidth?: number
  targetHeight?: number
  excludeBundleIds?: string[]
}

export interface CaptureResult {
  dataBase64: string
  mimeType: 'image/jpeg' | 'image/png'
  width: number
  height: number
  display: DisplayInfo
}

export interface ScreenshotBridge {
  listDisplays(): Promise<DisplayInfo[]>
  capture(options: CaptureOptions): Promise<CaptureResult>
}

export interface InstalledAppInfo {
  bundleId: string
  displayName: string
  path: string
}

export interface RunningAppInfo {
  bundleId: string
  displayName: string
  pid: number
  isFrontmost: boolean
}

export interface AppBridge {
  listInstalledApps(): Promise<InstalledAppInfo[]>
  listRunningApps(): Promise<RunningAppInfo[]>
  getFrontmostApp(): Promise<RunningAppInfo | null>
  appUnderPoint(x: number, y: number): Promise<RunningAppInfo | null>
  openApplication(bundleId: string): Promise<void>
  hideApplications(bundleIds: string[]): Promise<string[]>
  unhideApplications(bundleIds: string[]): Promise<void>
  findWindowDisplays(bundleIds: string[]): Promise<Record<string, number[]>>
}

export type MouseButton = 'left' | 'right' | 'middle'

export interface CursorPosition {
  x: number
  y: number
}

export interface InputBridge {
  getCursorPosition(): Promise<CursorPosition>
  moveMouse(x: number, y: number): Promise<void>
  mouseDown(button: MouseButton): Promise<void>
  mouseUp(button: MouseButton): Promise<void>
  click(button: MouseButton, count: 1 | 2 | 3): Promise<void>
  scroll(dx: number, dy: number): Promise<void>
  keySequence(sequence: string): Promise<void>
  keyDown(key: string): Promise<void>
  keyUp(key: string): Promise<void>
  typeText(text: string): Promise<void>
}

export interface ClipboardBridge {
  readText(): Promise<string>
  writeText(text: string): Promise<void>
}

export interface TccBridge {
  getState(): Promise<TccState>
  openAccessibilitySettings(): Promise<void>
  openScreenRecordingSettings(): Promise<void>
}

export interface HotkeyBridge {
  registerEscapeAbort(sessionId: string): Promise<void>
  markExpectedEscape(sessionId: string, windowMs: number): Promise<void>
  unregisterEscapeAbort(sessionId: string): Promise<void>
  consumeAbort(sessionId: string): Promise<boolean>
}

export interface RunLoopPump {
  retain(tag: string): void
  release(tag: string): void
}

export interface NativeHostAdapter {
  screenshots: ScreenshotBridge
  apps: AppBridge
  input: InputBridge
  clipboard: ClipboardBridge
  tcc: TccBridge
  hotkeys: HotkeyBridge
  runLoop: RunLoopPump
}
