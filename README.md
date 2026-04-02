# macOS Computer Use MCP Server

Standalone local `computer-use` MCP server for macOS.

The current capture flow is optimized for MCP clients that can consume inline image attachments. Saved local image paths remain available through `capture_metadata` when a client wants file-based follow-up such as `view_image(imagePath)`.

This repository implements:

- standalone MCP server
- stdio transport first
- session-owned state
- desktop lock
- permission and app approval coordination
- macOS native helper seam for screenshots, TCC, input, apps, and clipboard
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
  - `select_display`
  - `switch_display`
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
  - `open_application`
  - `list_granted_applications`
  - `wait`
  - `computer_batch`
- file-backed desktop lock
- session store
- fake native mode
- unit tests and transport end-to-end tests using Node's built-in test runner

### Implemented for macOS, not compiled here

- Swift native bridge executable:
  - ScreenCaptureKit screenshots
  - TCC checks and System Settings deep links
  - NSWorkspace app operations
  - CGEvent-based mouse and keyboard injection
  - NSPasteboard clipboard access
  - running app and window/display inspection

### Included but not wired as the default runtime yet

- approval UI bridge package
- host SDK stubs
- Rust placeholder package reserved for a future input-port if we move off the pure Swift path

## Important note

The TypeScript server has a runnable fake mode for development and testing.

The real macOS path requires building the native Swift helper on a Mac before starting the MCP server in real mode.

## Architecture

```text
agent / MCP client
  -> stdio MCP server (TypeScript)
    -> tool registry + session store + approval coordinator + desktop lock
      -> native bridge client
        -> ComputerUseBridge (Swift executable)
          -> ScreenCaptureKit / NSWorkspace / CoreGraphics / ApplicationServices
```

## Current design choices

- pure Swift was chosen for the first native bridge pass to reduce cross-language complexity
- the Node server keeps the MCP surface thin
- the helper executable owns AppKit / ScreenCaptureKit / CoreGraphics interactions
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

## Repo map

- `docs/` — spec, implementation plan, starter canvas, and Claude Code notes
- `packages/computer-use-mcp/` — TypeScript server
- `packages/native-swift/` — real macOS bridge executable
- `packages/approval-ui-macos/` — local approval helper executable
- `packages/host-sdk/` — host callback contract stubs
- `packages/native-input/` — reserved for a future Rust input port
