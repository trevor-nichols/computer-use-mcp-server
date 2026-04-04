# Validation

## Verified in this environment

### Node / TypeScript
- `npm run build`
- `npm test`
- `npm ci --ignore-scripts`

### Rust input backend
- `npm --prefix packages/native-input test`
- `npm --prefix packages/native-input run build`

### Swift
- `swift test --package-path packages/native-swift`
- `swift build --package-path packages/native-swift -c release`
- `swift build --package-path packages/approval-ui-macos -c release`

## Test results

- `npm test`: 73 / 73 tests passed
- `swift test --package-path packages/native-swift`: 10 / 10 tests passed
- `npm --prefix packages/native-input test`: 12 / 12 tests passed
- `npm ci --ignore-scripts`: passed with lockfile/package sync

Coverage highlights:

- stdio end-to-end test against the built server in fake mode
- Streamable HTTP coverage including client-supplied session hint handling
- approval coordinator coverage for local UI and host-callback paths
- shared-scope coverage for `computer_batch`
- screenshot fallback and capture-scope coverage
- capture storage and cleanup coverage with inline MCP image outputs plus `capture_metadata` lookup
- action-scope filtering coverage for target-display app exclusion
- key normalization coverage for function keys, navigation aliases, punctuation aliases, numpad keys, and modifier aliases
- native app discovery coverage for nested `.app` bundles and duplicate-bundle root precedence
- input backend routing and Rust bridge loading/fail-fast coverage

## Implemented areas from the remaining spec gap list

- approval integrity
  - fail-closed local approval behavior in real mode
  - host callback approval provider
  - hybrid host-first with local fallback
  - post-prompt TCC re-check through the native bridge
- pre-action safety and cleanup
  - action scope helper
  - desktop lock integration across mutation tools
  - hide/unhide cleanup hooks for disallowed apps
  - screenshot exclusion wiring for disallowed apps
- global abort
  - Swift-side Escape abort service
  - TypeScript abort polling and cleanup integration
- missing tools
  - zoom
  - mouse_move
  - right/middle/double/triple click
  - left_click_drag
  - scroll
  - key
  - hold_key
  - read_clipboard / write_clipboard
  - search_applications
  - list_granted_applications
  - wait
  - computer_batch
- daemon / Streamable HTTP
  - localhost Streamable HTTP transport
  - session header handling
  - SSE outbound server-message support
  - HTTP session cleanup and DELETE termination
- host callback integration
  - transport-level server-to-client request support
  - host SDK callback constants and initialize metadata helpers
- backend split
  - native host routing for `swift`, `rust`, and `fake` input backends
  - Rust input backend package integration via `@agenai/native-input`

## Live macOS validation completed

- Streamable HTTP initialize, SSE approval callback delivery, `request_access`, `list_granted_applications`, and `DELETE` session cleanup
- real-mode desktop actions:
  - `open_application`
  - `mouse_move`
  - `cursor_position`
  - `left_click`
  - `right_click`
  - `middle_click`
  - `double_click`
  - `triple_click`
  - `type` with and without clipboard mode
  - `key`
  - `hold_key`
  - `read_clipboard`
  - `write_clipboard`
  - `scroll`
  - `left_click_drag`
  - `computer_batch`
- `screenshot` and `zoom` in real mode, including runs with both:
  - `COMPUTER_USE_HIDE_DISALLOWED=0` and `COMPUTER_USE_EXCLUDE_DISALLOWED_SCREENSHOTS=1`
  - `COMPUTER_USE_HIDE_DISALLOWED=1` and `COMPUTER_USE_EXCLUDE_DISALLOWED_SCREENSHOTS=1`
- TextEdit smoke flow validated through Computer Use MCP tools:
  - `request_access`
  - `open_application`
  - `key` (`command+n`, `command+a`, `command+c`)
  - `type`
  - `read_clipboard`
  - `scroll`
  - `left_click_drag`

## Operational note

`request_access` in local/hybrid approval modes requires the `ApprovalUIBridge` helper binary.

If the helper is unavailable, approval calls fail closed with:

`Approval helper binary is not available. Build approval-ui-macos or set COMPUTER_USE_APPROVAL_UI_PATH.`

## Screenshot caveat

Direct ScreenCaptureKit exclusion capture still times out on this host with real disallowed app sets.

The server now recovers by:
- timing out the stuck native capture request
- restarting the native bridge
- temporarily hiding only the visible disallowed apps on the target display
- retrying capture without ScreenCaptureKit exclusions through the native fallback path
- restoring the temporarily hidden apps afterward

That recovery path was validated live and makes `screenshot` and `zoom` complete successfully in the tested configurations above.

## Still worth validating manually on a Mac

- physical Escape global abort against real desktop actions
- broader drag, scroll, key, and hold-key behavior across a wider range of native apps
- direct ScreenCaptureKit exclusion reliability on other Macs and app/window combinations
