---
id: EP-20260401-003/MS002
execplan_id: EP-20260401-003
ms: 2
title: "Wire host-aware capture and hide behavior"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-01
tags: [host, capture]
risk: med
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Wire host-aware capture and hide behavior

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Teach screenshot-style tools to exclude the host from capture where supported without ever hiding the host as part of pre-action or fallback cleanup. After this milestone, the host will be a special capture-only exclusion target, not just another entry in the generic disallowed-app hide list.

## Definition of Done

- `captureScope.ts` and `actionScope.ts` compute separate lists for screenshot exclusion and fallback hiding.
- Host bundles are never hidden by `hideDisallowedBeforeAction` or `captureWithFallback()`.
- Screenshot and zoom calls include host bundle exclusion whenever a host identity is known.
- Targeted tests prove the host remains excluded from capture but absent from fallback hide sets.
- Parent ExecPlan progress is updated with the implementation and validation result.

## Scope

### In Scope
- Refactor prepared capture state in `actionScope.ts`.
- Update `captureScope.ts` so screenshot-style tools always opt into host screenshot exclusion.
- Update `captureWithFallback.ts` to hide only the explicitly hideable subset.
- Add unit tests for host-aware capture preparation and fallback behavior.

### Out of Scope
- Host-aware target-app error messaging.
- Any new native screenshot API; the milestone will reuse the existing `excludeBundleIds` bridge support.

## Current Health Snapshot

| Area | Status | Notes |
| --- | --- | --- |
| Architecture/design | ✅ | The host exclusion vs fallback-hide split landed as planned. |
| Implementation | ✅ | Capture preparation now tracks screenshot exclusions separately from hideable fallbacks. |
| Tests & QA | ✅ | Action-scope and capture fallback tests cover host handling. |
| Docs & runbooks | ✅ | No rollout changes were needed. |

## Architecture / Design Snapshot

- `PreparedActionContext` will separate "exclude from screenshot" from "eligible for fallback hiding."
- Host bundles enter only the screenshot exclusion set.
- Disallowed app bundles may still enter both sets depending on configuration and visibility on the target display.
- Older macOS behavior remains additive: if ScreenCaptureKit exclusion is unavailable, the host simply stays visible instead of being hidden.

## Workstreams & Tasks

### Workstream A – Capture state refactor

| ID | Area | Description | Status |
|----|------|-------------|-------|
| A1 | Action scope | Split screenshot exclusions from fallback-hide candidates. | ✅ |
| A2 | Capture scope | Ensure screenshot and zoom opt into host exclusion. | ✅ |
| A3 | Fallback | Restrict fallback hiding to explicitly hideable bundles only. | ✅ |

### Workstream B – Regression coverage

| ID | Area | Description | Status |
|----|------|-------------|-------|
| B1 | Unit tests | Add tests for host exclusion without hiding. | ✅ |
| B2 | Logging | Preserve structured warnings for fallback capture failures. | ✅ |

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Refactoring `PreparedActionContext` can ripple into screenshot and zoom tests. | Med | Update type consumers together and keep coverage focused on observable bundle lists. |
| Host exclusion may force ScreenCaptureKit on systems where exclusion is unsupported. | Med | Preserve the current fallback path but ensure the host is never hidden there. |

## Validation / QA Plan

- Run targeted capture tests and then `npm test`.
- Inspect the new tests to verify the first capture attempt receives the host bundle in `excludeBundleIds`.
- Verify that `hideApplications()` is never called with the host bundle during fallback scenarios.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Filled in milestone scope, design, and validation plan.
- 2026-04-01: Completed the capture-state refactor and host-aware fallback coverage.
