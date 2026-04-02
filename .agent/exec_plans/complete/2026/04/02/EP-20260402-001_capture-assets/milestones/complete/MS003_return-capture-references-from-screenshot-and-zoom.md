---
id: EP-20260402-001/MS003
execplan_id: EP-20260402-001
ms: 3
title: "Return capture references from screenshot and zoom"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-02
updated: 2026-04-02
tags: [capture, tools]
risk: med
links:
  issue: ""
  docs: ".agent/exec_plans/complete/2026/04/02/EP-20260402-001_capture-assets/EP-20260402-001_capture-assets.md"
  pr: ""
---

# Return capture references from screenshot and zoom

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Upgrade the capture tools to mint session-scoped assets and return those references to clients. When this milestone is done, `screenshot` and `zoom` will keep the geometry contract intact while adding `captureId`, `assetUri`, and `resource_link` output, with inline image bytes controlled by a compatibility flag.

## Definition of Done

- `screenshot` and `zoom` create capture assets after every successful capture
- `structuredContent` includes `captureId` and `assetUri`
- `content` includes a `resource_link` item and a text summary
- Inline `image` content is emitted only when `COMPUTER_USE_CAPTURE_INLINE_IMAGE=true`
- Geometry and exclusion metadata remain unchanged
- Regression tests cover both compatibility modes

## Scope

### In Scope
- Update `screenshot.ts` and `zoom.ts`
- Add output schema updates if needed for the new structured result shape
- Add compatibility-flag handling through `RuntimeConfig`
- Extend end-to-end tests to assert the new reference contract

### Out of Scope
- Removing the compatibility flag entirely
- Implementing host-side promotion helpers
- Changing coordinate-transform behavior

## Workstreams & Tasks

### Workstream A: Tool result contract

- [ ] Mint a capture asset from `screenshot`
- [ ] Mint a capture asset from `zoom`
- [ ] Return `captureId`, `assetUri`, and `resource_link`

### Workstream B: Compatibility and regressions

- [ ] Add `COMPUTER_USE_CAPTURE_INLINE_IMAGE`
- [ ] Keep the current inline image path behind that flag
- [ ] Extend tests to cover both metadata and resource-link behavior

## Risks & Mitigations

- Risk: changing the tool output shape could break clients that assume the first content item is always an image.
  Mitigation: keep the inline image path enabled by default during this ExecPlan and make the new reference fields additive.

- Risk: the asset write path could drift from the screenshot geometry path and break coordinate transforms.
  Mitigation: mint the asset after capture but before returning, and continue to use the existing `createScreenshotDims()` path as the single geometry source of truth.

## Validation / QA Plan

- Run `npm run build`.
- Run targeted screenshot/zoom tests plus the stdio and HTTP end-to-end tests.
- Verify that `structuredContent` never contains raw image bytes and that `captureId` plus `assetUri` are present.

## Changelog

- 2026-04-02: Milestone created.
- 2026-04-02: Expanded milestone with the additive reference contract and compatibility-flag rollout design.
- 2026-04-02: Completed by minting capture assets in `screenshot.ts` and `zoom.ts`, returning `captureId` plus `assetUri`, adding `resource_link` content, and covering the new contract in regression tests.
