You do **not** need to copy Claude Code’s host-internal `.call()` interception. For a reusable standalone MCP server, your direct `tools/call` path is the right choice.

What you **do** need to add depends on the target:

* **Target A:** production-grade standalone computer-use MCP
* **Target B:** near-Claude-Code behavior parity

For both targets, these are the real missing pieces.

## Add these first

### 1. Finish the native input layer properly

Right now your biggest structural gap is that `packages/native-input/` is still a placeholder, while real input is living in `InputService.swift`.

What to add:

* a real `native-input` package with:

  * mouse move
  * mouse button press/release/click
  * vertical + horizontal scroll
  * key sequence
  * key down/up
  * text typing
  * cursor position
  * **frontmost app info**
* broader key support:

  * function keys
  * page up/down
  * home/end
  * modifier-only presses
  * more symbols and navigation keys

Where:

* `packages/native-input/src/*`
* `packages/computer-use-mcp/src/native/bridgeTypes.ts`
* `packages/computer-use-mcp/src/native/swiftBridge.ts`

Why:

* Claude clearly separates input from screenshot/app/system work.
* More importantly, you need **frontmost app** support and richer input semantics. That is part of their safety model, not just package purity.

## 2. Replace the Escape observer with a real consuming Escape abort

Your current `HotkeyService.swift` uses `NSEvent.addGlobalMonitorForEvents(...)`.

That is not equivalent.

What to add:

* `CGEventTap`-based Escape interception
* consume Escape while computer use is active
* keep the “expected Escape” hole so model-generated Escape does not trigger abort

Where:

* `packages/native-swift/Sources/ComputerUseBridge/HotkeyService.swift`
* bridge methods in `BridgeMain.swift`

Why:

* This is one of Claude’s stronger safety behaviors.
* Your current version can **see** Escape, but it does not **own** Escape.

## 3. Add real frontmost / under-cursor safety

You are missing the main guardrails Claude relies on when display prep is imperfect.

What to add:

* `getFrontmostApp()`
* `appUnderPoint(x, y)`
* guardrails before click/drag/type so actions do not land on the wrong app silently

Where:

* native side:

  * `packages/native-input/src/frontmost.rs` or equivalent
  * `packages/native-swift/Sources/ComputerUseBridge/AppService.swift`
* server side:

  * `packages/computer-use-mcp/src/tools/actionScope.ts`
  * probably a new safety module, for example `src/safety/frontmostGate.ts`

Why:

* Claude explicitly keeps a frontmost-app safety backstop.
* Without this, a failed app-switch or wrong z-order can still send real input somewhere unsafe.

## 4. Implement the full display targeting model

You already have session fields for:

* `selectedDisplayId`
* `displayPinnedByModel`
* `displayResolvedForApps`

But they are mostly scaffolded, not fully alive.

What to add:

* `switch_display` tool
* pin/unpin behavior
* `"auto"` behavior
* display resolution based on allowed apps
* fallback when a pinned display disappears
* persistent display selection semantics across screenshot/action calls

Where:

* `packages/computer-use-mcp/src/mcp/toolSchemas.ts`
* `packages/computer-use-mcp/src/mcp/toolRegistry.ts`
* probably new `packages/computer-use-mcp/src/tools/switchDisplay.ts`
* `packages/computer-use-mcp/src/tools/actionScope.ts`
* `packages/native-swift/Sources/ComputerUseBridge/DisplayService.swift`
* `packages/native-swift/Sources/ComputerUseBridge/AppService.swift`

Why:

* Claude’s multi-display behavior is more than “remember last display.”
* It has model pinning, auto-resolve, and recovery semantics.

## 5. Add the full pre-action preparation layer

Your current `withActionScope` hides/excludes apps, but Claude’s flow is richer.

What to add:

* `prepareDisplay(...)`
* `previewHideSet(...)`
* `resolvePrepareCapture(...)`
* host-aware hide exemption
* activation ordering that does not let the host app eat the click
* better display-aware hide resolution

Where:

* native side:

  * `packages/native-swift/Sources/ComputerUseBridge/AppService.swift`
  * `ScreenshotService.swift`
  * `DisplayService.swift`
* server side:

  * `packages/computer-use-mcp/src/tools/actionScope.ts`
  * `captureScope.ts`
  * `captureWithFallback.ts`

Why:

* Claude does not just “hide some apps then act.”
* It resolves the display, prepares z-order, excludes the host, and only then captures or clicks.

## 6. Add host/self-awareness

This is a real missing layer in your version.

What to add:

* a host bundle ID concept
* host exclusion from screenshot capture
* host exemption from hide/unhide
* host-aware activation skipping
* a surrogate host concept for terminal or embedded host cases

Where:

* new common/runtime layer, for example:

  * `packages/computer-use-mcp/src/runtime/hostIdentity.ts`
* wire into:

  * `actionScope.ts`
  * screenshot capture options
  * app prep logic

Why:

* Claude’s CLI version does a lot of work to avoid photographing or hiding its own host and to avoid the terminal being the accidental active target.
* A generic server still needs this, just in a more abstract form.

## 7. Tighten the screenshot sizing + coordinate model

Your current model is directionally correct, but it is simpler than Claude’s.

What to add:

* deterministic target-size pipeline, not just “scale to max dimension”
* persistent logical size + display origin + scale factor on every capture
* exact reverse mapping for clicks/drags/zoom regions
* test coverage for resized output vs applied coordinates

Where:

* `packages/computer-use-mcp/src/transforms/screenshotSizing.ts`
* `packages/computer-use-mcp/src/transforms/coordinates.ts`
* `packages/computer-use-mcp/src/tools/screenshot.ts`
* `packages/computer-use-mcp/src/tools/zoom.ts`

Why:

* Coordinate drift is where these systems get flaky.
* Claude is clearly optimizing to keep screenshot size and action coordinates in the same model-facing space.

## 8. Fill out the missing tool surface

For near-Claude parity, your tool list is still short in a few important places.

Add:

* `switch_display`
* `left_mouse_down`
* `left_mouse_up`

Consider adding compatibility aliases for Claude-style argument shapes:

* `coordinate: [x, y]`
* `start_coordinate: [x, y]`
* `bundle_id`
* `region: [x, y, w, h]`
* `direction`
* `amount`
* `duration`

Where:

* `packages/computer-use-mcp/src/mcp/toolSchemas.ts`
* `packages/computer-use-mcp/src/mcp/toolRegistry.ts`
* new tool files where needed

Why:

* Your current schema is fine for your own protocol.
* It is not Claude-wire-compatible.

## 9. Make batch truly first-class

Your batch tool is good, but it still depends on the limitations of the current primitive set.

What to add:

* support batched `left_mouse_down` / `left_mouse_up`
* modifier-aware clicks
* better abort checks between every subaction
* frontmost safety checks inside the batch
* optional per-batch display pin / temporary display context

Where:

* `packages/computer-use-mcp/src/tools/batch.ts`

Why:

* Once you add the missing primitives, batch becomes much more useful and much closer to how real agents behave.

---

## What can stay different

These do **not** need to change unless you want literal Claude-Code architecture parity.

### Keep your standalone MCP execution model

Claude’s host interception is tied to being embedded in a specific app.

Your direct server approach is better for a reusable MCP server.

### Keep helper-process native bridging if it is stable

Claude needs run-loop pumping because it is calling native modules in-process.

You moved that boundary into a helper process. That is a valid design.

Just make sure:

* main-thread/macOS event work is actually safe inside the helper
* timeouts are solid
* long-lived hotkey registration is robust

### Keep host-callback approval support

That is a good addition for a reusable MCP server.

Claude’s inline React approval UI is host-specific. Yours does not need to copy that.

---

## What I would implement next, in order

### Phase 1

* real `native-input`
* frontmost app API
* consuming Escape via `CGEventTap`

### Phase 2

* `switch_display`
* pin/unpin semantics
* `prepareDisplay`, `previewHideSet`, `resolvePrepareCapture`

### Phase 3

* host/self-awareness layer
* `appUnderPoint`
* stronger action safety checks

### Phase 4

* Claude-compatible argument aliases
* `left_mouse_down`
* `left_mouse_up`
* improved batch semantics

---

## The blunt version

Your current build is already a decent standalone v1.

To make it **strong**, add:

* real native input
* consuming Escape abort
* frontmost-app safety
* full display switching/resolution
* pre-action preparation
* host/self-awareness

To make it **Claude-like**, also add:

* the missing tool surface
* Claude-style schema compatibility
* the richer display/host semantics

The single most important gap is this:

**You need a real safety layer around where input is going, not just the ability to send input.**

That means frontmost app, app-under-point, host exclusion, and display prep.

I can turn this into a concrete file-by-file implementation backlog for your monorepo.
