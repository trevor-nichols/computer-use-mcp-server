# macOS Computer Use MCP Server

Standalone local `computer-use` MCP server for macOS.

The current capture flow is optimized for MCP clients that can consume inline image attachments. Saved local image paths remain available through `capture_metadata` when a client wants file-based follow-up such as `view_image(imagePath)`.

This repository implements:

- standalone MCP server
- stdio transport first
- session-owned state
- desktop lock
- permission and app approval coordination
- native host seam with Swift bridge services and a selectable input backend (`swift`, `rust`, `fake`)
- fake mode for development and testing on non-macOS hosts

## Capture contract

`screenshot` and `zoom` now do two things directly:

- attach the captured image inline in the MCP `content` array
- return a text item containing `captureId=...`

Geometry and saved-file metadata are retrieved separately through `capture_metadata`.

The intended consumer flow is:

1. call `screenshot` or `zoom`
2. inspect the inline MCP image attachment
3. if geometry or file metadata is needed, call `capture_metadata(captureId)`

For clients that prefer file-based image viewing, the fallback flow is:

1. call `screenshot` or `zoom`
2. extract the `captureId` from the text item
3. call `capture_metadata(captureId)`
4. read `structuredContent.imagePath`
5. call `view_image(imagePath)` if needed

The server does not expose capture delivery through MCP `resources/read`. Screenshot image data is delivered as an MCP `image` content item, not as plain base64 text in `structuredContent`.

## What is included

### Runnable in this environment

- TypeScript MCP server
- protocol-compatible stdio JSON-RPC transport
- Streamable HTTP transport
- full current tool surface:
  - `request_access`
  - `screenshot`
  - `list_displays`
  - `select_display`
  - `zoom`
  - `capture_metadata`
  - `cursor_position`
  - `mouse_move`
  - `left_click`
  - `right_click`
  - `middle_click`
  - `double_click`
  - `triple_click`
  - `left_click_drag`
  - `scroll`
  - `key`
  - `hold_key`
  - `type`
  - `read_clipboard`
  - `write_clipboard`
  - `search_applications`
  - `open_application`
  - `list_granted_applications`
  - `wait`
  - `computer_batch`
- file-backed desktop lock
- session store
- fake native mode
- unit tests and transport end-to-end tests using Node's built-in test runner

### Native backends on macOS

- Swift native bridge executable (`ComputerUseBridge`) for:
  - ScreenCaptureKit screenshots
  - TCC checks and System Settings deep links
  - NSWorkspace app operations
  - CGEvent-based mouse and keyboard injection (legacy fallback input path)
  - NSPasteboard clipboard access
  - running app and window/display inspection

- Rust input backend package (`@agenai/native-input`) for:
  - optional desktop input routing via `COMPUTER_USE_INPUT_BACKEND=rust`
  - mouse, key, type, and scroll injection through a local N-API addon

### Supporting packages

- approval UI bridge package (`ApprovalUIBridge`) for local request prompts
- host SDK stubs

## Important note

The TypeScript server has a runnable fake mode for development and testing.

The real macOS path requires:

- the Swift bridge (`ComputerUseBridge`) for screenshots/apps/TCC/clipboard/hotkeys
- the approval helper (`ApprovalUIBridge`) for local `request_access` prompts
- optionally, the Rust input addon when selecting `COMPUTER_USE_INPUT_BACKEND=rust`

## Architecture

```text
agent / MCP client
  -> stdio MCP server (TypeScript)
    -> tool registry + session store + approval coordinator + desktop lock + native host selector
      -> Swift bridge client (screenshots/apps/TCC/clipboard/hotkeys)
      -> input backend (swift|rust|fake)
        -> ComputerUseBridge (Swift executable) OR @agenai/native-input (Rust addon)
```

## Current design choices

- Swift remains the default integrated native bridge path for broad macOS surface area
- Rust input is available as an additive backend choice for input-focused iteration
- the Node server keeps the MCP surface thin
- Swift helper executable owns AppKit / ScreenCaptureKit / CoreGraphics interactions outside input-addon overrides
- the Node process does not need a Cocoa run-loop pump because native work happens in the helper process

## Build

### TypeScript server

```bash
npm run build
npm test
```

### Swift native bridge on macOS

```bash
swift build --package-path packages/native-swift -c release
swift build --package-path packages/approval-ui-macos -c release
```

### Optional Rust input backend on macOS

```bash
npm --prefix packages/native-input run build
npm --prefix packages/native-input test
```

### Run fake mode

```bash
COMPUTER_USE_FAKE=1 node dist/computer-use-mcp/src/main.js
```

### Run real mode on macOS after building the helper

```bash
node dist/computer-use-mcp/src/main.js
```

Optional environment variables:

- `COMPUTER_USE_FAKE=1`
- `COMPUTER_USE_LOCK_PATH=/custom/path/desktop.lock`
- `COMPUTER_USE_CAPTURE_ASSET_ROOT=/custom/path/captures`
- `COMPUTER_USE_SWIFT_BRIDGE_PATH=/absolute/path/to/ComputerUseBridge`
- `COMPUTER_USE_APPROVAL_UI_PATH=/absolute/path/to/ApprovalUIBridge`
- `COMPUTER_USE_INPUT_BACKEND=swift|rust|fake`
- `COMPUTER_USE_RUST_INPUT_PATH=/absolute/path/to/native-input.node`

## Repo map

- `docs/` — historical planning/spec documents plus current capture contract note
- `packages/computer-use-mcp/` — TypeScript server
- `packages/native-swift/` — real macOS bridge executable
- `packages/approval-ui-macos/` — local approval helper executable
- `packages/host-sdk/` — host callback contract stubs
- `packages/native-input/` — Rust N-API input backend package
