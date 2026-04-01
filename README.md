# macOS Computer Use MCP Server

Standalone local `computer-use` MCP server for macOS.

This repository implements the first real slice of the clean-room design we documented:

- standalone MCP server, not embedded in one host
- stdio transport first
- session-owned state
- desktop lock
- permission and app approval coordination
- real macOS native helper seam for screenshots, TCC, input, apps, and clipboard
- fake mode for development and testing on non-macOS hosts

## What is included

### Runnable in this environment

- TypeScript MCP server
- protocol-compatible stdio JSON-RPC transport
- first six tools:
  - `request_access`
  - `screenshot`
  - `cursor_position`
  - `left_click`
  - `type`
  - `open_application`
- file-backed desktop lock
- session store
- fake native mode
- unit tests and stdio end-to-end test using Node's built-in test runner

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
- `COMPUTER_USE_SWIFT_BRIDGE_PATH=/absolute/path/to/ComputerUseBridge`
- `COMPUTER_USE_APPROVAL_UI_PATH=/absolute/path/to/ApprovalUIBridge`

## Repo map

- `docs/` — spec, implementation plan, starter canvas, and Claude Code notes
- `packages/computer-use-mcp/` — TypeScript server
- `packages/native-swift/` — real macOS bridge executable
- `packages/approval-ui-macos/` — local approval helper executable
- `packages/host-sdk/` — host callback contract stubs
- `packages/native-input/` — reserved for a future Rust input port

## Status summary

What is production-shaped:

- repo structure
- first transport
- first tool contracts
- session model
- lock model
- native bridge seam
- real macOS helper commands for the first slice

What still needs more work after this pass:

- full approval helper integration by default
- global Escape abort loop wired end-to-end
- hide-before-action and cleanup registry
- drag / scroll / zoom / key / hold-key / batch tools
- daemon + Streamable HTTP
