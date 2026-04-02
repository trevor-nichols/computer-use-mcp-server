---
id: EP-20260401-004
title: Broaden native key support and make modifier holds explicit
status: archived
kind: feature
domain: backend
owner: '@codex'
created: 2026-04-01
updated: '2026-04-01'
tags:
- keyboard
- native
- input
touches:
- api
- tests
- docs
risk: med
breaking: false
migration: false
links:
  issue: ''
  pr: ''
  docs: docs/target.md
depends_on: []
supersedes: []
---

# EP-20260401-004 - Broaden native key support and make modifier holds explicit

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date as work proceeds.

If `.agent/PLANS.md` exists in this repository, maintain this plan in accordance with that guidance.

## Purpose / Big Picture

After this change, the standalone MCP server will accept a concrete, documented set of keyboard tokens instead of today's narrow hard-coded subset. A caller will be able to send function keys, page navigation keys, Home/End, forward delete, numpad digits and numpad arithmetic, common shortcut punctuation such as `command+.` and `command+[`, and standalone modifier holds such as `hold_key(["shift"], 500)` without the request silently degrading into a no-op.

The user-visible proof is straightforward. The target list in `docs/target.md` will stop saying "more navigation and symbol keys" and instead name the exact keys this server supports. `packages/native-swift` will have a deterministic key-normalization and key-resolution layer with targeted Swift tests, and the TypeScript suite will continue to pass while preserving the current fail-closed approval and safety behavior.

## Scope

In scope are the native Swift changes in `packages/native-swift/Sources/ComputerUseBridge/InputService.swift` needed to normalize keyboard tokens, expand the key map, and treat modifier-only key transitions as first-class operations for `keySequence`, `keyDown`, `keyUp`, and therefore `hold_key`. This plan also includes additive aliases that make the tool surface easier to use without breaking current callers, targeted tests close to the Swift implementation, and documentation updates in `docs/target.md` and validation notes so the supported key contract is explicit.

Out of scope are the system and media keys exposed by Claude Code's private native module, such as brightness, volume, media playback, Launchpad, Mission Control, Eject, Power, illumination, and display mirroring. Also out of scope are new MCP tool names, schema shape changes, a move into `packages/native-input`, or any weakening of the existing approval, target-app, lock, and fake-mode guarantees.

## Progress

- [x] (2026-04-02 00:18Z) Reviewed `SNAPSHOT.md`, `packages/SNAPSHOT.md`, `docs/target.md`, the current Swift bridge, and the test suite to confirm broader native key support is the only remaining item called out by the current target document.
- [x] (2026-04-02 00:25Z) Audited Claude Code's public `computerUse` wrapper and determined the TypeScript layer only forwards raw key tokens into private native packages rather than defining the key vocabulary itself.
- [x] (2026-04-02 00:27Z) Recovered Claude Code's broader native key enum from the installed Claude app's unpacked `claude-native` binary to inform a concrete comparison set.
- [x] (2026-04-02 00:33Z) Created this ExecPlan and the milestone scaffolds with `agentrules execplan new` and `agentrules execplan milestone new`.
- [x] (2026-04-02 00:46Z) Added `packages/native-swift/Sources/ComputerUseBridge/InputKey.swift` as the shared normalization and resolution layer for canonical keys, aliases, punctuation, function keys, navigation keys, numpad keys, and standalone modifiers.
- [x] (2026-04-02 00:48Z) Reworked `InputService.swift` so `keySequence`, `keyDown`, and `keyUp` share the same resolver and modifier transitions no longer silently no-op for standalone modifier holds.
- [x] (2026-04-02 00:49Z) Tightened the TypeScript system-combo gate so `meta`, `super`, `windows`, and `function` aliases stay fail-closed when `systemKeyCombos` is not granted.
- [x] (2026-04-02 00:52Z) Added native Swift resolver tests plus TypeScript regressions for alias-aware combo gating.
- [x] (2026-04-02 00:55Z) Updated `docs/target.md`, `VALIDATION.md`, `SNAPSHOT.md`, and `packages/SNAPSHOT.md` to reflect the explicit keyboard contract and current tree state.
- [x] (2026-04-02 00:56Z) Verified `npm test`, `swift test --package-path packages/native-swift`, `swift build --package-path packages/native-swift -c release`, and `swift build --package-path packages/approval-ui-macos -c release` all pass.

## Surprises & Discoveries

- Observation: the Claude Code repository snapshot does not contain the real key map.
  Evidence: `src/utils/computerUse/executor.ts` only splits sequences on `+` and forwards raw tokens to `input.keys(parts)` and `input.key(k, "press")`, so the accepted key names live in private native packages, not in the checked-in TypeScript wrapper.

- Observation: the installed Claude app bundle still exposes enough binary strings to recover the underlying native special-key enum even though the source package is private.
  Evidence: `strings /Applications/Claude.app/Contents/Resources/app.asar.unpacked/node_modules/@ant/claude-native/claude-native-binding.node` reveals support for `F1` through `F20`, `PageUp`, `PageDown`, `Home`, `End`, numpad keys, and many system/media keys.

- Observation: the current standalone server has a real modifier-hold gap, not just a vague future enhancement.
  Evidence: `packages/computer-use-mcp/src/tools/holdKey.ts` calls `input.keyDown()` and `input.keyUp()` with raw modifier names, but `packages/native-swift/Sources/ComputerUseBridge/InputService.swift` only resolves standalone keys through `keyCodeForKey()`, which currently contains no entries for `command`, `shift`, `option`, `control`, or `fn`.

- Observation: the TypeScript bridge contract is already permissive enough for this work.
  Evidence: `packages/computer-use-mcp/src/native/bridgeTypes.ts` models `keySequence`, `keyDown`, and `keyUp` as plain `string` inputs, so most of the implementation lives in Swift and documentation rather than schema changes.

- Observation: modifier state needs counted ownership, not a flat boolean flag, once standalone modifier holds and `keySequence` share the same native path.
  Evidence: a simple shared `activeModifierFlags` bitset would clear a user-held modifier after an unrelated later chord such as `keyDown("shift")` followed by `keySequence("shift+a")`. The landed implementation keeps per-modifier counts and derives flags from those counts before posting each CG event.

- Observation: the TypeScript system-combo gate had an alias drift risk once `meta`, `super`, `windows`, and `function` became accepted native spellings.
  Evidence: `sequenceRequiresSystemKeyCombos()` previously used substring matching against a narrow token list, so `meta+a` would have skipped the existing permission denial even though the Swift layer now resolves it to Command.

## Decision Log

- Decision: implement a concrete core key set and alias policy rather than trying to mirror Claude Code's full private native enum.
  Rationale: the target item in `docs/target.md` is about filling real productivity gaps in desktop automation, not inheriting every system-control key from another product. A narrower, explicit contract is easier to test, document, and keep stable.
  Date/Author: 2026-04-02 / @codex

- Decision: keep current compatibility semantics where `delete` continues to mean the existing backward-delete key, and add `forward_delete` as a new explicit token.
  Rationale: `delete` already maps to the macOS backspace key in this repository. Reinterpreting it would be a silent breaking change. The additive `forward_delete` token closes the capability gap without changing caller behavior.
  Date/Author: 2026-04-02 / @codex

- Decision: accept both documentation-friendly names and ergonomic aliases for navigation and punctuation keys.
  Rationale: docs should describe stable names such as `page_up`, `left_bracket`, and `forward_delete`, but callers should also be able to write natural shortcut sequences such as `command+.` or `command+[`. Supporting both is additive and keeps the tool usable.
  Date/Author: 2026-04-02 / @codex

- Decision: add Swift-side tests under `packages/native-swift` instead of trying to prove the native key map only through TypeScript mocks.
  Rationale: the real behavior change is in Swift key normalization and CGKeyCode resolution. TypeScript tests can guard orchestration and existing safety behavior, but they cannot prove that the native map accepts the newly documented tokens.
  Date/Author: 2026-04-02 / @codex

- Decision: track active modifiers with per-key reference counts instead of a single shared flag set.
  Rationale: counted ownership preserves correct behavior when standalone modifier holds overlap later `keySequence()` calls or repeated modifier taps. It avoids accidentally releasing a modifier that was already held before the current operation started.
  Date/Author: 2026-04-02 / @codex

- Decision: keep the TypeScript combo-permission rule narrow and additive rather than broadening it to every use of `shift`.
  Rationale: the immediate safety gap was alias drift for Command/Option/Control/Fn spellings, not a full permission-policy redesign. The landed tests lock in alias-aware fail-closed behavior without changing the existing treatment of plain shifted text sequences.
  Date/Author: 2026-04-02 / @codex

## Outcomes & Retrospective

This plan is implemented. The repository now has one explicit native keyboard contract, one shared Swift resolver for both chords and standalone key transitions, and direct regression coverage on both the native and orchestration sides. The user-visible result is that shortcuts such as `command+[`, `command+.`, `page_up`, `f12`, `numpad_add`, and standalone modifier holds such as `hold_key(["shift"], 500)` are now part of the documented support surface instead of vague future work.

The remaining keyboard follow-ons are intentionally optional rather than required: second-tier tokens such as sided modifiers or Caps Lock / Help, and any future choice to expose system/media keys. Those remain deferred so the standalone server keeps a focused, testable desktop-control surface.

## Context and Orientation

The standalone MCP server lives under `packages/computer-use-mcp`, but native keyboard injection happens in the Swift executable under `packages/native-swift/Sources/ComputerUseBridge/InputService.swift`. The TypeScript runtime sends raw strings into the native host through `packages/computer-use-mcp/src/native/swiftBridge.ts`, which implements the `InputBridge` interface declared in `packages/computer-use-mcp/src/native/bridgeTypes.ts`.

The current Swift path has three relevant pieces. `keySequence()` splits a `command+shift+a`-style string on `+`, resolves modifier flags via `modifierFlag()`, resolves the final key token via `keyCodeForKey()`, then posts a key-down and key-up pair with the modifier flags set. `keyDown()` and `keyUp()` bypass `modifierFlag()` entirely and only call `keyCodeForKey()`. `keyCodeForKey()` only knows letters, digits, Return, Tab, Space, Escape, backward delete, and the four arrow keys.

That matters because the `hold_key` MCP tool in `packages/computer-use-mcp/src/tools/holdKey.ts` sends each requested key through `input.keyDown()` and later `input.keyUp()`. Today the tool-level permission and target-app checks are correct, but `hold_key(["shift"], 500)` cannot actually press Shift on the native side because the Swift bridge never resolves standalone modifiers as keys. This plan must fix that without disturbing the existing lock, TCC, target-app, and Escape-abort behavior already covered elsewhere.

The current open target item is recorded in `docs/target.md`. That document already says the unresolved work is broader native key support, but the fourth bullet still says "more navigation and symbol keys" instead of naming what the server should accept. This ExecPlan turns that vague sentence into a concrete contract and then implements it.

## Supported Key Contract

This plan will define and implement the following keyboard contract. "Canonical" means the spelling that documentation and examples should prefer. "Alias" means an additive alternate spelling the implementation accepts for compatibility and ergonomics.

Canonical keys that must be supported after this plan:

- Existing compatibility set: `a` through `z`, `0` through `9`, `enter`, `return`, `tab`, `space`, `escape`, `esc`, `delete`, `backspace`, `left`, `right`, `up`, `down`
- New navigation keys: `home`, `end`, `pageup`, `pagedown`, `page_up`, `page_down`, `left_arrow`, `right_arrow`, `up_arrow`, `down_arrow`
- New edit key: `forward_delete`
- New function keys: `f1` through `f20`
- New numpad keys: `numpad0` through `numpad9`, `numpad_add`, `numpad_subtract`, `numpad_multiply`, `numpad_divide`, `numpad_decimal`
- Modifier keys that must work both inside `keySequence()` and as standalone `keyDown()` / `keyUp()` / `hold_key()` inputs: `command`, `cmd`, `shift`, `option`, `alt`, `control`, `ctrl`, `fn`, `function`
- New punctuation keys for shortcuts: `minus`, `equal`, `left_bracket`, `right_bracket`, `backslash`, `semicolon`, `quote`, `comma`, `period`, `slash`, `grave`

Additive aliases that should resolve to the same canonical meaning:

- `meta`, `super`, and `windows` resolve to `command`
- Raw punctuation spellings `-`, `=`, `[`, `]`, `\\`, `;`, `'`, `,`, `.`, `/`, and `` ` `` resolve to the named punctuation keys above
- `page_up`, `page_down`, `left_arrow`, `right_arrow`, `up_arrow`, and `down_arrow` resolve to the same CGKeyCodes as `pageup`, `pagedown`, `left`, `right`, `up`, and `down`
- `forwarddelete` may resolve to `forward_delete` if doing so keeps the implementation simple, but the documented spelling remains `forward_delete`

Explicitly out of scope for this ExecPlan even though Claude Code's native enum appears to support them:

- `caps_lock`, `help`, sided modifier names such as `right_command` and `right_shift`
- System and media keys such as brightness, volume, playback transport, Launchpad, Mission Control, Eject, Power, illumination, contrast, and display mirroring
- Any generic catch-all token such as `unicode` or `other`

## Plan of Work

First, make the key contract explicit before changing behavior. Add a normalization layer in `packages/native-swift/Sources/ComputerUseBridge/InputService.swift` or a small adjacent helper file inside the same target that converts raw user tokens into a small internal model. That model should distinguish regular keys from modifier keys so `keySequence()`, `keyDown()`, and `keyUp()` all consume one shared resolution path instead of today's split behavior. The normalization layer should also centralize aliases so documentation, tests, and behavior stay synchronized.

Second, expand the regular-key map to cover the agreed concrete set. The existing `keyCodeForKey()` switch should be replaced or fronted by a clearer resolver that can represent raw punctuation, named punctuation, function keys, page navigation, Home/End, forward delete, and numpad keys. Keep compatibility for existing spellings such as `delete` and `backspace`, and keep the implementation additive rather than clever. The resolver should fail closed by returning `nil` for unknown tokens instead of guessing.

Third, make modifier-only transitions explicit. Introduce a shared representation that can answer two questions for any normalized token: "is this a modifier?" and "what CG event data should be posted for press and release?" Use that representation from `keySequence()`, `keyDown()`, and `keyUp()` so `hold_key(["shift"], 500)` and `hold_key(["command", "shift"], 500)` become real native operations rather than silent no-ops. Preserve the existing SyntheticInputMarker behavior and continue to post events through the same event tap.

Fourth, add tests close to the implementation and then update the repo-level documentation. `packages/native-swift` should gain a lightweight Swift test target that verifies token normalization, alias resolution, and the expected CGKeyCode or modifier identity for the newly supported keys. The existing TypeScript tests under `packages/computer-use-mcp/test` should remain focused on orchestration and safety behavior, but they should gain at least one targeted regression test around `hold_key` modifier semantics if a narrow assertion can be made without mocking away the native behavior. Update `docs/target.md` so the open item names the exact keys and alias policy instead of saying "more navigation and symbol keys", and refresh `VALIDATION.md` or the snapshot artifacts if the Swift test target changes the package structure.

## Milestones

### Milestone 1: Define the explicit key vocabulary and alias policy

At the end of this milestone, the repository will have one authoritative definition of the supported key contract, including exact canonical names, accepted aliases, explicit non-goals, and the compatibility rule that `delete` remains backward delete while `forward_delete` is additive. Verification is by reading the updated target and milestone docs plus Swift tests or pure resolution checks that prove the normalization layer accepts the documented spellings.

### Milestone 2: Implement the native key map and modifier-safe transitions

At the end of this milestone, the Swift bridge will accept the newly supported keys and standalone modifiers through the same shared resolution path. `keySequence()`, `keyDown()`, `keyUp()`, and therefore `hold_key()` will all use that shared model, and unsupported tokens will still fail closed rather than being guessed. Verification is by Swift tests for the new resolver and by confirming the package still builds successfully.

### Milestone 3: Add regression coverage, update docs, and verify rollout

At the end of this milestone, the repository validation commands will cover the new key behavior, `docs/target.md` will describe the exact support set, and `VALIDATION.md` plus any affected snapshot artifacts will reflect the new test/build expectations. Verification is by `npm test`, `swift test --package-path packages/native-swift`, and the existing Swift release build commands.

## Validation

From `/Volumes/AGENAI/Coding/public-github/computer-use-mcp-server`, run:

  npm test
  swift test --package-path packages/native-swift
  swift build --package-path packages/native-swift -c release
  swift build --package-path packages/approval-ui-macos -c release

Green means the existing MCP/runtime suite still passes, the new Swift-side key normalization and key map tests pass, and the native bridge still builds in release mode. The critical behavioral proof is that the documented tokens now resolve deterministically and that standalone modifier presses no longer depend on `keySequence()` to work.
