# macOS Computer Use MCP Server Implementation Plan

## Status Note

This is a historical implementation-planning document from the initial buildout.

It is still useful for sequencing, rationale, and earlier contract decisions, but it is not the authoritative description of the current codebase. For the live repository state, use:

- `README.md` for the current runtime overview
- `SNAPSHOT.md` for the current file layout
- `docs/capture-asset-reference-execution-plan.md` for the current image-first capture contract

In particular, the current implementation no longer uses the earlier generic capture-delivery ideas that appeared in some planning discussions; `screenshot` and `zoom` now attach inline images and expose geometry plus saved-file metadata through `capture_metadata`.

## 1) Objective

Implement a standalone local `computer-use` MCP server for macOS that any compatible agent app can use.

This document turns the reimplementation spec into a build plan with:

- exact MCP-facing tool contracts
- server-side TypeScript interfaces
- transport adapter interface
- approval provider contract
- native bridge function signatures
- execution flow by tool
- file-by-file implementation order
- test checkpoints and exit criteria

This is a clean-room implementation plan, not a source-cloning guide.

---

## 2) Delivery strategy

### Build order

Ship in this order:

1. stdio MCP server
2. local approval UI shell
3. screenshot path
4. input path
5. app access and allowlist
6. daemon mode with Streamable HTTP
7. host callback approval provider
8. polish and batch behavior

### Why this order

- stdio is the fastest path to working with existing MCP clients
- screenshot plus click plus type is the minimum useful loop
- local approval UI makes the server host-agnostic
- daemon mode adds multi-client and long-lived session concerns later, when the base tool surface is already stable

---

## 3) Protocol alignment assumptions

### MCP transport priorities

Implement transports in this order:

1. `stdio`
2. `streamable-http`

Do not build a custom transport first.

### MCP tool definition shape

Each tool definition should include:

- `name`
- `title`
- `description`
- `inputSchema`
- optional `outputSchema`
- `annotations`
- optional `execution`

### Tool annotation policy

Use annotations consistently so clients can reason about the tools, while not relying on them for security.

Examples:

- `screenshot`: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false`
- `left_click`: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`
- `cursor_position`: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false`

### Tool result policy

Return:

- concise `content` items for human-readable feedback
- `structuredContent` for machine-usable results
- `isError: true` when a call fails in a protocol-relevant way

---

## 4) Recommended repository layout

```text
packages/
  computer-use-mcp/
    src/
      main.ts
      config.ts
      mcp/
        server.ts
        toolRegistry.ts
        callRouter.ts
        transport.ts
        stdioTransport.ts
        streamableHttpTransport.ts
        sessionIdentity.ts
      session/
        sessionContext.ts
        sessionStore.ts
        screenshotState.ts
        lock.ts
        cleanupRegistry.ts
      approvals/
        approvalCoordinator.ts
        approvalProvider.ts
        localUiProvider.ts
        hostCallbackProvider.ts
        approvalTypes.ts
      tools/
        requestAccess.ts
        screenshot.ts
        zoom.ts
        mouseMove.ts
        click.ts
        drag.ts
        scroll.ts
        key.ts
        holdKey.ts
        typeText.ts
        clipboard.ts
        applications.ts
        cursorPosition.ts
        wait.ts
        batch.ts
      native/
        swiftBridge.ts
        inputBridge.ts
        hotkeyBridge.ts
        runLoopPump.ts
        bridgeTypes.ts
      permissions/
        tcc.ts
        appAllowlist.ts
      transforms/
        coordinates.ts
        screenshotSizing.ts
      errors/
        errorTypes.ts
        errorMapper.ts
      observability/
        logger.ts
        telemetry.ts
      utils/
        timers.ts
        validation.ts
        ids.ts
        async.ts
        json.ts
  approval-ui-macos/
    Sources/
      ApprovalUIMacOS/
        App.swift
        PermissionWindow.swift
        AppAccessWindow.swift
        Models.swift
        IPCBridge.swift
  native-swift/
    Sources/
      ComputerUseSwift/
        ScreenshotService.swift
        DisplayService.swift
        AppService.swift
        TccService.swift
        HotkeyService.swift
        RunLoopBridge.swift
        Models.swift
  native-input/
    src/
      lib.rs
      mouse.rs
      keyboard.rs
      scroll.rs
      frontmost.rs
      errors.rs
  host-sdk/
    src/
      approvalCallbacks.ts
      sessionMetadata.ts
      index.ts
```

---

## 5) Runtime model

## 5.1 Main runtime objects

```ts
interface ServerRuntime {
  config: RuntimeConfig
  sessionStore: SessionStore
  lockManager: DesktopLockManager
  approvalCoordinator: ApprovalCoordinator
  nativeHost: NativeHostAdapter
  transports: TransportAdapter[]
  logger: Logger
}

interface RuntimeConfig {
  daemonMode: boolean
  enableStreamableHttp: boolean
  approvalDefaultMode: 'local-ui' | 'host-callback' | 'hybrid'
  streamableHttpBindHost?: string
  streamableHttpPort?: number
  streamableHttpRequireOriginValidation: boolean
  streamableHttpAllowedOrigins?: string[]
  screenshotDefaultFormat: 'jpeg' | 'png'
  screenshotTargetMaxDimension: number
  screenshotJpegQuality: number
  dragAnimationMs: number
  clickSettleMs: number
  nativeCallTimeoutMs: number
}
```

## 5.2 Session lifecycle

1. client connects
2. server assigns or resolves `sessionId`
3. session store creates `SessionContext`
4. tool calls execute against that session
5. mutation tools attempt to acquire desktop lock
6. cleanup runs at end of call or on cancellation
7. session is closed on disconnect or timeout

---

## 6) TypeScript interfaces

## 6.1 Session interfaces

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
```

## 6.2 Transport adapter interface

```ts
export interface TransportAdapter {
  readonly name: string
  start(runtime: ServerRuntime): Promise<void>
  stop(): Promise<void>
}
```

## 6.3 Approval provider contract

```ts
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

## 6.4 Approval coordinator contract

```ts
export interface ApprovalCoordinator {
  ensureTcc(session: SessionContext): Promise<TccState>
  ensureAppAccess(
    session: SessionContext,
    requestedApps: AllowedApp[],
    requestedFlags: Partial<GrantFlags>
  ): Promise<AppAccessResult>
}
```

## 6.5 Native host adapter contract

```ts
export interface NativeHostAdapter {
  screenshots: ScreenshotBridge
  apps: AppBridge
  input: InputBridge
  hotkeys: HotkeyBridge
  runLoop: RunLoopPump
}
```

---

## 7) Native bridge signatures

## 7.1 Screenshot bridge

```ts
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
```

## 7.2 App bridge

```ts
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
```

## 7.3 Input bridge

```ts
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
```

## 7.4 TCC and hotkey bridge

```ts
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
```

---

## 8) MCP tool schemas

The schemas below should be used in `toolRegistry.ts`.

## 8.1 `request_access`

```ts
export const requestAccessTool = {
  name: 'request_access',
  title: 'Request Access',
  description: 'Ask the user to grant macOS permissions, app access, and capability flags for this session.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      apps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            bundleId: { type: 'string' },
            displayName: { type: 'string' }
          },
          required: ['bundleId', 'displayName']
        },
        default: []
      },
      flags: {
        type: 'object',
        additionalProperties: false,
        properties: {
          clipboardRead: { type: 'boolean' },
          clipboardWrite: { type: 'boolean' },
          systemKeyCombos: { type: 'boolean' }
        },
        default: {}
      }
    },
    required: []
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      grantedApps: { type: 'array', items: { type: 'object' } },
      deniedApps: { type: 'array', items: { type: 'object' } },
      effectiveFlags: { type: 'object' },
      tccState: { type: 'object' }
    },
    required: ['grantedApps', 'deniedApps', 'effectiveFlags', 'tccState']
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

## 8.2 `screenshot`

```ts
export const screenshotTool = {
  name: 'screenshot',
  title: 'Screenshot',
  description: 'Capture a screenshot of the selected display or the active desktop view.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      displayId: { type: 'integer' }
    },
    required: []
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mimeType: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      displayId: { type: 'integer' },
      originX: { type: 'integer' },
      originY: { type: 'integer' },
      logicalWidth: { type: 'number' },
      logicalHeight: { type: 'number' },
      scaleFactor: { type: 'number' }
    },
    required: ['mimeType', 'width', 'height', 'displayId', 'originX', 'originY']
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

## 8.3 `zoom`

```ts
export const zoomTool = {
  name: 'zoom',
  title: 'Zoom Screenshot',
  description: 'Capture a cropped region from the current display.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number' },
      height: { type: 'number' },
      displayId: { type: 'integer' }
    },
    required: ['x', 'y', 'width', 'height']
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

## 8.4 Pointer tools

Implement the following names with a shared handler:

- `left_click`
- `right_click`
- `middle_click`
- `double_click`
- `triple_click`
- `mouse_move`
- `left_click_drag`
- `scroll`

Shared click-like schema:

```ts
const pointSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' }
  },
  required: ['x', 'y']
}
```

Drag schema:

```ts
const dragSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fromX: { type: 'number' },
    fromY: { type: 'number' },
    toX: { type: 'number' },
    toY: { type: 'number' }
  },
  required: ['toX', 'toY']
}
```

Scroll schema:

```ts
const scrollSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    dx: { type: 'number' },
    dy: { type: 'number' }
  },
  required: ['x', 'y', 'dx', 'dy']
}
```

## 8.5 Keyboard tools

### `type`

```ts
export const typeTool = {
  name: 'type',
  title: 'Type Text',
  description: 'Type text into the focused UI element.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string' },
      viaClipboard: { type: 'boolean', default: true }
    },
    required: ['text']
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true
  }
}
```

### `key`

```ts
export const keyTool = {
  name: 'key',
  title: 'Press Key Sequence',
  description: 'Press a key or key chord such as command+a or escape.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sequence: { type: 'string' },
      repeat: { type: 'integer', minimum: 1, maximum: 20, default: 1 }
    },
    required: ['sequence']
  }
}
```

### `hold_key`

```ts
export const holdKeyTool = {
  name: 'hold_key',
  title: 'Hold Keys',
  description: 'Hold one or more keys for a bounded duration.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      keys: { type: 'array', items: { type: 'string' }, minItems: 1 },
      durationMs: { type: 'integer', minimum: 1, maximum: 10000 }
    },
    required: ['keys', 'durationMs']
  }
}
```

## 8.6 Clipboard tools

### `read_clipboard`

```ts
export const readClipboardTool = {
  name: 'read_clipboard',
  title: 'Read Clipboard',
  description: 'Read the current clipboard text if this session is allowed to do so.',
  inputSchema: {
    type: 'object',
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

### `write_clipboard`

```ts
export const writeClipboardTool = {
  name: 'write_clipboard',
  title: 'Write Clipboard',
  description: 'Write text to the system clipboard if this session is allowed to do so.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  }
}
```

## 8.7 Application tools

### `open_application`

```ts
export const openApplicationTool = {
  name: 'open_application',
  title: 'Open Application',
  description: 'Launch or activate an application by bundle identifier.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      bundleId: { type: 'string' }
    },
    required: ['bundleId']
  }
}
```

### `list_granted_applications`

```ts
export const listGrantedApplicationsTool = {
  name: 'list_granted_applications',
  title: 'List Granted Applications',
  description: 'Return the applications this session is allowed to control.',
  inputSchema: {
    type: 'object',
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

## 8.8 Misc tools

### `cursor_position`

```ts
export const cursorPositionTool = {
  name: 'cursor_position',
  title: 'Cursor Position',
  description: 'Return the current cursor position in desktop coordinates.',
  inputSchema: {
    type: 'object',
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

### `wait`

```ts
export const waitTool = {
  name: 'wait',
  title: 'Wait',
  description: 'Sleep for a bounded duration.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      durationMs: { type: 'integer', minimum: 1, maximum: 10000 }
    },
    required: ['durationMs']
  }
}
```

### `computer_batch`

Leave for Milestone 6.

---

## 9) Core execution flows

## 9.1 `request_access`

### Flow

1. get session context
2. check current TCC state
3. if TCC missing:
   - invoke approval coordinator `ensureTcc`
   - re-check TCC state
4. if requested apps or flags exceed current grants:
   - invoke approval coordinator `ensureAppAccess`
5. update session grants
6. return structured result

### Files

- `tools/requestAccess.ts`
- `approvals/approvalCoordinator.ts`
- `permissions/tcc.ts`
- `permissions/appAllowlist.ts`

## 9.2 `screenshot`

### Flow

1. get session context
2. validate TCC state includes Screen Recording
3. resolve target display
4. compute exclude bundle IDs
5. compute target screenshot dimensions
6. call screenshot bridge
7. persist `lastScreenshotDims`
8. return image plus structured metadata

### Files

- `tools/screenshot.ts`
- `transforms/screenshotSizing.ts`
- `session/screenshotState.ts`
- `native/swiftBridge.ts`

## 9.3 `left_click`

### Flow

1. get session context
2. acquire desktop lock
3. ensure Accessibility permission
4. map screenshot coordinates to real display coordinates
5. run pre-action preparation
6. move cursor
7. wait `clickSettleMs`
8. click
9. cleanup hidden apps and release lock

### Files

- `tools/click.ts`
- `transforms/coordinates.ts`
- `session/lock.ts`
- `native/inputBridge.ts`
- `session/cleanupRegistry.ts`

## 9.4 `type`

### Flow

1. get session context
2. acquire lock
3. ensure Accessibility permission
4. if `viaClipboard`:
   - check clipboard write grant
   - save clipboard
   - write text to clipboard
   - issue paste chord
   - restore clipboard in `finally`
5. else use direct text injection
6. release lock and cleanup

### Files

- `tools/typeText.ts`
- `tools/clipboard.ts`
- `session/cleanupRegistry.ts`

## 9.5 `open_application`

### Flow

1. get session context
2. acquire lock
3. ensure target app is granted or request access if not
4. call app bridge `openApplication`
5. release lock

### Files

- `tools/applications.ts`
- `permissions/appAllowlist.ts`
- `native/swiftBridge.ts`

---

## 10) Pre-action helpers

These helpers should exist before mutation tools are considered stable.

## 10.1 `resolveTargetDisplay`

Inputs:
- session selected display
- tool explicit display
- current allowed apps
- latest screenshot metadata

Output:
- `displayId`

## 10.2 `prepareForAction`

Responsibilities:
- determine target display
- optionally hide disallowed apps
- register hidden apps in session context
- retain run loop if needed

## 10.3 `cleanupAfterAction`

Responsibilities:
- unhide apps hidden during turn
- release held keys and mouse buttons if needed
- restore clipboard if needed
- unregister hotkey if scoped to the action
- release lock

---

## 11) Approval provider implementation plan

## 11.1 `LocalUiProvider`

### Responsibilities

- launch native approval helper process
- send approval request payload over a local IPC channel
- wait for structured response with timeout
- validate response shape before returning to coordinator

### First implementation

Use a small macOS helper app that:
- displays TCC guidance
- shows app access list
- returns JSON to the MCP server over stdio or a local pipe

## 11.2 `HostCallbackProvider`

### Responsibilities

- ask host client for approval via a callback request
- wait for callback response
- validate response
- fail closed on timeout or malformed input

### Requirement

This must never be the only provider in v1.

## 11.3 `ApprovalCoordinator`

### Selection logic

1. if session mode is `host-callback` and host supports required callback, use host provider
2. if session mode is `hybrid` and host provider supports it, try host provider first
3. on timeout or unsupported host callback, fall back to local UI provider
4. if session mode is `local-ui`, use local provider directly

---

## 12) Transport implementation plan

## 12.1 `stdioTransport.ts`

### Scope

- start MCP server over stdin/stdout
- no extra framing beyond MCP requirements
- log only to stderr
- one client per process

### Deliver first

This is the first transport to implement.

## 12.2 `streamableHttpTransport.ts`

### Scope

- bind to localhost by default
- validate `Origin`
- issue session ID in response headers during initialize
- support POST for messages
- support GET for stream when needed
- make session mapping explicit

### Deliver later

Do this after the core tools work over stdio.

---

## 13) Error handling plan

Implement these error types early:

```ts
export class MissingOsPermissionsError extends Error {}
export class DesktopLockHeldError extends Error {}
export class DisplayResolutionError extends Error {}
export class CoordinateTransformError extends Error {}
export class ClipboardGuardError extends Error {}
export class InputInjectionError extends Error {}
export class ScreenshotCaptureError extends Error {}
export class PermissionDeniedError extends Error {}
export class AppResolutionError extends Error {}
export class NativeTimeoutError extends Error {}
export class ApprovalProviderTimeoutError extends Error {}
export class UnsupportedHostApprovalError extends Error {}
```

Create a single mapper:

```ts
export function toCallToolErrorResult(error: unknown): CallToolResult
```

That mapper should:
- set `isError: true`
- include a compact human-readable `content` item
- include machine-usable `structuredContent.error`

---

## 14) File-by-file build order

## Phase 0 - skeleton

Create these files first:

1. `packages/computer-use-mcp/src/main.ts`
2. `packages/computer-use-mcp/src/config.ts`
3. `packages/computer-use-mcp/src/mcp/server.ts`
4. `packages/computer-use-mcp/src/mcp/transport.ts`
5. `packages/computer-use-mcp/src/mcp/stdioTransport.ts`
6. `packages/computer-use-mcp/src/mcp/sessionIdentity.ts`
7. `packages/computer-use-mcp/src/session/sessionContext.ts`
8. `packages/computer-use-mcp/src/session/sessionStore.ts`
9. `packages/computer-use-mcp/src/session/lock.ts`
10. `packages/computer-use-mcp/src/errors/errorTypes.ts`

### Exit criterion

A client can connect and list placeholder tools.

## Phase 1 - tool registry and request routing

11. `packages/computer-use-mcp/src/mcp/toolRegistry.ts`
12. `packages/computer-use-mcp/src/mcp/callRouter.ts`
13. `packages/computer-use-mcp/src/errors/errorMapper.ts`
14. `packages/computer-use-mcp/src/observability/logger.ts`
15. `packages/computer-use-mcp/src/utils/validation.ts`

### Exit criterion

Tool calls can be routed and produce stubbed structured results.

## Phase 2 - native bridge stubs

16. `packages/computer-use-mcp/src/native/bridgeTypes.ts`
17. `packages/computer-use-mcp/src/native/swiftBridge.ts`
18. `packages/computer-use-mcp/src/native/inputBridge.ts`
19. `packages/computer-use-mcp/src/native/hotkeyBridge.ts`
20. `packages/computer-use-mcp/src/native/runLoopPump.ts`

### Exit criterion

The server boots with stubbed native adapters.

## Phase 3 - approval layer

21. `packages/computer-use-mcp/src/approvals/approvalTypes.ts`
22. `packages/computer-use-mcp/src/approvals/approvalProvider.ts`
23. `packages/computer-use-mcp/src/approvals/localUiProvider.ts`
24. `packages/computer-use-mcp/src/approvals/hostCallbackProvider.ts`
25. `packages/computer-use-mcp/src/approvals/approvalCoordinator.ts`
26. `packages/computer-use-mcp/src/permissions/tcc.ts`
27. `packages/computer-use-mcp/src/permissions/appAllowlist.ts`

### Exit criterion

`request_access` works end to end against a fake local UI provider.

## Phase 4 - screenshot path

28. `packages/computer-use-mcp/src/transforms/screenshotSizing.ts`
29. `packages/computer-use-mcp/src/session/screenshotState.ts`
30. `packages/computer-use-mcp/src/tools/requestAccess.ts`
31. `packages/computer-use-mcp/src/tools/screenshot.ts`
32. `packages/computer-use-mcp/src/tools/zoom.ts`

### Exit criterion

Real screenshots can be captured and persisted in session state.

## Phase 5 - input path

33. `packages/computer-use-mcp/src/transforms/coordinates.ts`
34. `packages/computer-use-mcp/src/session/cleanupRegistry.ts`
35. `packages/computer-use-mcp/src/tools/cursorPosition.ts`
36. `packages/computer-use-mcp/src/tools/mouseMove.ts`
37. `packages/computer-use-mcp/src/tools/click.ts`
38. `packages/computer-use-mcp/src/tools/drag.ts`
39. `packages/computer-use-mcp/src/tools/scroll.ts`
40. `packages/computer-use-mcp/src/tools/key.ts`
41. `packages/computer-use-mcp/src/tools/holdKey.ts`
42. `packages/computer-use-mcp/src/tools/typeText.ts`
43. `packages/computer-use-mcp/src/tools/clipboard.ts`
44. `packages/computer-use-mcp/src/tools/wait.ts`

### Exit criterion

The screenshot-click-type loop works with real macOS permissions.

## Phase 6 - app controls

45. `packages/computer-use-mcp/src/tools/applications.ts`
46. `packages/computer-use-mcp/src/tools/batch.ts`

### Exit criterion

Apps can be granted, opened, and enumerated cleanly.

## Phase 7 - native implementations

47. `packages/native-swift/Sources/ComputerUseSwift/Models.swift`
48. `packages/native-swift/Sources/ComputerUseSwift/DisplayService.swift`
49. `packages/native-swift/Sources/ComputerUseSwift/ScreenshotService.swift`
50. `packages/native-swift/Sources/ComputerUseSwift/AppService.swift`
51. `packages/native-swift/Sources/ComputerUseSwift/TccService.swift`
52. `packages/native-swift/Sources/ComputerUseSwift/HotkeyService.swift`
53. `packages/native-swift/Sources/ComputerUseSwift/RunLoopBridge.swift`
54. `packages/native-input/src/lib.rs`
55. `packages/native-input/src/mouse.rs`
56. `packages/native-input/src/keyboard.rs`
57. `packages/native-input/src/scroll.rs`
58. `packages/native-input/src/frontmost.rs`
59. `packages/native-input/src/errors.rs`

### Exit criterion

All bridge calls have real native implementations.

## Phase 8 - local approval UI helper

60. `packages/approval-ui-macos/Sources/ApprovalUIMacOS/App.swift`
61. `packages/approval-ui-macos/Sources/ApprovalUIMacOS/Models.swift`
62. `packages/approval-ui-macos/Sources/ApprovalUIMacOS/PermissionWindow.swift`
63. `packages/approval-ui-macos/Sources/ApprovalUIMacOS/AppAccessWindow.swift`
64. `packages/approval-ui-macos/Sources/ApprovalUIMacOS/IPCBridge.swift`

### Exit criterion

The server can launch a real local approval flow without host involvement.

## Phase 9 - daemon and HTTP transport

65. `packages/computer-use-mcp/src/mcp/streamableHttpTransport.ts`
66. `packages/computer-use-mcp/src/observability/telemetry.ts`
67. `packages/host-sdk/src/approvalCallbacks.ts`
68. `packages/host-sdk/src/sessionMetadata.ts`
69. `packages/host-sdk/src/index.ts`

### Exit criterion

The server supports long-lived daemon usage and optional host approval callbacks.

---

## 15) Immediate first coding milestone

If starting today, implement only this:

### Files

- `main.ts`
- `server.ts`
- `stdioTransport.ts`
- `toolRegistry.ts`
- `callRouter.ts`
- `sessionContext.ts`
- `sessionStore.ts`
- `lock.ts`
- `approvalProvider.ts`
- `approvalCoordinator.ts`
- `requestAccess.ts`
- `screenshot.ts`
- `cursorPosition.ts`
- `click.ts`
- `typeText.ts`
- `applications.ts`
- `bridgeTypes.ts`
- `swiftBridge.ts`
- `inputBridge.ts`

### Tools to expose initially

- `request_access`
- `screenshot`
- `cursor_position`
- `left_click`
- `type`
- `open_application`

### Exit criterion

You can connect from one MCP client over stdio and complete this loop:
- request permission
- open TextEdit or Notes
- capture screenshot
- click into the document
- type text

---

## 16) Testing plan

## 16.1 Unit tests

Write first:

- `coordinates.test.ts`
- `screenshotSizing.test.ts`
- `lock.test.ts`
- `approvalCoordinator.test.ts`
- `sessionStore.test.ts`
- `errorMapper.test.ts`

## 16.2 Integration tests

Write next:

- `stdio.e2e.test.ts`
- `requestAccess.e2e.test.ts`
- `screenshot.e2e.test.ts`
- `click.e2e.test.ts`
- `typeText.e2e.test.ts`
- `openApplication.e2e.test.ts`

## 16.3 Manual verification sequence

1. start server in stdio mode
2. connect one MCP client
3. call `request_access`
4. grant TCC permissions
5. call `open_application` for TextEdit
6. call `screenshot`
7. choose coordinates manually from screenshot
8. call `left_click`
9. call `type`
10. verify clipboard restoration
11. verify lock release after completion

---

## 17) Packaging notes

## 17.1 Packaging target

Support two packaging modes:

1. CLI binary entry for stdio launch by MCP clients
2. optional background daemon entry for Streamable HTTP

## 17.2 Native packaging

Keep native modules versioned with the server package.

Do not make the server depend on a globally installed helper binary for v1.

## 17.3 Logging policy

- stdio mode: all logs go to stderr only
- daemon mode: logs go to file and optionally stderr in foreground mode

---

## 18) Open implementation choices to settle before coding too far

1. Whether to use pure Swift for input instead of Rust
2. Whether screenshots should default to JPEG or PNG
3. Whether `type` defaults to clipboard mode or direct mode
4. Whether `request_access` should auto-open the System Settings page or only offer guidance
5. Whether `open_application` should auto-request access when the app is not already granted
6. Whether daemon mode is in the first public release or a second release

---

## 19) Recommended next artifact after this plan

Create a third canvas document containing:

- exact TypeScript file skeletons
- starter code for `server.ts`, `stdioTransport.ts`, and `toolRegistry.ts`
- initial JSON schemas as copy-paste constants
- the first end-to-end test harness

That document should be implementation-ready, not architectural.
