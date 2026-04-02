# macOS Computer Use Reimplementation Spec

## Status Note

This is a historical reimplementation spec from the earlier multi-client planning phase.

The current repo implementation has diverged in a few important ways:

- the live file layout is documented in `SNAPSHOT.md`
- the current capture delivery contract is documented in `docs/capture-asset-reference-execution-plan.md`
- `screenshot` and `zoom` now attach inline images, while `capture_metadata` returns the saved file path and geometry metadata for a prior `captureId`

Use this document for design rationale and original goals, not as the exact source of truth for the current file tree or capture payload shape.

## 1) Purpose

Build a clean-room, behavior-compatible macOS computer control system inspired by the architecture observed in Claude Code.

This spec is for a standalone local MCP server that:

- exposes a `computer-use` MCP server usable from any compatible agent app
- captures screenshots of the desktop or a selected display
- injects mouse and keyboard input at the OS level
- opens and manages applications
- requests and tracks user permissions for each session
- supports app allowlists, display targeting, screenshot geometry tracking, and safety controls

This is **not** a code clone spec. It is a reimplementation blueprint based on architecture and behavior, not source reuse.

## 2) Goals

### Primary goals

- macOS-only first release
- local execution only
- standalone local MCP server, not embedded in any one agent app
- reusable from Claude Code, Codex, desktop agents, and other MCP-compatible clients
- reliable screenshot + click + type loop
- strong permission and safety model
- enough state management to support accurate coordinate scaling and display targeting
- production-ready cleanup behavior when tool calls fail or are interrupted

### Non-goals for v1

- Windows or Linux support
- browser-specific automation
- OCR, semantic UI parsing, or model-side grounding beyond screenshots
- cloud-hosted computer execution
- pixel-perfect parity with Anthropic's internal implementation

## 3) Target system model

The target architecture is best modeled as five layers:

1. **MCP transport and server layer**
   - Registers tools under a built-in `computer-use` server.
   - Handles `listTools` and `callTool`.
   - Runs as a standalone local process.
   - Accepts connections from one or more MCP-compatible clients.

2. **Session binder layer**
   - Maintains per-client-session state.
   - Applies permission checks.
   - Tracks screenshot geometry.
   - Owns app allowlists and grant flags.
   - Serializes execution through a desktop-control lock.

3. **Native execution layer**
   - Screenshot capture
   - Display enumeration
   - App enumeration / activation / hide / unhide
   - Accessibility and screen recording checks
   - Mouse and keyboard injection
   - Global abort hook

4. **Approval and user interaction layer**
   - Prompts for macOS permissions
   - Prompts for app access
   - Surfaces tool activity and failures
   - Lets the user retry after granting macOS permissions
   - Can be server-owned, host-mediated, or hybrid

5. **Optional host integration layer**
   - Lets specific agent clients render custom approval UI
   - Lets hosts pass richer session identity or branding
   - Is optional, not required for compatibility

## 4) High-level architecture

```text
LLM / agent app
  -> MCP client
    -> standalone local `computer-use` MCP server
      -> session binder
        -> approval coordinator
        -> host adapter
          -> native screenshot module
          -> native app/workspace module
          -> native input module
          -> permission / hotkey module
```

### Recommended implementation split

- **TypeScript / Node** for the standalone MCP server, session state, orchestration, approvals, lock management, telemetry, and tool wrappers
- **Swift** for ScreenCaptureKit, NSWorkspace, TCC checks, display and window queries, and Escape hotkey registration
- **Rust** or **Swift** for low-level input injection

### Recommended repository structure

```text
packages/
  computer-use-mcp/
    src/
      mcp/
        server.ts
        toolRegistry.ts
        callRouter.ts
        transport.ts
        sessionIdentity.ts
      session/
        sessionContext.ts
        sessionStore.ts
        lock.ts
        screenshotState.ts
        approvalState.ts
      tools/
        requestAccess.ts
        screenshot.ts
        zoom.ts
        click.ts
        drag.ts
        type.ts
        key.ts
        holdKey.ts
        scroll.ts
        clipboard.ts
        applications.ts
        wait.ts
        batch.ts
      approvals/
        approvalCoordinator.ts
        approvalProvider.ts
        localUiProvider.ts
        hostCallbackProvider.ts
      host/
        hostAdapter.ts
        capabilities.ts
      native/
        swiftBridge.ts
        inputBridge.ts
        runLoopPump.ts
        hotkey.ts
      permissions/
        tcc.ts
        appAllowlist.ts
      utils/
        coords.ts
        imageSizing.ts
        errors.ts
        cleanup.ts
        logging.ts
      main.ts
  approval-ui-macos/
    Sources/
      ApprovalUIMacOS/
        App.swift
        PermissionWindow.swift
        AppAccessWindow.swift
  native-swift/
    Sources/
      ComputerUseSwift/
        ScreenshotService.swift
        DisplayService.swift
        AppService.swift
        TccService.swift
        HotkeyService.swift
        RunLoopBridge.swift
  native-input/
    src/
      lib.rs
      mouse.rs
      keyboard.rs
      frontmost.rs
  host-sdk/
    src/
      approvalCallbacks.ts
      sessionMetadata.ts
```

## 5) Core design choices

### 5.1 Standalone local MCP server

The MCP server should run as its own local process, separate from any one terminal agent app.

Why:

- reusable across Claude Code, Codex, desktop agents, and other MCP-compatible clients
- avoids coupling lifecycle and crash boundaries to one host app
- lets multiple agent apps share the same implementation surface
- keeps the native macOS bridge centralized in one local service
- makes packaging and versioning easier as a standalone capability

Implications:

- session identity must come from the MCP client connection or an explicit session token
- approval state and screenshot state live in the MCP server, not in the host agent app
- transport must support multiple clients, but only one active desktop-control session should own the lock at a time
- permission prompts may need to be rendered by the MCP server itself, via a small local UI helper, or via host-mediated approval callbacks

### 5.2 Session-aware tool binding

Tool execution cannot be stateless.

A session binder is required so tool calls can read and update:

- granted apps
- granted flags
- selected display
- whether display was model-pinned
- last screenshot dimensions
- apps hidden during the current turn
- lock ownership
- pending approval state
- per-session abort hook state

### 5.3 Native screenshots, not browser screenshots

Screenshots should come from macOS APIs that can capture real desktop content and target specific displays or windows.

### 5.4 OS-level input, not DOM automation

Mouse and keyboard injection must operate at the macOS event level so the system can control Finder, System Settings, native apps, Electron apps, and browsers equally.

### 5.5 Server-owned source of truth

The standalone MCP server should be the source of truth for desktop-control state.

That includes:

- session state
- screenshot geometry
- lock ownership
- approval decisions
- active hidden apps
- cleanup obligations

Host apps may cache or mirror this state, but should not be authoritative.

### 5.6 Pluggable approval model

The approval layer should support three modes:

1. **Local UI provider**
   - the MCP server launches a small native approval UI
2. **Host callback provider**
   - the MCP server asks the connected host app to render approval UI
3. **Hybrid**
   - prefer host callbacks when supported, fall back to local UI otherwise

Default recommendation for v1:
- hybrid support in design
- local UI provider as the default implementation

## 6) Transport and session model

### 6.1 Supported transports

Design the MCP server so transport is abstracted behind a small interface.

Recommended priorities:

1. stdio for local agent compatibility
2. local socket transport for long-lived daemon mode
3. optional HTTP or WebSocket transport only if there is a concrete need later

The server should not hard-code tool behavior to one transport.

### 6.2 Session identity

Each MCP client connection needs a stable session identity.

Recommended session identity fields:

- `sessionId`
- `clientId`
- `clientName`
- `connectionId`
- `startedAt`
- optional host metadata

Session identity can come from:

- connection-scoped server-generated IDs
- explicit client-supplied metadata
- a host SDK that negotiates richer identity

### 6.3 Multi-client rules

Multiple clients may connect simultaneously.

Required rules:

- read-only operations may be allowed concurrently where safe
- only one session may own the desktop-control lock at a time
- mutation tools must either acquire the lock or fail with a clear lock error
- approval state is per session unless explicitly elevated to a durable trust model later
- screenshot geometry is per session

### 6.4 Server lifecycle modes

Recommended support:

- one-shot stdio mode
- long-lived daemon mode

In daemon mode, stale sessions must be cleaned up automatically.

## 7) Tool surface

### Required tools for v1

#### `request_access`

Purpose:
- Ask the user to grant app access and capability flags for the session.

Input:
- requested apps
- requested flags
  - `clipboardRead`
  - `clipboardWrite`
  - `systemKeyCombos`

Output:
- granted apps
- denied apps
- effective flags
- missing macOS permissions if relevant

Notes:
- If Accessibility or Screen Recording is missing, show a TCC dialog instead of app approval.
- This tool should check lock state but should not necessarily acquire the desktop-control lock if the model is only requesting permission.

#### `screenshot`

Purpose:
- Capture the current display, excluding disallowed apps where possible.

Input:
- `displayId?`
- effective allowed app bundle IDs

Output:
- image base64 or binary handle
- width
- height
- display metadata
- logical and physical geometry metadata

Requirements:
- pre-size output to the coordinate system expected by the model path
- persist screenshot dimensions for later coordinate transforms
- support host-app exclusion from capture where possible

#### `zoom`

Purpose:
- Capture a cropped logical region from the screen.

Input:
- `x`, `y`, `w`, `h`
- `displayId?`
- allowed bundle IDs

Output:
- image base64
- width
- height

#### `left_click`, `right_click`, `middle_click`
#### `double_click`, `triple_click`

Purpose:
- Move to coordinates and click.

Input:
- `x`, `y`
- optional modifiers
- button and click count are encoded by tool name

Requirements:
- move first, then click
- small settle delay before click
- support modifier bracketing and cleanup

#### `mouse_move`

Purpose:
- Move the cursor to a position.

Input:
- `x`, `y`

#### `left_click_drag`

Purpose:
- Drag from current cursor or explicit start point to end point.

Input:
- `from?`
- `to`

Requirements:
- press button
- wait briefly for state to settle
- animate target move if enabled
- always release the button in `finally`

#### `scroll`

Purpose:
- Scroll relative to the point under the cursor.

Input:
- `x`, `y`, `dx`, `dy`

Requirements:
- move first
- vertical scroll first
- horizontal second

#### `type`

Purpose:
- Enter text.

Input:
- `text`
- `viaClipboard?: boolean`

Requirements:
- support clipboard-backed paste mode for reliability
- save and restore clipboard in `finally`
- verify clipboard round-trip before issuing paste

#### `key`

Purpose:
- Send a key sequence such as `command+a` or `escape`.

Input:
- `sequence`
- `repeat?`

#### `hold_key`

Purpose:
- Hold keys for a duration.

Input:
- `keys[]`
- `durationMs`

Requirements:
- track which keys were actually pressed
- release only those keys
- survive timeout or cancellation without leaving stuck modifiers

#### `read_clipboard`
#### `write_clipboard`

Purpose:
- Clipboard access, gated by session flags.

#### `open_application`

Purpose:
- Launch or activate an app by bundle ID.

Input:
- `bundleId`

#### `list_granted_applications`

Purpose:
- Return current session allowlist.

#### `cursor_position`

Purpose:
- Return current cursor location.

#### `wait`

Purpose:
- Sleep for a bounded duration.

#### `computer_batch`

Purpose:
- Execute a small sequence of low-risk actions atomically within one lock scope.

Use later if needed. Not required for the first milestone.

## 8) Session state model

```ts
interface GrantFlags {
  clipboardRead: boolean
  clipboardWrite: boolean
  systemKeyCombos: boolean
}

interface AllowedApp {
  bundleId: string
  displayName: string
  path?: string
}

interface ScreenshotDims {
  width: number
  height: number
  displayId: number
  originX: number
  originY: number
  logicalWidth?: number
  logicalHeight?: number
  scaleFactor?: number
}

interface ComputerUseSessionState {
  sessionId: string
  clientId?: string
  clientName?: string
  allowedApps: AllowedApp[]
  grantFlags: GrantFlags
  selectedDisplayId?: number
  displayPinnedByModel: boolean
  displayResolvedForAppsKey?: string
  lastScreenshotDims?: ScreenshotDims
  hiddenDuringTurn: Set<string>
  tccState?: {
    accessibility: boolean
    screenRecording: boolean
  }
  approvalMode?: 'local-ui' | 'host-callback' | 'hybrid'
  hostApprovalCapabilities?: {
    appApproval: boolean
    tccPromptRelay: boolean
  }
}
```

### Required invariants

- `lastScreenshotDims` must correspond to the latest screenshot visible to the model for that session.
- Every click or drag that relies on screenshot coordinates must transform from screenshot space back into real display coordinates.
- `hiddenDuringTurn` must be cleared at end of turn after unhide completes.
- Lock ownership must be scoped to the session, not just the process.
- Approval state must never leak between unrelated sessions.

## 9) Lock model

Only one active computer-control session may own the desktop at a time.

### Required behavior

- lock file stored in app config directory
- lock record contains `sessionId`, `pid`, `connectionId`, and `acquiredAt`
- atomic acquire via exclusive create
- stale lock recovery if PID is dead
- re-entrant acquire for the same session
- release on normal turn end and on process cleanup

### Why it matters

Without this, two agent sessions can fight for the same cursor, app focus, and desktop state.

## 10) Approval model

Because this is a standalone MCP server, approvals cannot assume a single embedded host UI.

### 10.1 Local UI provider

The server launches a small native macOS approval UI.

Use cases:
- generic MCP client with no custom approval callback support
- daemon mode
- one-shot local usage

Responsibilities:
- prompt for Accessibility and Screen Recording guidance
- prompt for requested app allowlist
- prompt for grant flags
- return a structured approval result to the server

### 10.2 Host callback provider

The server asks the host client to render approval UI and waits for a structured response.

Use cases:
- custom agent apps that want a branded integrated UX
- power users who want approvals inside their host app

Requirements:
- callback contract must have timeouts
- host responses must be validated server-side
- server remains the source of truth

### 10.3 Hybrid mode

The server prefers host callbacks when supported and falls back to local UI when unavailable, unsupported, or timed out.

### 10.4 Default recommendation

For v1:
- implement local UI provider first
- keep the approval coordinator abstract so host callbacks can be added later

## 11) Native macOS responsibilities

### 11.1 Screenshot service

Recommended API choice:
- ScreenCaptureKit

Responsibilities:
- list displays
- get display size and scale factor
- capture full display screenshot
- capture region screenshot
- exclude or filter content where supported
- return JPEG or PNG bytes and dimensions

Implementation notes:
- use logical-to-physical conversion before output sizing
- support explicit display targeting
- support target image size selection that keeps coordinate transforms stable
- exclude host app when feasible

### 11.2 App service

Recommended API choice:
- NSWorkspace plus window/display inspection support

Responsibilities:
- list installed apps
- list running apps
- open app by bundle ID
- get app icon by path if needed
- hide / unhide apps during a turn
- compute preview hide set
- find displays containing app windows
- optionally resolve app under cursor

### 11.3 TCC and permissions service

Responsibilities:
- check Accessibility permission
- check Screen Recording permission
- optionally trigger retry checks after user returns from System Settings
- expose enough detail for the approval dialog

### 11.4 Hotkey service

Responsibilities:
- register global Escape abort callback
- temporarily allow model-synthesized Escape events to pass without triggering abort
- unregister cleanly

### 11.5 Input service

Recommended implementation:
- Rust N-API module with mouse and keyboard injection
- or a pure Swift input module if that produces lower complexity

Responsibilities:
- move mouse
- click mouse buttons
- press/release mouse buttons
- drag
- scroll vertical and horizontal
- type text
- press key sequences
- press/release individual keys
- return cursor position
- return frontmost app info

## 12) Run loop model

This is a critical implementation detail.

If native screenshot or keyboard functions dispatch work onto the macOS main queue, a plain Node server process may not naturally pump the Cocoa or Core Foundation main run loop.

### Required strategy

- create a shared run-loop pump in the server process
- retain the pump while any native call that requires the main queue is in flight
- release the pump when no dependent calls remain
- use a timeout to fail hung native calls
- keep a non-time-limited retain for long-lived registrations like the global Escape tap

### Why it matters

Without this, async native calls that rely on `DispatchQueue.main` or a run-loop source can hang indefinitely in a terminal-hosted or daemon-hosted Node process.

## 13) Coordinate model

This is another critical subsystem.

### Required coordinate pipeline

1. Determine display logical size and scale factor.
2. Convert logical dimensions to physical dimensions.
3. Resize screenshot output to a model-facing target size.
4. Store the final screenshot dimensions and source display metadata in the session.
5. When the model returns coordinates, map from screenshot space back to display space.

### Required metadata

For each screenshot, persist:
- output width and height
- display ID
- display origin
- display logical size
- display scale factor

### Failure mode to avoid

If screenshot output is resized but click coordinates are applied in a different coordinate space, the tool becomes unreliable.

## 14) Pre-action sequence

Before click, drag, or screenshot actions, run a preparation phase.

### Inputs
- allowed bundle IDs
- preferred display ID
- auto-target-display flag
- hide-before-action flag
- session approval mode

### Responsibilities
- resolve or confirm target display
- optionally hide disallowed apps
- avoid activating or hiding the user's primary host app when not intended
- keep track of apps hidden during the turn

### Notes

This prep step is a large part of what makes the system feel stable.

## 15) Safety model

### 15.1 macOS permissions

The system requires:
- Accessibility for input control and event tap behavior
- Screen Recording for desktop screenshots

If either is missing:
- do not proceed to app allowlist approval
- show a dedicated permissions dialog
- offer to open the correct System Settings pages
- allow retry without restarting the whole server if possible

### 15.2 App allowlist

The user should approve which apps the model may control during the session.

Required fields:
- bundle ID
- display name
- optional icon or path

Grant flags should be presented alongside app approvals:
- clipboard read
- clipboard write
- system key combinations

### 15.3 Escape abort

A global Escape hook should abort the current computer-use action.

Required behavior:
- while active, Escape is intercepted system-wide
- model-generated Escape should be temporarily marked as expected so it does not abort the run
- cleanup must always unregister the hook

### 15.4 Cleanup guarantees

On cancellation, error, or timeout:
- release pressed modifiers
- release pressed mouse buttons
- restore clipboard if it was overwritten for paste typing
- unhide apps hidden during the turn
- release the desktop lock if the session owns it
- unregister the Escape hook if it was registered by this session

## 16) Error model

Define explicit error classes:

- `MissingOsPermissionsError`
- `DesktopLockHeldError`
- `DisplayResolutionError`
- `CoordinateTransformError`
- `ClipboardGuardError`
- `InputInjectionError`
- `ScreenshotCaptureError`
- `PermissionDeniedError`
- `AppResolutionError`
- `NativeTimeoutError`
- `ApprovalProviderTimeoutError`
- `UnsupportedHostApprovalError`

Every tool should return:
- a user-readable message
- machine-readable error kind
- optional retryability hint

## 17) Implementation milestones

### Milestone 0 - foundation

Deliver:
- standalone MCP server shell
- transport abstraction
- session store
- desktop lock
- native module stubs
- approval coordinator interface

Exit criteria:
- tools register and return placeholder outputs
- clients can connect through the chosen first transport

### Milestone 1 - screenshot slice

Deliver:
- display enumeration
- display size lookup
- screenshot capture
- screenshot geometry persistence
- `request_access` for TCC only
- local approval UI shell

Exit criteria:
- user can grant Screen Recording
- `screenshot` returns a desktop image and metadata

### Milestone 2 - input slice

Deliver:
- mouse move
- click
- cursor position
- key sequence
- type via clipboard
- Accessibility permission checks

Exit criteria:
- user can open an app manually, take a screenshot, and click or type with reliable coordinates

### Milestone 3 - app management and safety

Deliver:
- installed app enumeration
- running app enumeration
- open application
- app allowlist approval
- per-turn cleanup
- Escape abort
- clipboard restore
- modifier cleanup

Exit criteria:
- full local session with permission prompt, app approval, screenshot, click, and type

### Milestone 4 - daemon and host integration

Deliver:
- long-lived daemon mode
- stale session cleanup
- host callback approval provider contract
- hybrid approval fallback

Exit criteria:
- server supports both generic clients and richer host integrations

### Milestone 5 - quality layer

Deliver:
- drag with animation
- zoom
- scroll
- auto-target display
- hide-before-action
- preview hide set
- app-under-point

Exit criteria:
- system feels stable across multiple monitors and mixed app types

### Milestone 6 - polish and batch operations

Deliver:
- `computer_batch`
- telemetry
- retries and better diagnostics
- integration tests and failure injection

## 18) Suggested testing strategy

### Unit tests

- coordinate transforms
- lock acquisition and stale recovery
- clipboard save/restore logic
- screenshot metadata persistence
- grant flag merging
- approval provider fallback logic
- session identity derivation

### Integration tests

- screenshot on one monitor
- screenshot on multiple monitors
- click after screenshot coordinate transform
- type via clipboard with restore
- key hold and release after timeout
- lock contention between two sessions
- missing permission flows
- local approval UI flow
- host callback approval flow

### Manual test matrix

- Finder
- System Settings
- Safari or Chrome
- Electron app
- native menu bar app
- multiple Retina displays
- one-shot stdio client
- long-lived daemon client

## 19) Open design decisions

1. **Input module language**
   - Rust offers reuse and strong isolation.
   - Swift reduces cross-language boundaries on macOS.

2. **Screenshot format**
   - JPEG is smaller and may match the observed behavior.
   - PNG is easier for debugging.

3. **App-under-point implementation**
   - Could use Accessibility hit testing, window server queries, or a hybrid.

4. **Pixel validation**
   - Optional for v1.
   - Can be added later once base reliability is good.

5. **Clipboard typing fallback**
   - Need a non-clipboard typing path for cases where clipboard access is denied.

6. **Default transport**
   - stdio is simplest for compatibility.
   - daemon plus local socket may be better for a long-lived system service.

7. **Approval delivery**
   - whether to ship local UI first only, or local UI plus a host SDK in the first public version

## 20) First thin slice to build now

Implement this exact vertical slice first:

1. standalone MCP server boot and session identification
2. first transport implementation
3. `request_access` for TCC only
4. local approval UI shell
5. `screenshot`
6. `cursor_position`
7. `left_click`
8. `type` with clipboard mode
9. `open_application`

That slice gives a usable end-to-end loop:

- user connects any MCP-compatible agent
- user grants macOS permissions
- app opens a target application
- model sees screenshot
- model clicks by screenshot coordinates
- model types into the focused UI

## 21) What likely makes the original feel good

This is the behavior to copy, not the internal code:

- screenshot output is sized to keep coordinate transforms coherent
- the host app is excluded from capture when feasible and not treated as the target app
- input actions have small settle delays
- drag motion is animated instead of teleported
- clipboard paste is round-trip verified before issuing paste
- modifiers are always released in cleanup
- a single desktop lock prevents session conflicts
- the global Escape hook gives the user a hard stop
- app hiding and display targeting reduce accidental clicks
- the approval flow does not depend on one specific host app

## 22) Recommended next document

After this spec, create a second document with:

- exact MCP tool schemas
- TypeScript interfaces
- native bridge function signatures
- approval provider contract
- transport adapter interface
- a milestone-by-milestone file creation checklist

That should be the direct implementation plan.
