# Claude Code Parity Checklist

This checklist compares the Claude Code computer-use surface visible in the local Claude Code snapshot against this standalone MCP server.

Scope:
- Claude evidence came from:
  - `docs/architecture/macos-computer-control.md`
  - `src/utils/computerUse/*`
  - `src/components/permissions/ComputerUseApproval/ComputerUseApproval.tsx`
  - `src/state/AppStateStore.ts`
- Important limitation:
  - the actual `@ant/computer-use-mcp` package source is not vendored in the Claude Code tree here
  - items marked `inferred` are strongly suggested by integration code, but not fully proven from package source

Legend:
- `[x]` parity achieved
- `[~]` partial parity or behavior differs
- `[ ]` missing
- `(inferred)` means Claude support is implied, not directly proven from vendored source

## 1. Tool Surface

### Core tool loop

- [x] `request_access`
- [x] `screenshot`
- [x] `cursor_position`
- [x] `mouse_move`
- [x] `left_click`
- [x] `right_click`
- [x] `middle_click`
- [x] `double_click`
- [x] `triple_click`
- [x] `left_click_drag`
- [x] `type`
- [x] `open_application`
- [x] `wait`

### Extended interaction tools

- [x] `select_display`
- [x] `zoom`
- [x] `scroll`
- [x] `key`
- [x] `hold_key`
- [x] `read_clipboard`
- [x] `write_clipboard`
- [x] `list_granted_applications`
- [x] `computer_batch`

### Likely Claude-only or not yet implemented here

- [x] `switch_display`
  - Claude evidence:
    - host state explicitly tracks `displayPinnedByModel`
    - comments in `wrapper.tsx` mention `switch_display(name)` and `switch_display("auto")`
  - Current repo:
    - `select_display` is the generic primary tool
    - `switch_display` is exposed as a compatibility alias
    - explicit display pinning and `auto` unpinning are implemented

- [ ] `left_mouse_down` `(inferred)`
  - Claude evidence:
    - `toolRendering.tsx` contains a render path for `left_mouse_down`
  - Current repo:
    - no tool exists

- [ ] `left_mouse_up` `(inferred)`
  - Claude evidence:
    - `toolRendering.tsx` contains a render path for `left_mouse_up`
  - Current repo:
    - no tool exists

## 2. Behavior And Safety

### Session state and coordinate handling

- [x] Session-owned app grants
- [x] Session-owned grant flags
- [x] Session-owned screenshot dimensions
- [x] Screenshot-to-desktop coordinate transforms
- [x] Screenshot resizing to keep coordinates coherent
- [x] Selected display tracking after screenshot capture

- [~] Display pinning and target-display management
  - Claude:
    - explicit model pin/unpin flow is visible
    - auto-target display state is visible
  - Current repo:
    - `select_display` and `switch_display` can pin to a display by id or name
    - `auto=true` clears the explicit pin
    - screenshot-style tools honor the pin
    - unpinned `screenshot` auto-targets based on allowed-app window locations
    - auto-target results are cached by allowed-app set until the set changes
    - coordinate actions still stay anchored to the last screenshot the model saw

### Clipboard and typing behavior

- [x] Clipboard-backed paste mode
- [x] Clipboard round-trip verification before paste
- [x] Clipboard restore in `finally`
- [x] Direct typing path when clipboard mode is disabled

### Locking and cleanup

- [x] File-based desktop lock
- [x] Stale PID recovery for the lock
- [x] Re-entrant lock ownership
- [x] Cleanup of temporarily hidden apps at the end of an action scope

- [~] Lock lifetime
  - Claude:
    - visible design is effectively turn-scoped
    - cleanup runs at turn end
  - Current repo:
    - lock is acquired and released per tool call or per batch scope
    - this is simpler, but weaker for multi-step exclusivity
  - Decision:
    - keep per-tool or per-batch lock ownership
    - do not pursue Claude-style turn or session exclusivity

- [~] Cleanup lifetime
  - Claude:
    - hidden apps and lock cleanup are clearly turn-end responsibilities
  - Current repo:
    - cleanup is action-scoped, not turn-scoped
    - safe, but behavior differs

### Screenshot safety

- [x] Disallowed-app filtering for screenshots
- [x] Optional hide-before-action behavior
- [x] Optional screenshot exclusion behavior
- [x] Fallback from exclusion capture to temporary app hiding when exclusion capture fails

### macOS permissions and approvals

- [x] TCC state checks for Accessibility and Screen Recording
- [x] Local approval provider
- [x] Host-callback approval provider
- [x] Hybrid host-first approval fallback
- [x] Post-approval TCC re-check

- [~] TCC guidance UX
  - Claude:
    - approval UI visibly offers direct System Settings actions
  - Current repo:
    - native bridge supports opening System Settings
    - local approval helper does not yet expose those actions in the UI

- [ ] Sentinel/risk warnings in approval UI
  - Claude:
    - warns for apps equivalent to shell access, filesystem access, or system settings access
  - Current repo:
    - local approval UI is a simple allow/deny alert

- [ ] Installed-app description curation for `request_access`
  - Claude:
    - enumerates installed apps with filtering and prompt-injection hardening
    - uses sanitized app names in tool descriptions
  - Current repo:
    - no equivalent installed-app description enrichment is wired

### Abort behavior

- [x] Global Escape abort exists
- [x] Expected-Escape hole-punch exists for model-sent Escape

- [~] Escape implementation strength
  - Claude:
    - comments describe a consuming CGEvent tap
  - Current repo:
    - uses a consuming CGEvent tap on macOS when Accessibility trust allows it
    - tags helper-generated keyboard events so model-sent Escape is not self-aborted
    - falls back to `NSEvent.addGlobalMonitorForEvents` if the tap cannot be installed

## 3. Architecture Differences

These are not parity failures by themselves, but they change behavior.

- [x] Standalone MCP server
  - This repo is intentionally more open and reusable than Claude Code's embedded surface.

- [x] Multiple transport options
  - This repo supports `stdio` and Streamable HTTP.
  - That exceeds what is visible in Claude's embedded implementation.

- [x] Host-agnostic approval design
  - This repo already supports local UI, host callbacks, and hybrid mode.
  - That is broader than the Claude-specific integration.

## 4. Recommended Implementation Backlog

### Priority 0

- [x] Add explicit display selection
  - `select_display` is the generic primary tool.
  - `switch_display` is the compatibility alias.
  - supports `displayId`, `displayName`, and `auto=true`

- [x] Keep lock ownership action-scoped
  - Intentional design difference.
  - Not a planned parity item.

- [x] Strengthen Escape abort behavior
  - uses a consuming CGEvent tap when available
  - keeps a fallback monitor path when the tap cannot be installed
  - preserves expected-Escape hole-punch semantics

- [x] Implement real auto-target display resolution
  - unpinned `screenshot` now chooses a display from allowed-app windows
  - the result is cached by sorted allowed-app key
  - negative resolutions are not cached

### Priority 1

- [ ] Add `left_mouse_down` if needed
- [ ] Add `left_mouse_up` if needed
- [ ] Improve local approval UI with:
  - TCC deep-link buttons
  - richer app list presentation
  - sentinel risk warnings

- [ ] Add installed-app hint generation for `request_access`
  - include filtering
  - include prompt-injection hardening

### Priority 2

- [ ] Clean up stale docs in this repo
  - keep README and docs aligned with the actual tool surface

## 5. Suggested Decision Order

If the goal is "Claude-like parity with clean implementation", the cleanest order is:

1. approval UX parity
2. optional `left_mouse_down` / `left_mouse_up`

## 6. Current Summary

Practical parity status:

- tool surface parity: very high
- behavior parity: moderate-to-high
- approval UX parity: partial
- multi-agent / multi-client orchestration parity: partial

Largest real gaps:

1. richer approval UX and request-access app hinting
2. optional `left_mouse_down` / `left_mouse_up`
