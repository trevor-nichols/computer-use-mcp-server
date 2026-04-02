---
id: EP-20260401-002/MS003
execplan_id: EP-20260401-002
ms: 3
title: "Add regression coverage and capture host-awareness follow-on"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-01
tags:
- tests
- docs
- follow-on
risk: low
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Add regression coverage and capture host-awareness follow-on

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Lock the new behavior in with deterministic regression coverage and leave the next production gap, host/self-awareness in capture and hide flows, explicitly documented as follow-on work. After this milestone, the implementation is tested and the remaining scope is named precisely instead of being implied.

## Definition of Done

- Regression tests cover allowed and denied frontmost-app flows
- Regression tests cover allowed and denied app-under-point flows
- Fake mode remains deterministic under the new bridge surface
- The ExecPlan records host/self-awareness as explicit follow-on work
- `npm test` passes
- Milestone status is updated when the suite is green and documentation is current

## Scope

### In Scope
- Targeted test additions under `packages/computer-use-mcp/test`
- Final plan and milestone status updates
- Explicit follow-on notes for item 2 in `docs/target.md`

### Out of Scope
- Implementing host/self-awareness itself
- Adding more native key coverage

## Workstreams & Tasks

### Workstream A: Regression coverage

- [x] Add denied and allowed test cases for frontmost validation
- [x] Add denied and allowed test cases for app-under-point validation
- [x] Keep tests fake-mode friendly and transport-neutral

### Workstream B: Documentation close-out

- [x] Update ExecPlan progress, decisions, and outcomes
- [x] Mark milestone states accurately
- [x] Leave host/self-awareness as explicit next work

## Risks & Mitigations

- Risk: the new tests may become too coupled to implementation details in fake mode.
  Mitigation: assert observable tool behavior and structured error content rather than private helper internals.

## Validation / QA Plan

- Run `npm test` from the repository root.
- Confirm the new tests fail without the feature and pass with it.
- Confirm the ExecPlan and milestone files reflect the final state of the work.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Expanded milestone with explicit regression and follow-on documentation scope.
- 2026-04-01: Completed with `targetAppSafety.test.ts`, green validation, and explicit host/self-awareness follow-on notes in the ExecPlan.
