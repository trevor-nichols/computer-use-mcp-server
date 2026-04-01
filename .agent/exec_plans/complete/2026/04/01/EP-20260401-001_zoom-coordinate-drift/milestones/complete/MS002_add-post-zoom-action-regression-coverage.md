---
id: EP-20260401-001/MS002
execplan_id: EP-20260401-001
ms: 2
title: "Add post-zoom action regression coverage"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-01
tags: [zoom, tests, regression]
risk: low
links:
  issue: ""
  docs: ""
  pr: ""
---

# Add post-zoom action regression coverage

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Add deterministic tests that fail if the session ever maps post-zoom actions or nested zooms through stale full-screen geometry again. This milestone proves the bug is fixed in behavior, not just in data shape.

## Definition of Done

- A test covers a second zoom mapping through the first zoom's logical region
- A test covers `left_click` after zoom and asserts the mapped desktop point
- A test covers `left_click_drag` after zoom and asserts the mapped start and end points
- `npm test` passes
- Milestone status is updated to `completed` and the file is moved under `milestones/complete/`

## Scope

### In Scope
- Add a new regression-focused test file under `packages/computer-use-mcp/test`
- Use a stubbed fake runtime to control capture geometry and input calls
- Validate nested zoom and post-zoom action coordinates with exact numeric assertions

### Out of Scope
- macOS-native end-to-end UI tests
- Snapshot or screenshot image content assertions
- Key, scroll, or type regression coverage for this bugfix

## Workstreams & Tasks

### Workstream A: Nested zoom regression

- [x] Add a helper runtime for deterministic screenshot and input behavior
- [x] Assert that a second zoom uses the first zoom's logical region as its input space

### Workstream B: Action regression

- [x] Assert `left_click` maps into the zoomed logical region
- [x] Assert `left_click_drag` maps both endpoints into the zoomed logical region
- [x] Run the targeted file and the full test suite

## Risks & Mitigations

- Risk: tests that depend on current timing or animation details could become flaky.
  Mitigation: assert the deterministic mapped coordinates and returned structured payloads instead of every intermediate mouse movement step.

## Validation / QA Plan

- Run the new regression file directly with Node's test runner after build if targeted iteration is needed.
- Run `npm test` from the repository root for the final pass.
- Green means the new tests prove nested zoom, click, and drag all use the zoomed logical region.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Expanded milestone with deterministic regression coverage goals for nested zoom and post-zoom actions.
- 2026-04-01: Completed by extending `packages/computer-use-mcp/test/coordinates.test.ts` and validating with the targeted file plus `npm test`.
