---
id: EP-20260401-004/MS001
execplan_id: EP-20260401-004
ms: 1
title: "Define explicit key vocabulary and alias policy"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-02
tags:
- keyboard
- docs
- native
risk: med
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Define explicit key vocabulary and alias policy

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Replace the vague open-ended target item with one explicit supported-key contract and one explicit alias policy. At the end of this milestone, a future implementer should not have to guess what "more navigation and symbol keys" means, and the native Swift code should have a single normalization layer that reflects the agreed spellings even if the full event-emission wiring lands in the next milestone.

## Definition of Done

- `docs/target.md` names the exact keys and aliases the server intends to support instead of generic wording.
- `packages/native-swift/Sources/ComputerUseBridge` has one obvious normalization/resolution layer or table that future milestones can build on.
- The additive compatibility rule for `delete` versus `forward_delete` is documented.
- System/media keys and optional second-tier keys are explicitly called out as out of scope.
- Any new Swift-side tests added for normalization or alias resolution pass.
- The parent ExecPlan reflects the final vocabulary and any decisions made while defining it.

## Scope

### In Scope
- Define canonical key names for navigation, function, numpad, punctuation, and modifiers.
- Define accepted aliases such as `page_up`, `left_arrow`, raw punctuation spellings, and `meta` / `super` / `windows`.
- Introduce the Swift normalization layer or token resolver that maps raw input strings into a small internal key model.
- Update documentation that currently uses generic language for this work item.

### Out of Scope
- Posting the final CG events for every newly supported key.
- Broad system/media keys from Claude Code's native module.
- New MCP tools, new input schemas, or a move into `packages/native-input`.

## Current Health Snapshot

| Area | Status | Notes |
| --- | --- | --- |
| Architecture/design | ⏳ | The agreed contract exists in discussion but not yet in repo docs. |
| Implementation | ⏳ | `InputService.swift` still mixes parsing, mapping, and event posting in one file-local switch. |
| Tests & QA | ⏳ | There is no Swift test target yet for native key normalization. |
| Docs & runbooks | ⚠️ | `docs/target.md` still says "more navigation and symbol keys". |

## Architecture / Design Snapshot

- Canonical documentation names stay lowercase and additive so callers can continue using today's working spellings.
- Alias handling belongs in the native Swift layer because that is where raw key tokens are resolved today.
- The milestone should produce one small internal model that distinguishes regular keys from modifiers before event emission logic gets more complex.

## Workstreams & Tasks

### Workstream A – Contract definition

| ID | Area | Description | Status |
|----|------|-------------|-------|
| A1 | Docs | Replace the generic target bullet with the explicit key list and alias policy. | ⏳ |
| A2 | Compatibility | Document that `delete` remains backward delete and `forward_delete` is additive. | ⏳ |
| A3 | Scope | Record which Claude-style keys remain intentionally out of scope. | ⏳ |

### Workstream B – Native normalization scaffold

| ID | Area | Description | Status |
|----|------|-------------|-------|
| B1 | Swift | Introduce a normalized key-token representation in `InputService.swift` or a nearby helper file. | ⏳ |
| B2 | Tests | Add Swift tests or equivalent resolution checks for aliases and documented spellings. | ⏳ |

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The milestone becomes docs-only and leaves the next milestone with ambiguous code scaffolding. | Med | Require a real normalization/resolution layer, not just prose changes. |
| Alias growth becomes inconsistent or ad hoc. | Med | Define one canonical list in the parent ExecPlan and point both docs and tests at that list. |
| A compatibility shortcut accidentally changes `delete` semantics. | High | Freeze `delete` as backward delete in writing before any code refactor lands. |

## Validation / QA Plan

- Run `swift test --package-path packages/native-swift` if a new test target is added in this milestone.
- Run `swift build --package-path packages/native-swift -c release` to ensure the normalization refactor does not break the executable target.
- Review `docs/target.md` and the parent ExecPlan to confirm the support set is explicit and identical in both places.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Filled in the explicit contract-definition scope, risks, and validation strategy.
- 2026-04-02: Completed during native key support rollout and moved to `milestones/complete/`.
