This target is for a **production-grade standalone computer-use MCP server**, not Claude-wire parity.

The current codebase already has:

- direct `tools/call` execution
- a working Swift-native input bridge
- `select_display` and `switch_display`
- display pinning and app-aware auto-targeting
- `CGEventTap`-based Escape abort with a fallback monitor
- zoom-to-action coordinate persistence with regression coverage for nested zoom, click, and drag flows

Those are **not** the remaining gaps.

What still needs attention for standalone production is below.

## Remaining priorities

## 1. Add frontmost / under-cursor safety gates

The current pre-action flow hides or excludes disallowed apps, but it does not verify the actual target app immediately before sending input.

What to add:

- `getFrontmostApp()`
- `appUnderPoint(x, y)`
- a pre-action safety check for click, drag, type, and possibly key/scroll depending on the target semantics
- explicit fail-closed behavior when the active or under-cursor app is outside the granted set

Where:

- native side:
  - `packages/native-swift/Sources/ComputerUseBridge/AppService.swift`
  - bridge plumbing in `BridgeMain.swift`
  - `packages/computer-use-mcp/src/native/bridgeTypes.ts`
  - `packages/computer-use-mcp/src/native/swiftBridge.ts`
- server side:
  - `packages/computer-use-mcp/src/tools/actionScope.ts`
  - likely a dedicated safety helper such as `src/tools/frontmostGate.ts`

Why:

- hiding/excluding apps is helpful, but it is not a complete safety backstop
- if app activation or z-order is wrong, input can still land on the wrong target

## 2. Add host/self-awareness to capture and hide flows

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

## 3. Broaden native key support as a focused follow-up

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
