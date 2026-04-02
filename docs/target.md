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

There are no open standalone-production gaps remaining in this document today.

## Keyboard support contract

The final focused input follow-up was broader native key support. That work is now implemented with an explicit, additive token contract.

Supported keys:

- existing compatibility keys: `a` through `z`, `0` through `9`, `enter` / `return`, `tab`, `space`, `escape` / `esc`, `delete` / `backspace`, `left`, `right`, `up`, `down`
- function keys: `f1` through `f20`
- navigation keys: `home`, `end`, `pageup`, `pagedown`
- additive navigation aliases: `page_up`, `page_down`, `left_arrow`, `right_arrow`, `up_arrow`, `down_arrow`
- edit key: `forward_delete`
- numpad keys: `numpad0` through `numpad9`, `numpad_add`, `numpad_subtract`, `numpad_multiply`, `numpad_divide`, `numpad_decimal`
- modifiers that work both in `key` sequences and standalone `keyDown` / `keyUp` / `hold_key`: `command` / `cmd`, `shift`, `option` / `alt`, `control` / `ctrl`, `fn` / `function`
- additive command aliases: `meta`, `super`, `windows`
- punctuation shortcut keys: `minus`, `equal`, `left_bracket`, `right_bracket`, `backslash`, `semicolon`, `quote`, `comma`, `period`, `slash`, `grave`
- raw punctuation aliases for those keys: `-`, `=`, `[`, `]`, `\\`, `;`, `'`, `,`, `.`, `/`, `` ` ``

Compatibility rules:

- `delete` remains the existing backward-delete key for compatibility
- `forward_delete` is additive and explicit
- unknown key names still fail closed instead of being guessed
- modifier-only transitions remain explicit and testable rather than being treated as special cases of regular keys

Deliberately out of scope:

- system and media keys such as brightness, volume, playback transport, Launchpad, Mission Control, Eject, Power, illumination, contrast, and display mirroring
- second-tier keys such as `caps_lock`, `help`, and sided modifiers like `right_command`
