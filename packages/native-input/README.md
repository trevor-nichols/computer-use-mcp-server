# native-input

`@agenai/native-input` is the dedicated Rust input backend for the computer-use MCP server.

It is intentionally narrow in scope. The package owns only desktop input injection:

- cursor position lookup
- absolute mouse movement
- mouse down / mouse up / click
- two-axis pixel scrolling
- key sequences and explicit key down / key up
- direct Unicode text typing

It does **not** own screenshots, display metadata, application enumeration, clipboard, TCC checks, or escape hotkey registration. Those native responsibilities remain in `packages/native-swift`.

## JavaScript contract

The package exports the same promise-based surface consumed by `packages/computer-use-mcp/src/native/inputBridge.ts`:

- `getCursorPosition(): Promise<{ x: number; y: number }>`
- `moveMouse(x, y): Promise<void>`
- `mouseDown(button): Promise<void>`
- `mouseUp(button): Promise<void>`
- `click(button, count): Promise<void>`
- `scroll(dx, dy): Promise<void>`
- `keySequence(sequence): Promise<void>`
- `keyDown(key): Promise<void>`
- `keyUp(key): Promise<void>`
- `typeText(text): Promise<void>`

The CommonJS wrapper in `index.js` keeps the Node-facing API promise-based even though the Rust addon exports synchronous functions.

## Build

This package is macOS-first. Build the addon from the repository root with:

    npm --prefix packages/native-input run build

That runs Cargo, then copies the generated shared library to `packages/native-input/native-input.node`, which is what the JS wrapper loads by default.

For local overrides, set:

    COMPUTER_USE_RUST_INPUT_PATH=/absolute/path/to/native-input.node

## Safety and parity notes

The Rust backend preserves the same synthetic keyboard marker contract used by the Swift hotkey service. The marker value is:

    0x43554D4350455343

Changing that value requires a coordinated update in `packages/native-swift/Sources/ComputerUseBridge/SyntheticInputMarker.swift`, otherwise injected Escape events can be mistaken for physical abort presses.

During migration, `packages/computer-use-mcp` can still route input to the legacy Swift backend via `COMPUTER_USE_INPUT_BACKEND=swift`.
