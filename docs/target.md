This target is for a **production-grade standalone computer-use MCP server**, not Claude-wire parity.

The current codebase already has:

- direct `tools/call` execution
- a working Swift-native input bridge
- `select_display` and `switch_display`
- display pinning and app-aware auto-targeting
- frontmost / under-cursor fail-closed safety gates for granted sessions
- session-scoped host identity for explicit hosts and stdio parent-app inference
- host exclusion from screenshot capture where supported
- host exemption from hide / fallback-hide flows
- host-aware fail-closed safety messaging when the host becomes the accidental target
- `CGEventTap`-based Escape abort with a fallback monitor
- zoom-to-action coordinate persistence with regression coverage for nested zoom, click, and drag flows

Those are **not** the remaining gaps.

What still needs attention for standalone production is below.

## Remaining priorities

## 1. Broaden native key support as a focused follow-up

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
