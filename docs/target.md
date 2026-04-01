This target is for a **production-grade standalone computer-use MCP server**, not Claude-wire parity.

The current codebase already has:

- direct `tools/call` execution
- a working Swift-native input bridge
- `select_display` and `switch_display`
- display pinning and app-aware auto-targeting
- frontmost / under-cursor fail-closed safety gates for granted sessions
- `CGEventTap`-based Escape abort with a fallback monitor
- zoom-to-action coordinate persistence with regression coverage for nested zoom, click, and drag flows

Those are **not** the remaining gaps.

What still needs attention for standalone production is below.

## Remaining priorities

## 1. Add host/self-awareness to capture and hide flows

The server tracks host/client metadata, but it does not yet model a host application identity inside the desktop-safety layer.

What to add:

- a runtime concept of host bundle identity
- host exemption from hide/unhide flows
- host exclusion from screenshot capture where supported
- host-aware activation behavior so the host does not accidentally become the click target

Where:

- a new runtime/helper layer, for example:
  - `packages/computer-use-mcp/src/runtime/hostIdentity.ts`
- wire into:
  - `packages/computer-use-mcp/src/tools/actionScope.ts`
  - `packages/computer-use-mcp/src/tools/captureScope.ts`
  - `packages/computer-use-mcp/src/tools/captureWithFallback.ts`
  - screenshot capture options / native bridge plumbing

Why:

- a standalone server still needs to avoid hiding or photographing its own host unnecessarily
- without this, terminal-hosted and embedded-host usage can behave unpredictably

## 2. Broaden native key support as a focused follow-up

The Swift input bridge exists and covers the core path, but its key map is still relatively narrow.

What to add:

- function keys
- page up/down
- home/end
- more navigation and symbol keys
- verify modifier-only key down/up behavior stays explicit and testable

Where:

- `packages/native-swift/Sources/ComputerUseBridge/InputService.swift`
- `packages/computer-use-mcp/src/native/bridgeTypes.ts` if bridge types need extension
- targeted tests for key behavior

Why:

- this is a real capability gap, but it is secondary to the safety and coordinate issues above
- the priority is better input coverage, not splitting input into a separate package
