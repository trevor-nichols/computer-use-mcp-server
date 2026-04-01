# Validation

## Verified in this environment

### Node / TypeScript
- `npm run build`
- `npm test`

### Swift
- `swift build --package-path packages/native-swift -c release`
- `swift build --package-path packages/approval-ui-macos -c release`

### Test results
- 18 / 18 tests passed
- includes a stdio end-to-end test against the built server in fake mode
- includes Streamable HTTP transport coverage, including client-supplied session hint handling
- includes approval coordinator coverage for both local and host-callback approval paths
- includes shared-scope coverage for `computer_batch`
- includes screenshot fallback and capture-scope coverage
- includes action-scope filtering coverage for target-display app exclusion

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
