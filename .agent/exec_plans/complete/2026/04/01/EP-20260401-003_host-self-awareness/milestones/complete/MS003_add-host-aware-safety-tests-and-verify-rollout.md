---
id: EP-20260401-003/MS003
execplan_id: EP-20260401-003
ms: 3
title: "Add host-aware safety tests and verify rollout"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-01
tags: [host, safety, tests]
risk: med
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Add host-aware safety tests and verify rollout

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Close the loop on host self-awareness by making the existing target-app safety gates explain when the host has become the accidental target and by proving the whole feature set with deterministic regression coverage. After this milestone, the rollout story is simple: host identity resolves per session, capture treats the host specially, and action tools fail closed with clear host-aware messaging.

## Definition of Done

- `frontmostGate.ts` detects host-target collisions and returns a host-specific fail-closed message when the host is not intentionally granted.
- Tests cover frontmost-host and under-point-host cases.
- `npm test` passes.
- `swift build --package-path packages/native-swift -c release` passes.
- The parent ExecPlan and milestone files reflect the final status and any remaining follow-on work.

## Scope

### In Scope
- Update host-aware error messaging in the frontmost / under-point safety helper.
- Add tests for click, scroll, key, or type flows where the host is the accidental target.
- Complete project verification and finish ExecPlan bookkeeping.

### Out of Scope
- Automatic focus switching away from the host.
- Broader keyboard coverage work from `docs/target.md`.

## Current Health Snapshot

| Area | Status | Notes |
| --- | --- | --- |
| Architecture/design | ✅ | The milestone reused the existing target-app safety gate layer. |
| Implementation | ✅ | `frontmostGate.ts` now emits host-specific fail-closed messages. |
| Tests & QA | ✅ | Host-target safety regressions plus full repo verification are green. |
| Docs & runbooks | ✅ | Parent ExecPlan and milestones reflect the final state. |

## Architecture / Design Snapshot

- Host awareness will stay inside `frontmostGate.ts`, not spread across each tool.
- Existing typed errors can carry host-specific messages unless a stronger machine-level distinction becomes necessary during implementation.
- The milestone should add only enough messaging to make accidental host targeting explicit and debuggable.

## Workstreams & Tasks

### Workstream A – Host-aware safety messaging

| ID | Area | Description | Status |
|----|------|-------------|-------|
| A1 | Safety helper | Detect host-target collisions in `frontmostGate.ts`. | ✅ |
| A2 | Tool behavior | Keep tool call sites unchanged aside from helper output. | ✅ |

### Workstream B – Verification

| ID | Area | Description | Status |
|----|------|-------------|-------|
| B1 | Tests | Add host-target regression cases to `targetAppSafety.test.ts` or a sibling file. | ✅ |
| B2 | Build | Run `npm test` and Swift release build. | ✅ |
| B3 | Docs | Update ExecPlan progress, outcomes, and milestone statuses. | ✅ |

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Host-specific messages could become inconsistent across frontmost and point-targeted flows. | Low | Centralize the logic in `frontmostGate.ts`. |
| Verification may miss a regression in the native package even though the host feature is TypeScript-heavy. | Med | Run the Swift release build before closing the plan. |

## Validation / QA Plan

- Run the new host-target safety tests and then `npm test`.
- Build the Swift bridge with `swift build --package-path packages/native-swift -c release`.
- Green means the host-awareness follow-on did not regress the earlier target-app safety rollout.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Filled in milestone scope, design, and validation plan.
- 2026-04-01: Completed host-aware safety messaging, verification, and plan closeout.
