---
id: EP-20260401-001/MS001
execplan_id: EP-20260401-001
ms: 1
title: "Persist zoom capture geometry in session state"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-01
tags: [zoom, coordinates]
risk: med
links:
  issue: ""
  docs: ""
  pr: ""
---

# Persist zoom capture geometry in session state

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Make the session treat a zoom capture as the new screenshot coordinate source of truth. After this milestone, `zoom` stores cropped logical bounds in `session.lastScreenshotDims` and returns matching geometry in its structured response, while `screenshot` and `zoom` both use the same helper for geometry serialization.

## Definition of Done

- `packages/computer-use-mcp/src/tools/zoom.ts` persists cropped logical geometry into `session.lastScreenshotDims`
- `packages/computer-use-mcp/src/tools/screenshot.ts` and `zoom.ts` share one helper for `ScreenshotDims` construction
- `zoom` structured output exposes the same geometry fields that `screenshot` already returns
- Targeted tests covering geometry persistence pass
- `npm test` passes
- Milestone status is updated to `completed` and the file is moved under `milestones/complete/`

## Scope

### In Scope
- Add a shared helper for building `ScreenshotDims`
- Refactor `screenshot` to use that helper
- Update `zoom` to persist capture geometry based on the cropped logical region
- Keep session display bookkeeping aligned with `screenshot`

### Out of Scope
- Changing native zoom capture sizing policy
- Adding frontmost-app safety gates
- Adding host-aware capture exclusions

## Workstreams & Tasks

### Workstream A: Shared geometry helper

- [x] Add a helper module that converts a `CaptureResult` and optional logical region into `ScreenshotDims`
- [x] Update `screenshot` to use the helper for session persistence and structured output

### Workstream B: Zoom state persistence

- [x] Update `zoom` to store the cropped logical region in session state
- [x] Return the persisted geometry fields from `zoom` structured output
- [x] Ensure `selectedDisplayId` and `displayResolvedForAppsKey` stay in sync after zoom

## Risks & Mitigations

- Risk: zoom captures already upscale the cropped region to a target image size, so using the wrong width and height source would introduce a new transform bug.
  Mitigation: use the capture result's returned image dimensions and only swap the logical origin and logical size for the cropped region.

## Validation / QA Plan

- Run the new targeted zoom regression test file once it exists.
- Run `npm test` from the repository root.
- Confirm the tests prove that the stored `lastScreenshotDims` logical region changes after zoom.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Expanded milestone with the chosen shared-helper and cropped-region persistence design.
- 2026-04-01: Completed by adding `createScreenshotDims()` in `src/transforms/coordinates.ts` and wiring `screenshot.ts` and `zoom.ts` through it.
