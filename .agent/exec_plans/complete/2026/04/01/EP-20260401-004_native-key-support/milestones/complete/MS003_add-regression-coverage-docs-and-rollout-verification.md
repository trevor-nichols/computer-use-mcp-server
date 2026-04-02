---
id: EP-20260401-004/MS003
execplan_id: EP-20260401-004
ms: 3
title: "Add regression coverage, docs, and rollout verification"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-02
tags:
- tests
- docs
- validation
risk: med
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Add regression coverage, docs, and rollout verification

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Turn the new key support into a verifiable contract. At the end of this milestone, the repository will have direct tests that guard the supported key set, the target document will describe that set explicitly, and the validation docs will match the real commands and expected outcomes for the new native-key behavior.

## Definition of Done

- Swift tests cover the newly supported keys, aliases, and modifier-only transitions.
- Any needed TypeScript regressions around `hold_key` orchestration or Escape handling are in place.
- `docs/target.md` replaces the vague bullet with the explicit supported key list and non-goals.
- `VALIDATION.md` reflects the actual suite counts and the added Swift test command.
- Any affected snapshot artifacts are updated if this work adds new files such as `packages/native-swift/Tests/...`.

## Scope

### In Scope
- Add or refine Swift and TypeScript regression tests for the new key contract.
- Update `docs/target.md` and `VALIDATION.md`.
- Update `SNAPSHOT.md` and `packages/SNAPSHOT.md` if the package structure changes.
- Run the repository validation commands and record what green looks like.

### Out of Scope
- Additional key-set expansion beyond the contract established in the parent ExecPlan.
- Broader manual QA across many native apps beyond one concise smoke check if needed.
- Any unrelated refactors in `packages/computer-use-mcp` or the Swift bridge.

## Current Health Snapshot

| Area | Status | Notes |
| --- | --- | --- |
| Architecture/design | ✅ | The support contract should already be frozen by milestones 1 and 2. |
| Implementation | ⏳ | The native behavior may be in place, but it is not yet locked down by repo docs and validation artifacts. |
| Tests & QA | ⏳ | This milestone is responsible for making the behavior provable. |
| Docs & runbooks | ⏳ | `VALIDATION.md` is already stale on suite count and needs to be refreshed anyway. |

## Architecture / Design Snapshot

- Swift tests are the source of truth for native key resolution.
- TypeScript tests remain the source of truth for orchestration and fail-closed behavior.
- The target document should describe the support contract, while the ExecPlan preserves the implementation rationale and staged rollout story.

## Workstreams & Tasks

### Workstream A – Regression coverage

| ID | Area | Description | Status |
|----|------|-------------|-------|
| A1 | Swift tests | Cover new keys, aliases, and standalone modifier transitions. | ⏳ |
| A2 | TypeScript tests | Add any narrow regression checks needed around `hold_key` and existing escape/safety behavior. | ⏳ |
| A3 | Validation | Run the full build and test commands and capture the expected green path. | ⏳ |

### Workstream B – Documentation and artifacts

| ID | Area | Description | Status |
|----|------|-------------|-------|
| B1 | Target doc | Replace vague wording in `docs/target.md` with the concrete key contract. | ⏳ |
| B2 | Validation doc | Refresh `VALIDATION.md` so test counts and commands match reality. | ⏳ |
| B3 | Snapshot docs | Update snapshot artifacts if the Swift package gains a `Tests` directory. | ⏳ |

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The implementation lands but the docs remain vague, recreating the original problem. | Med | Treat the target-doc update as a hard definition-of-done item, not optional polish. |
| Swift tests pass locally but the existing TypeScript suite regresses. | Med | Run the full root `npm test` command in addition to Swift-specific validation. |
| Snapshot docs drift if a new Swift test target adds files. | Low | Update `SNAPSHOT.md` and `packages/SNAPSHOT.md` in the same milestone when structure changes. |

## Validation / QA Plan

- Run `npm test` from the repo root and confirm all built JavaScript tests pass.
- Run `swift test --package-path packages/native-swift` and confirm the new native-key tests pass.
- Run `swift build --package-path packages/native-swift -c release` and `swift build --package-path packages/approval-ui-macos -c release` to confirm the release builds still work.
- If a short manual smoke is needed on a Mac, focus a granted app and verify that one function key, one page-navigation key, one punctuation shortcut key, and one standalone modifier hold no longer silently no-op.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Filled in the coverage, documentation, and validation scope.
- 2026-04-02: Completed during native key support rollout and moved to `milestones/complete/`.
