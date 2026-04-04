# macOS Computer Use Starter Code Canvas

## Status Note

This starter canvas is a historical bootstrap document. It reflects an earlier thin-slice code shape and intentionally simplified tool payloads.

Use it as a scaffold reference only. For the current repository behavior, prefer:

- `README.md` for the current runtime overview
- `SNAPSHOT.md` for the current file layout
- `docs/capture-asset-reference-execution-plan.md` for the current screenshot and zoom output contract

The live runtime now also supports an optional Rust input backend (`@agenai/native-input`) selected via `COMPUTER_USE_INPUT_BACKEND=rust`; earlier Rust-placeholder notes in this document are historical.

The live server now saves captures to disk, attaches inline MCP images in `screenshot` and `zoom`, and exposes file-path plus geometry lookup through `capture_metadata`.

This is the implementation-ready starter for the first thin slice of the standalone local `computer-use` MCP server.

It follows the reimplementation spec and implementation plan, but makes one intentional normalization:

- `NativeHostAdapter` includes a `tcc` bridge. The earlier plan had TCC types defined, but the adapter omitted them. The starter code fixes that so `request_access`, `screenshot`, and permission retries have a clean dependency path.

It also keeps the most useful architectural seam from the Claude Code research:

- **thin MCP surface**
- **session-owned state and approvals**
- **native bridge seam for screenshots, input, apps, and TCC**

The starter is designed to run in a **fake mode** first so you can wire the MCP server, session store, lock, and tool contracts before the native macOS layer is finished.

---

## Bootstrap

Use your package manager to initialize the workspace with the latest versions of:

```bash
pnpm add -w -D typescript tsx vitest @types/node
pnpm add -F computer-use-mcp @modelcontextprotocol/sdk zod
```

Starter layout:

```text
packages/
  computer-use-mcp/
    src/
      main.ts
      config.ts
      observability/logger.ts
      errors/errorTypes.ts
      errors/errorMapper.ts
      native/bridgeTypes.ts
      native/swiftBridge.ts
      native/inputBridge.ts
      session/sessionContext.ts
      session/sessionStore.ts
      session/lock.ts
      approvals/approvalProvider.ts
      approvals/approvalCoordinator.ts
      mcp/sessionIdentity.ts
      mcp/callRouter.ts
      mcp/toolRegistry.ts
      mcp/server.ts
      mcp/stdioTransport.ts
      tools/requestAccess.ts
      tools/screenshot.ts
      tools/cursorPosition.ts
      tools/click.ts
      tools/typeText.ts
      tools/applications.ts
      transforms/coordinates.ts
      transforms/screenshotSizing.ts
    test/
      stdio.e2e.test.ts
```

---

## `packages/computer-use-mcp/src/config.ts`

```ts
import os from 'node:os'
import path from 'node:path'

export interface RuntimeConfig {
  serverName: string
  serverVersion: string
  fakeMode: boolean
  lockPath: string
  approvalDefaultMode: 'local-ui' | 'host-callback' | 'hybrid'
  screenshotDefaultFormat: 'jpeg' | 'png'
  screenshotTargetMaxDimension: number
  screenshotJpegQuality: number
  clickSettleMs: number
  dragAnimationMs: number
  nativeCallTimeoutMs: number
}

export function loadConfig(): RuntimeConfig {
  const home = os.homedir()
  return {
    serverName: 'computer-use',
    serverVersion: '0.1.0',
    fakeMode: process.env.COMPUTER_USE_FAKE === '1',
    lockPath: process.env.COMPUTER_USE_LOCK_PATH ?? path.join(home, '.computer-use-mcp', 'desktop.lock'),
    approvalDefaultMode: 'local-ui',
    screenshotDefaultFormat: 'jpeg',
    screenshotTargetMaxDimension: 1440,
    screenshotJpegQuality: 80,
    clickSettleMs: 75,
    dragAnimationMs: 180,
    nativeCallTimeoutMs: 10_000,
  }
}
```

---

## `packages/computer-use-mcp/src/observability/logger.ts`

```ts
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
```

---

## `packages/computer-use-mcp/src/errors/errorTypes.ts`

```ts
export class MissingOsPermissionsError extends Error {
  constructor(message = 'Required macOS permissions are missing.') {
    super(message)
    this.name = 'MissingOsPermissionsError'
  }
}

export class DesktopLockHeldError extends Error {
  constructor(message = 'Another session currently owns desktop control.') {
    super(message)
    this.name = 'DesktopLockHeldError'
  }
}

export class DisplayResolutionError extends Error {
  constructor(message = 'Unable to resolve target display.') {
    super(message)
    this.name = 'DisplayResolutionError'
  }
}

export class CoordinateTransformError extends Error {
  constructor(message = 'Unable to map screenshot coordinates to the desktop.') {
    super(message)
    this.name = 'CoordinateTransformError'
  }
}

export class ClipboardGuardError extends Error {
  constructor(message = 'Clipboard access is not allowed for this session.') {
    super(message)
    this.name = 'ClipboardGuardError'
  }
}

export class InputInjectionError extends Error {
  constructor(message = 'Input injection failed.') {
    super(message)
    this.name = 'InputInjectionError'
  }
}

export class ScreenshotCaptureError extends Error {
  constructor(message = 'Screenshot capture failed.') {
    super(message)
    this.name = 'ScreenshotCaptureError'
  }
}

export class PermissionDeniedError extends Error {
  constructor(message = 'Permission request was denied.') {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

export class AppResolutionError extends Error {
  constructor(message = 'Application resolution failed.') {
    super(message)
    this.name = 'AppResolutionError'
  }
}

export class NativeTimeoutError extends Error {
  constructor(message = 'A native bridge call timed out.') {
    super(message)
    this.name = 'NativeTimeoutError'
  }
}

export class ApprovalProviderTimeoutError extends Error {
  constructor(message = 'Approval provider timed out.') {
    super(message)
    this.name = 'ApprovalProviderTimeoutError'
  }
}

export class UnsupportedHostApprovalError extends Error {
  constructor(message = 'The connected host does not support the required approval callback.') {
    super(message)
    this.name = 'UnsupportedHostApprovalError'
  }
}
```

---

## `packages/computer-use-mcp/src/errors/errorMapper.ts`

```ts
export function toCallToolErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  const name = error instanceof Error ? error.name : 'UnknownError'

  return {
    content: [{ type: 'text', text: `${name}: ${message}` }],
    structuredContent: {
      ok: false,
      error: {
        name,
        message,
      },
    },
    isError: true,
  }
}
```

---

## `packages/computer-use-mcp/src/native/bridgeTypes.ts`

```ts
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

export interface TccBridge {
  getState(): Promise<TccState>
  openAccessibilitySettings(): Promise<void>
  openScreenRecordingSettings(): Promise<void>
}

export interface HotkeyBridge {
  registerEscapeAbort(sessionId: string): Promise<void>
  markExpectedEscape(sessionId: string, windowMs: number): Promise<void>
  unregisterEscapeAbort(sessionId: string): Promise<void>
}

export interface RunLoopPump {
  retain(tag: string): void
  release(tag: string): void
}

export interface NativeHostAdapter {
  screenshots: ScreenshotBridge
  apps: AppBridge
  input: InputBridge
  tcc: TccBridge
  hotkeys: HotkeyBridge
  runLoop: RunLoopPump
}
```

---

## `packages/computer-use-mcp/src/native/swiftBridge.ts`

```ts
import type {
  AppBridge,
  CaptureOptions,
  CaptureResult,
  DisplayInfo,
  NativeHostAdapter,
  ScreenshotBridge,
  TccBridge,
  TccState,
} from './bridgeTypes.js'
import type { Logger } from '../observability/logger.js'
import type { RuntimeConfig } from '../config.js'
import { ScreenshotCaptureError } from '../errors/errorTypes.js'

const ONE_BY_ONE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3tQ0AAAAAASUVORK5CYII='

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

function createFakeScreenshotBridge(): ScreenshotBridge {
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

function createFakeAppBridge(logger: Logger): AppBridge {
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

function createFakeTccBridge(): TccBridge {
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

export function createSwiftSideBridges(config: RuntimeConfig, logger: Logger): Pick<NativeHostAdapter, 'screenshots' | 'apps' | 'tcc'> {
  if (config.fakeMode) {
    return {
      screenshots: createFakeScreenshotBridge(),
      apps: createFakeAppBridge(logger),
      tcc: createFakeTccBridge(),
    }
  }

  return {
    screenshots: {
      async listDisplays() {
        throw new ScreenshotCaptureError('Native screenshot bridge not implemented yet.')
      },
      async capture() {
        throw new ScreenshotCaptureError('Native screenshot bridge not implemented yet.')
      },
    },
    apps: {
      async listInstalledApps() {
        return []
      },
      async listRunningApps() {
        return []
      },
      async openApplication() {
        throw new Error('Native app bridge not implemented yet.')
      },
      async hideApplications() {
        return []
      },
      async unhideApplications() {
        return
      },
      async findWindowDisplays() {
        return {}
      },
    },
    tcc: {
      async getState() {
        return { accessibility: false, screenRecording: false }
      },
      async openAccessibilitySettings() {
        logger.info('openAccessibilitySettings TODO')
      },
      async openScreenRecordingSettings() {
        logger.info('openScreenRecordingSettings TODO')
      },
    },
  }
}
```

---

## `packages/computer-use-mcp/src/native/inputBridge.ts`

```ts
import type { CursorPosition, InputBridge, NativeHostAdapter } from './bridgeTypes.js'
import type { Logger } from '../observability/logger.js'
import type { RuntimeConfig } from '../config.js'

function createFakeInputBridge(logger: Logger): InputBridge {
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

function createFakeHotkeyBridge() {
  return {
    async registerEscapeAbort() {
      return
    },
    async markExpectedEscape() {
      return
    },
    async unregisterEscapeAbort() {
      return
    },
  }
}

function createFakeRunLoopPump() {
  return {
    retain() {
      return
    },
    release() {
      return
    },
  }
}

export function createInputSideBridges(config: RuntimeConfig, logger: Logger): Pick<NativeHostAdapter, 'input' | 'hotkeys' | 'runLoop'> {
  if (config.fakeMode) {
    return {
      input: createFakeInputBridge(logger),
      hotkeys: createFakeHotkeyBridge(),
      runLoop: createFakeRunLoopPump(),
    }
  }

  return {
    input: {
      async getCursorPosition() {
        return { x: 0, y: 0 }
      },
      async moveMouse() {
        throw new Error('Native input bridge not implemented yet.')
      },
      async mouseDown() {
        throw new Error('Native input bridge not implemented yet.')
      },
      async mouseUp() {
        throw new Error('Native input bridge not implemented yet.')
      },
      async click() {
        throw new Error('Native input bridge not implemented yet.')
      },
      async scroll() {
        throw new Error('Native input bridge not implemented yet.')
      },
      async keySequence() {
        throw new Error('Native input bridge not implemented yet.')
      },
      async keyDown() {
        throw new Error('Native input bridge not implemented yet.')
      },
      async keyUp() {
        throw new Error('Native input bridge not implemented yet.')
      },
      async typeText() {
        throw new Error('Native input bridge not implemented yet.')
      },
    },
    hotkeys: createFakeHotkeyBridge(),
    runLoop: createFakeRunLoopPump(),
  }
}
```

---

## `packages/computer-use-mcp/src/session/sessionContext.ts`

```ts
import type { AllowedApp, GrantFlags, ScreenshotDims, TccState } from '../native/bridgeTypes.js'

export interface SessionContext {
  sessionId: string
  clientId?: string
  clientName?: string
  connectionId: string
  startedAt: string
  lastSeenAt: string
  allowedApps: AllowedApp[]
  grantFlags: GrantFlags
  selectedDisplayId?: number
  displayPinnedByModel: boolean
  lastScreenshotDims?: ScreenshotDims
  hiddenDuringTurn: Set<string>
  tccState?: TccState
  approvalMode: 'local-ui' | 'host-callback' | 'hybrid'
  hostApprovalCapabilities?: {
    appApproval: boolean
    tccPromptRelay: boolean
  }
}

export function createDefaultGrantFlags(): GrantFlags {
  return {
    clipboardRead: false,
    clipboardWrite: false,
    systemKeyCombos: false,
  }
}

export function createSessionContext(input: {
  sessionId: string
  connectionId: string
  approvalMode: 'local-ui' | 'host-callback' | 'hybrid'
  clientId?: string
  clientName?: string
}): SessionContext {
  const now = new Date().toISOString()
  return {
    sessionId: input.sessionId,
    clientId: input.clientId,
    clientName: input.clientName,
    connectionId: input.connectionId,
    startedAt: now,
    lastSeenAt: now,
    allowedApps: [],
    grantFlags: createDefaultGrantFlags(),
    displayPinnedByModel: false,
    hiddenDuringTurn: new Set<string>(),
    approvalMode: input.approvalMode,
  }
}
```

---

## `packages/computer-use-mcp/src/session/sessionStore.ts`

```ts
import { createSessionContext, type SessionContext } from './sessionContext.js'

export class SessionStore {
  private readonly sessions = new Map<string, SessionContext>()

  getOrCreate(input: {
    sessionId: string
    connectionId: string
    approvalMode: 'local-ui' | 'host-callback' | 'hybrid'
    clientId?: string
    clientName?: string
  }): SessionContext {
    const existing = this.sessions.get(input.sessionId)
    if (existing) {
      existing.lastSeenAt = new Date().toISOString()
      return existing
    }

    const created = createSessionContext(input)
    this.sessions.set(input.sessionId, created)
    return created
  }

  get(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId)
  }

  update(sessionId: string, updater: (session: SessionContext) => void): SessionContext {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`)
    }
    updater(session)
    session.lastSeenAt = new Date().toISOString()
    return session
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}
```

---

## `packages/computer-use-mcp/src/session/lock.ts`

```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { DesktopLockHeldError } from '../errors/errorTypes.js'

interface LockPayload {
  sessionId: string
  connectionId: string
  pid: number
  acquiredAt: string
}

export class DesktopLockManager {
  private readonly reentrant = new Map<string, number>()

  constructor(private readonly lockPath: string) {}

  async acquire(sessionId: string, connectionId: string): Promise<() => Promise<void>> {
    const depth = this.reentrant.get(sessionId) ?? 0
    if (depth > 0) {
      this.reentrant.set(sessionId, depth + 1)
      return async () => {
        await this.release(sessionId)
      }
    }

    await fs.mkdir(path.dirname(this.lockPath), { recursive: true })

    const payload: LockPayload = {
      sessionId,
      connectionId,
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const handle = await fs.open(this.lockPath, 'wx')
        await handle.writeFile(JSON.stringify(payload), 'utf8')
        await handle.close()
        this.reentrant.set(sessionId, 1)
        return async () => {
          await this.release(sessionId)
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err.code !== 'EEXIST') {
          throw error
        }
        const recovered = await this.tryRecoverStaleLock()
        if (!recovered) {
          throw new DesktopLockHeldError()
        }
      }
    }

    throw new DesktopLockHeldError()
  }

  private async release(sessionId: string): Promise<void> {
    const depth = this.reentrant.get(sessionId) ?? 0
    if (depth <= 1) {
      this.reentrant.delete(sessionId)
      await fs.rm(this.lockPath, { force: true })
      return
    }
    this.reentrant.set(sessionId, depth - 1)
  }

  private async tryRecoverStaleLock(): Promise<boolean> {
    try {
      const raw = await fs.readFile(this.lockPath, 'utf8')
      const payload = JSON.parse(raw) as LockPayload
      try {
        process.kill(payload.pid, 0)
        return false
      } catch {
        await fs.rm(this.lockPath, { force: true })
        return true
      }
    } catch {
      await fs.rm(this.lockPath, { force: true })
      return true
    }
  }
}
```

---

## `packages/computer-use-mcp/src/approvals/approvalProvider.ts`

```ts
import type { AllowedApp, GrantFlags, TccState } from '../native/bridgeTypes.js'
import type { SessionContext } from '../session/sessionContext.js'

export interface AppAccessRequest {
  sessionId: string
  requestedApps: AllowedApp[]
  requestedFlags: GrantFlags
  currentTccState: TccState
}

export interface AppAccessResult {
  approved: boolean
  grantedApps: AllowedApp[]
  deniedApps: AllowedApp[]
  effectiveFlags: GrantFlags
}

export interface TccApprovalRequest {
  sessionId: string
  accessibilityRequired: boolean
  screenRecordingRequired: boolean
}

export interface TccApprovalResult {
  acknowledged: boolean
  recheckedState: TccState
}

export interface ApprovalProvider {
  readonly name: string
  supports(session: SessionContext): boolean
  requestTccApproval(req: TccApprovalRequest): Promise<TccApprovalResult>
  requestAppAccess(req: AppAccessRequest): Promise<AppAccessResult>
}
```

---

## `packages/computer-use-mcp/src/approvals/approvalCoordinator.ts`

```ts
import type { ApprovalProvider, AppAccessResult } from './approvalProvider.js'
import type { AllowedApp, GrantFlags, NativeHostAdapter, TccState } from '../native/bridgeTypes.js'
import type { SessionContext } from '../session/sessionContext.js'
import { PermissionDeniedError } from '../errors/errorTypes.js'

export class ApprovalCoordinator {
  constructor(
    private readonly nativeHost: NativeHostAdapter,
    private readonly localProvider: ApprovalProvider,
  ) {}

  async ensureTcc(session: SessionContext): Promise<TccState> {
    const current = await this.nativeHost.tcc.getState()
    if (current.accessibility && current.screenRecording) {
      session.tccState = current
      return current
    }

    const result = await this.localProvider.requestTccApproval({
      sessionId: session.sessionId,
      accessibilityRequired: !current.accessibility,
      screenRecordingRequired: !current.screenRecording,
    })

    if (!result.acknowledged) {
      throw new PermissionDeniedError('The user did not acknowledge the required macOS permissions.')
    }

    session.tccState = result.recheckedState
    return result.recheckedState
  }

  async ensureAppAccess(
    session: SessionContext,
    requestedApps: AllowedApp[],
    requestedFlags: Partial<GrantFlags>,
  ): Promise<AppAccessResult> {
    const currentTccState = session.tccState ?? (await this.nativeHost.tcc.getState())

    const desiredFlags: GrantFlags = {
      clipboardRead: requestedFlags.clipboardRead ?? session.grantFlags.clipboardRead,
      clipboardWrite: requestedFlags.clipboardWrite ?? session.grantFlags.clipboardWrite,
      systemKeyCombos: requestedFlags.systemKeyCombos ?? session.grantFlags.systemKeyCombos,
    }

    const result = await this.localProvider.requestAppAccess({
      sessionId: session.sessionId,
      requestedApps,
      requestedFlags: desiredFlags,
      currentTccState,
    })

    if (!result.approved) {
      throw new PermissionDeniedError('The user denied application access.')
    }

    session.allowedApps = dedupeApps([...session.allowedApps, ...result.grantedApps])
    session.grantFlags = result.effectiveFlags
    return result
  }
}

function dedupeApps(apps: AllowedApp[]): AllowedApp[] {
  const byId = new Map<string, AllowedApp>()
  for (const app of apps) {
    byId.set(app.bundleId, app)
  }
  return [...byId.values()]
}
```

---

## `packages/computer-use-mcp/src/approvals/localUiProvider.ts`

```ts
import type {
  AppAccessRequest,
  AppAccessResult,
  ApprovalProvider,
  TccApprovalRequest,
  TccApprovalResult,
} from './approvalProvider.js'
import type { SessionContext } from '../session/sessionContext.js'

export class LocalUiApprovalProvider implements ApprovalProvider {
  readonly name = 'local-ui'

  supports(_session: SessionContext): boolean {
    return true
  }

  async requestTccApproval(_req: TccApprovalRequest): Promise<TccApprovalResult> {
    // Starter behavior:
    // - in fake mode this is effectively auto-approved by the fake TCC bridge
    // - in real mode this should later launch the native approval helper
    return {
      acknowledged: true,
      recheckedState: {
        accessibility: true,
        screenRecording: true,
      },
    }
  }

  async requestAppAccess(req: AppAccessRequest): Promise<AppAccessResult> {
    return {
      approved: true,
      grantedApps: req.requestedApps,
      deniedApps: [],
      effectiveFlags: req.requestedFlags,
    }
  }
}
```

---

## `packages/computer-use-mcp/src/mcp/sessionIdentity.ts`

```ts
export interface ToolExtra {
  sessionId?: string
}

export function resolveSessionId(extra?: ToolExtra): string {
  return extra?.sessionId ?? `stdio:${process.pid}`
}

export function resolveConnectionId(extra?: ToolExtra): string {
  return extra?.sessionId ?? `stdio-connection:${process.pid}`
}
```

---

## `packages/computer-use-mcp/src/transforms/screenshotSizing.ts`

```ts
import type { DisplayInfo } from '../native/bridgeTypes.js'

export function resolveScreenshotTargetSize(display: DisplayInfo, maxDimension: number): { width: number; height: number } {
  const largest = Math.max(display.width, display.height)
  if (largest <= maxDimension) {
    return { width: display.width, height: display.height }
  }

  const ratio = maxDimension / largest
  return {
    width: Math.round(display.width * ratio),
    height: Math.round(display.height * ratio),
  }
}
```

---

## `packages/computer-use-mcp/src/transforms/coordinates.ts`

```ts
import type { CursorPosition, ScreenshotDims } from '../native/bridgeTypes.js'
import { CoordinateTransformError } from '../errors/errorTypes.js'

export function mapScreenshotPointToDesktop(point: CursorPosition, dims?: ScreenshotDims): CursorPosition {
  if (!dims) {
    return point
  }

  if (dims.width <= 0 || dims.height <= 0) {
    throw new CoordinateTransformError()
  }

  const targetWidth = dims.logicalWidth ?? dims.width
  const targetHeight = dims.logicalHeight ?? dims.height

  return {
    x: dims.originX + (point.x / dims.width) * targetWidth,
    y: dims.originY + (point.y / dims.height) * targetHeight,
  }
}
```

---

## `packages/computer-use-mcp/src/mcp/callRouter.ts`

```ts
import { toCallToolErrorResult } from '../errors/errorMapper.js'
import { resolveConnectionId, resolveSessionId, type ToolExtra } from './sessionIdentity.js'
import type { SessionContext } from '../session/sessionContext.js'
import type { ServerRuntime } from './server.js'

export interface ToolExecutionContext {
  runtime: ServerRuntime
  session: SessionContext
  extra?: ToolExtra
}

export type ToolHandler<TArgs> = (ctx: ToolExecutionContext, args: TArgs) => Promise<unknown>

export function createToolHandler<TArgs>(runtime: ServerRuntime, handler: ToolHandler<TArgs>) {
  return async (args: TArgs, extra?: ToolExtra) => {
    const sessionId = resolveSessionId(extra)
    const connectionId = resolveConnectionId(extra)
    const session = runtime.sessionStore.getOrCreate({
      sessionId,
      connectionId,
      approvalMode: runtime.config.approvalDefaultMode,
    })

    try {
      return await handler({ runtime, session, extra }, args)
    } catch (error) {
      runtime.logger.error('tool execution failed', {
        sessionId,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      })
      return toCallToolErrorResult(error)
    }
  }
}
```

---

## `packages/computer-use-mcp/src/tools/requestAccess.ts`

```ts
import type { AllowedApp, GrantFlags } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'

export interface RequestAccessArgs {
  apps?: AllowedApp[]
  flags?: Partial<GrantFlags>
}

export async function requestAccessTool(ctx: ToolExecutionContext, args: RequestAccessArgs) {
  const tccState = await ctx.runtime.approvalCoordinator.ensureTcc(ctx.session)

  let grantedApps = ctx.session.allowedApps
  let effectiveFlags = ctx.session.grantFlags

  if ((args.apps?.length ?? 0) > 0 || args.flags) {
    const result = await ctx.runtime.approvalCoordinator.ensureAppAccess(
      ctx.session,
      args.apps ?? [],
      args.flags ?? {},
    )
    grantedApps = result.grantedApps
    effectiveFlags = result.effectiveFlags
  }

  return {
    content: [{ type: 'text', text: 'Access state updated.' }],
    structuredContent: {
      ok: true,
      grantedApps,
      deniedApps: [],
      effectiveFlags,
      tccState,
    },
  }
}
```

---

## `packages/computer-use-mcp/src/tools/screenshot.ts`

```ts
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import { resolveScreenshotTargetSize } from '../transforms/screenshotSizing.js'

export interface ScreenshotArgs {
  displayId?: number
}

export async function screenshotTool(ctx: ToolExecutionContext, args: ScreenshotArgs) {
  const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
  if (!tccState.screenRecording) {
    throw new MissingOsPermissionsError('Screen Recording permission is required before screenshot can run.')
  }

  const displays = await ctx.runtime.nativeHost.screenshots.listDisplays()
  const display = displays.find(item => item.displayId === args.displayId) ?? displays[0]
  if (!display) {
    throw new Error('No displays are available.')
  }

  const target = resolveScreenshotTargetSize(display, ctx.runtime.config.screenshotTargetMaxDimension)

  const capture = await ctx.runtime.nativeHost.screenshots.capture({
    displayId: display.displayId,
    format: ctx.runtime.config.screenshotDefaultFormat,
    jpegQuality: ctx.runtime.config.screenshotJpegQuality,
    targetWidth: target.width,
    targetHeight: target.height,
    excludeBundleIds: [],
  })

  ctx.session.lastScreenshotDims = {
    width: capture.width,
    height: capture.height,
    displayId: capture.display.displayId,
    originX: capture.display.originX,
    originY: capture.display.originY,
    logicalWidth: capture.display.width,
    logicalHeight: capture.display.height,
    scaleFactor: capture.display.scaleFactor,
  }

  return {
    content: [
      {
        type: 'image',
        data: capture.dataBase64,
        mimeType: capture.mimeType,
      },
      {
        type: 'text',
        text: `Captured display ${capture.display.displayId}.`,
      },
    ],
    structuredContent: {
      ok: true,
      mimeType: capture.mimeType,
      width: capture.width,
      height: capture.height,
      displayId: capture.display.displayId,
      originX: capture.display.originX,
      originY: capture.display.originY,
      logicalWidth: capture.display.width,
      logicalHeight: capture.display.height,
      scaleFactor: capture.display.scaleFactor,
    },
  }
}
```

---

## `packages/computer-use-mcp/src/tools/cursorPosition.ts`

```ts
import type { ToolExecutionContext } from '../mcp/callRouter.js'

export async function cursorPositionTool(ctx: ToolExecutionContext) {
  const position = await ctx.runtime.nativeHost.input.getCursorPosition()
  return {
    content: [{ type: 'text', text: `Cursor at (${position.x}, ${position.y}).` }],
    structuredContent: {
      ok: true,
      x: position.x,
      y: position.y,
    },
  }
}
```

---

## `packages/computer-use-mcp/src/tools/click.ts`

```ts
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { MissingOsPermissionsError } from '../errors/errorTypes.js'
import { mapScreenshotPointToDesktop } from '../transforms/coordinates.js'

export interface ClickArgs {
  x: number
  y: number
}

export async function leftClickTool(ctx: ToolExecutionContext, args: ClickArgs) {
  const releaseLock = await ctx.runtime.lockManager.acquire(ctx.session.sessionId, ctx.session.connectionId)
  try {
    const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
    if (!tccState.accessibility) {
      throw new MissingOsPermissionsError('Accessibility permission is required before left_click can run.')
    }

    const mapped = mapScreenshotPointToDesktop({ x: args.x, y: args.y }, ctx.session.lastScreenshotDims)
    await ctx.runtime.nativeHost.input.moveMouse(mapped.x, mapped.y)
    await delay(ctx.runtime.config.clickSettleMs)
    await ctx.runtime.nativeHost.input.click('left', 1)

    return {
      content: [{ type: 'text', text: `Clicked at (${Math.round(mapped.x)}, ${Math.round(mapped.y)}).` }],
      structuredContent: {
        ok: true,
        x: mapped.x,
        y: mapped.y,
      },
    }
  } finally {
    await releaseLock()
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

---

## `packages/computer-use-mcp/src/tools/typeText.ts`

```ts
import type { ToolExecutionContext } from '../mcp/callRouter.js'
import { ClipboardGuardError, MissingOsPermissionsError } from '../errors/errorTypes.js'

export interface TypeArgs {
  text: string
  viaClipboard?: boolean
}

export async function typeTextTool(ctx: ToolExecutionContext, args: TypeArgs) {
  const releaseLock = await ctx.runtime.lockManager.acquire(ctx.session.sessionId, ctx.session.connectionId)
  try {
    const tccState = ctx.session.tccState ?? (await ctx.runtime.nativeHost.tcc.getState())
    if (!tccState.accessibility) {
      throw new MissingOsPermissionsError('Accessibility permission is required before type can run.')
    }

    if (args.viaClipboard ?? true) {
      if (!ctx.session.grantFlags.clipboardWrite && !ctx.runtime.config.fakeMode) {
        throw new ClipboardGuardError('Clipboard write is not granted for this session.')
      }
      // Starter simplification:
      // In fake mode and the initial bootstrap phase, route through direct typing.
      // Replace this with real clipboard save/write/paste/restore in the next milestone.
      await ctx.runtime.nativeHost.input.typeText(args.text)
    } else {
      await ctx.runtime.nativeHost.input.typeText(args.text)
    }

    return {
      content: [{ type: 'text', text: 'Typed text into the focused UI.' }],
      structuredContent: {
        ok: true,
        viaClipboard: args.viaClipboard ?? true,
      },
    }
  } finally {
    await releaseLock()
  }
}
```

---

## `packages/computer-use-mcp/src/tools/applications.ts`

```ts
import type { AllowedApp } from '../native/bridgeTypes.js'
import type { ToolExecutionContext } from '../mcp/callRouter.js'

export interface OpenApplicationArgs {
  bundleId: string
}

export async function openApplicationTool(ctx: ToolExecutionContext, args: OpenApplicationArgs) {
  const releaseLock = await ctx.runtime.lockManager.acquire(ctx.session.sessionId, ctx.session.connectionId)
  try {
    const alreadyAllowed = ctx.session.allowedApps.some(app => app.bundleId === args.bundleId)
    if (!alreadyAllowed) {
      const requestedApp: AllowedApp = {
        bundleId: args.bundleId,
        displayName: args.bundleId.split('.').pop() ?? args.bundleId,
      }

      await ctx.runtime.approvalCoordinator.ensureAppAccess(ctx.session, [requestedApp], {})
    }

    await ctx.runtime.nativeHost.apps.openApplication(args.bundleId)

    return {
      content: [{ type: 'text', text: `Opened ${args.bundleId}.` }],
      structuredContent: {
        ok: true,
        bundleId: args.bundleId,
      },
    }
  } finally {
    await releaseLock()
  }
}
```

---

## `packages/computer-use-mcp/src/mcp/toolRegistry.ts`

```ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createToolHandler } from './callRouter.js'
import type { ServerRuntime } from './server.js'
import { requestAccessTool } from '../tools/requestAccess.js'
import { screenshotTool } from '../tools/screenshot.js'
import { cursorPositionTool } from '../tools/cursorPosition.js'
import { leftClickTool } from '../tools/click.js'
import { typeTextTool } from '../tools/typeText.js'
import { openApplicationTool } from '../tools/applications.js'

const AllowedAppSchema = z.object({
  bundleId: z.string(),
  displayName: z.string(),
  path: z.string().optional(),
})

export function registerTools(server: McpServer, runtime: ServerRuntime): void {
  server.registerTool(
    'request_access',
    {
      title: 'Request Access',
      description: 'Ask the user to grant macOS permissions, app access, and capability flags for this session.',
      inputSchema: {
        apps: z.array(AllowedAppSchema).optional(),
        flags: z.object({
          clipboardRead: z.boolean().optional(),
          clipboardWrite: z.boolean().optional(),
          systemKeyCombos: z.boolean().optional(),
        }).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    createToolHandler(runtime, requestAccessTool),
  )

  server.registerTool(
    'screenshot',
    {
      title: 'Screenshot',
      description: 'Capture a screenshot of the selected display or the active desktop view.',
      inputSchema: {
        displayId: z.number().int().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    createToolHandler(runtime, screenshotTool),
  )

  server.registerTool(
    'cursor_position',
    {
      title: 'Cursor Position',
      description: 'Return the current cursor position in desktop coordinates.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    createToolHandler(runtime, async ctx => cursorPositionTool(ctx)),
  )

  server.registerTool(
    'left_click',
    {
      title: 'Left Click',
      description: 'Move to screenshot coordinates and perform a single left click.',
      inputSchema: {
        x: z.number(),
        y: z.number(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    createToolHandler(runtime, leftClickTool),
  )

  server.registerTool(
    'type',
    {
      title: 'Type Text',
      description: 'Type text into the focused UI element.',
      inputSchema: {
        text: z.string(),
        viaClipboard: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    createToolHandler(runtime, typeTextTool),
  )

  server.registerTool(
    'open_application',
    {
      title: 'Open Application',
      description: 'Launch or activate an application by bundle identifier.',
      inputSchema: {
        bundleId: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    createToolHandler(runtime, openApplicationTool),
  )
}
```

---

## `packages/computer-use-mcp/src/mcp/server.ts`

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RuntimeConfig } from '../config.js'
import type { ApprovalCoordinator } from '../approvals/approvalCoordinator.js'
import type { DesktopLockManager } from '../session/lock.js'
import type { SessionStore } from '../session/sessionStore.js'
import type { NativeHostAdapter } from '../native/bridgeTypes.js'
import type { Logger } from '../observability/logger.js'
import { registerTools } from './toolRegistry.js'

export interface ServerRuntime {
  config: RuntimeConfig
  sessionStore: SessionStore
  lockManager: DesktopLockManager
  approvalCoordinator: ApprovalCoordinator
  nativeHost: NativeHostAdapter
  logger: Logger
}

export function createMcpComputerUseServer(runtime: ServerRuntime): McpServer {
  const server = new McpServer(
    {
      name: runtime.config.serverName,
      version: runtime.config.serverVersion,
    },
    {
      capabilities: {
        logging: {},
      },
    },
  )

  registerTools(server, runtime)
  return server
}
```

---

## `packages/computer-use-mcp/src/mcp/stdioTransport.ts`

```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

export async function connectStdioTransport(server: McpServer): Promise<StdioServerTransport> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return transport
}
```

---

## `packages/computer-use-mcp/src/main.ts`

```ts
import { loadConfig } from './config.js'
import { createLogger } from './observability/logger.js'
import { SessionStore } from './session/sessionStore.js'
import { DesktopLockManager } from './session/lock.js'
import { createSwiftSideBridges } from './native/swiftBridge.js'
import { createInputSideBridges } from './native/inputBridge.js'
import { LocalUiApprovalProvider } from './approvals/localUiProvider.js'
import { ApprovalCoordinator } from './approvals/approvalCoordinator.js'
import { createMcpComputerUseServer } from './mcp/server.js'
import { connectStdioTransport } from './mcp/stdioTransport.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const logger = createLogger()
  const sessionStore = new SessionStore()
  const lockManager = new DesktopLockManager(config.lockPath)

  const swiftSide = createSwiftSideBridges(config, logger)
  const inputSide = createInputSideBridges(config, logger)

  const nativeHost = {
    ...swiftSide,
    ...inputSide,
  }

  const localApprovalProvider = new LocalUiApprovalProvider()
  const approvalCoordinator = new ApprovalCoordinator(nativeHost, localApprovalProvider)

  const runtime = {
    config,
    sessionStore,
    lockManager,
    approvalCoordinator,
    nativeHost,
    logger,
  }

  const server = createMcpComputerUseServer(runtime)
  await connectStdioTransport(server)
  logger.info('computer-use MCP server connected over stdio', { fakeMode: config.fakeMode })
}

main().catch(error => {
  const logger = createLogger()
  logger.error('fatal startup error', error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error)
  process.exitCode = 1
})
```

---

## `packages/computer-use-mcp/test/stdio.e2e.test.ts`

```ts
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

describe('computer-use stdio starter', () => {
  it('exposes the starter tools and can execute the fake screenshot loop', async () => {
    const entry = path.resolve(process.cwd(), 'packages/computer-use-mcp/src/main.ts')

    const client = new Client({
      name: 'starter-e2e',
      version: '0.1.0',
    })

    const transport = new StdioClientTransport({
      command: 'pnpm',
      args: ['tsx', entry],
      env: {
        ...process.env,
        COMPUTER_USE_FAKE: '1',
      },
    })

    await client.connect(transport)

    const tools = await client.listTools()
    const toolNames = tools.tools.map(tool => tool.name)

    expect(toolNames).toContain('request_access')
    expect(toolNames).toContain('screenshot')
    expect(toolNames).toContain('cursor_position')
    expect(toolNames).toContain('left_click')
    expect(toolNames).toContain('type')
    expect(toolNames).toContain('open_application')

    const access = await client.callTool({
      name: 'request_access',
      arguments: {
        apps: [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }],
        flags: { clipboardWrite: true },
      },
    })

    expect(access.isError).not.toBe(true)

    const screenshot = await client.callTool({
      name: 'screenshot',
      arguments: {},
    })

    expect(screenshot.isError).not.toBe(true)

    await client.callTool({
      name: 'left_click',
      arguments: { x: 10, y: 10 },
    })

    await client.callTool({
      name: 'type',
      arguments: { text: 'hello from starter canvas', viaClipboard: true },
    })

    await client.close()
  })
})
```

---

## What is intentionally stubbed right now

These are still placeholders in the starter and should be implemented next:

1. real native ScreenCaptureKit screenshot bridge
2. real native NSWorkspace app bridge
3. real input injection bridge
4. real clipboard save, write, paste, restore flow
5. real local approval helper app
6. hide-before-action and cleanup registry
7. Streamable HTTP transport

---

## What to do next

After dropping this base in, the next pass should add:

1. `permissions/tcc.ts`
2. `permissions/appAllowlist.ts`
3. `session/cleanupRegistry.ts`
4. `tools/clipboard.ts`
5. `native/hotkeyBridge.ts`
6. `transforms/prepareForAction.ts`
7. native Swift and Rust bridge implementations

That will move the starter from a fake-loop MCP server to a real macOS computer-control server.

---

## Why this starter is shaped this way

This starter intentionally mirrors the most useful structural lesson from Claude Code without copying it:

- the MCP surface stays thin
- tool handlers do not own global state
- session state is centralized
- approvals are coordinated in one place
- the native boundary is explicit and swappable

That keeps the first implementation usable from any MCP client while leaving room for the later daemon, host callback, and native-app flows.
