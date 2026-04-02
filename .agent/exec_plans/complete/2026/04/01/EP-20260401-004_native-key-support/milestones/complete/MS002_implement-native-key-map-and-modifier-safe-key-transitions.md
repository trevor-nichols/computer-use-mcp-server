---
id: EP-20260401-004/MS002
execplan_id: EP-20260401-004
ms: 2
title: "Implement native key map and modifier-safe key transitions"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-02
tags:
- keyboard
- swift
- native
risk: med
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Implement native key map and modifier-safe key transitions

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Make the Swift bridge actually accept the newly documented keys and make standalone modifier presses real native operations. At the end of this milestone, `keySequence`, `keyDown`, and `keyUp` will all use one shared key-resolution path, and `hold_key` will stop relying on a regular-key-only lookup for modifier names.

## Definition of Done

- `packages/native-swift/Sources/ComputerUseBridge/InputService.swift` resolves the new navigation, function, numpad, punctuation, and `forward_delete` tokens.
- Standalone modifier tokens such as `command`, `shift`, `option`, `control`, and `fn` work through `keyDown` and `keyUp`, not just through `keySequence`.
- Unknown keys still fail closed by resolving to `nil` rather than being guessed.
- Raw punctuation aliases such as `.` and `[` resolve to the same key codes as their named forms.
- The Swift executable still builds successfully in release mode.

## Scope

### In Scope
- Wire the normalized key model into `keySequence`, `keyDown`, and `keyUp`.
- Add the agreed CGKeyCode mappings for function keys, page navigation, Home/End, forward delete, numpad digits, numpad arithmetic, and common punctuation shortcut keys.
- Route modifier-only transitions through explicit modifier event posting.
- Keep `SyntheticInputMarker` and existing event-tap posting behavior intact.

### Out of Scope
- New TypeScript bridge types unless implementation proves they are necessary.
- System/media keys and optional second-tier keys such as sided modifiers or Caps Lock.
- Changes to tool schemas, approval rules, lock logic, or target-app gating.

## Current Health Snapshot

| Area | Status | Notes |
| --- | --- | --- |
| Architecture/design | ✅ | The parent ExecPlan defines the target key set and alias policy. |
| Implementation | ⏳ | The current native path still uses a narrow `keyCodeForKey()` switch and regular-key-only `keyDown` / `keyUp`. |
| Tests & QA | ⏳ | Native behavior needs direct Swift coverage plus the existing TypeScript safety checks. |
| Docs & runbooks | ⏳ | The behavior change is not documented until milestone 3 lands. |

## Architecture / Design Snapshot

- The implementation should use one small internal representation so the same normalized token can drive chord dispatch and standalone press/release dispatch.
- Modifier-only transitions should remain explicit. Do not fake them by converting `keyDown("shift")` into a synthetic one-key `keySequence("shift")` if a clearer native path exists.
- Unknown tokens must continue to fail closed by doing nothing and allowing higher layers or tests to catch unsupported names.

## Workstreams & Tasks

### Workstream A – Native key resolution

| ID | Area | Description | Status |
|----|------|-------------|-------|
| A1 | Swift | Add the new key-code mappings for the agreed support set. | ⏳ |
| A2 | Swift | Support named punctuation and raw punctuation aliases. | ⏳ |
| A3 | Compatibility | Preserve existing `delete` behavior while adding `forward_delete`. | ⏳ |

### Workstream B – Modifier-safe transitions

| ID | Area | Description | Status |
|----|------|-------------|-------|
| B1 | Swift | Make standalone modifier tokens resolve through a first-class path. | ⏳ |
| B2 | Swift | Reuse the shared resolution model in `keySequence`, `keyDown`, and `keyUp`. | ⏳ |
| B3 | Validation | Keep the release build and existing fake-mode behavior working. | ⏳ |

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A refactor breaks existing basic keys while adding new ones. | High | Keep the old working keys in the same resolver table and add targeted tests for both old and new entries. |
| Modifier press/release behavior drifts from the existing event-flag behavior in `keySequence`. | High | Use one shared internal key model and compare the emitted modifier metadata in tests where possible. |
| Punctuation aliases become layout-sensitive in unexpected ways. | Med | Limit this milestone to keys with stable macOS virtual key codes and document that text entry still belongs to `typeText`. |

## Validation / QA Plan

- Run `swift test --package-path packages/native-swift` to exercise the new resolver and modifier logic.
- Run `swift build --package-path packages/native-swift -c release` to confirm the executable target still builds.
- Run `npm test` to ensure the TypeScript orchestration suite still passes after any nearby changes or test additions.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Filled in the implementation-focused scope, workstreams, and validation plan.
- 2026-04-02: Completed during native key support rollout and moved to `milestones/complete/`.
