---
id: EP-20260401-001
title: Fix zoom coordinate drift
status: archived
kind: bugfix
domain: backend
owner: '@codex'
created: 2026-04-01
updated: '2026-04-01'
tags:
- zoom
- coordinates
- screenshots
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
  docs: ''
depends_on: []
supersedes: []
---

# EP-20260401-001 - Fix zoom coordinate drift

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date as work proceeds.

If `.agent/PLANS.md` exists in this repository, maintain this plan in accordance with that guidance.

## Purpose / Big Picture

After this change, a model can take a full screenshot, zoom into a smaller region, and then click, drag, move, scroll, or zoom again using coordinates from that zoomed image without the cursor drifting back toward the old full-screen coordinate space. A human can verify the fix by running the new regression tests and observing that post-zoom action tools map into the cropped logical region rather than the stale prior screenshot.

## Scope

In scope are the TypeScript-side state and transform changes required to treat a zoom capture as the new coordinate source of truth for the session. That includes shared screenshot geometry helpers, updating `zoom` to persist cropped logical bounds, and adding regression tests that cover nested zoom math plus post-zoom click and drag behavior.

Out of scope are changes to the native capture stack, changes to target image sizing policy, host-awareness work, or frontmost-app safety gates. The fix must preserve the current transport and tool contracts and remain compatible with fake mode.

## Progress

- [x] (2026-04-01 23:23Z) Investigated the current screenshot and zoom path in `packages/computer-use-mcp/src/tools/screenshot.ts`, `packages/computer-use-mcp/src/tools/zoom.ts`, `packages/computer-use-mcp/src/transforms/coordinates.ts`, and `packages/native-swift/Sources/ComputerUseBridge/ScreenshotService.swift`.
- [x] (2026-04-01 23:23Z) Confirmed the root cause: full screenshots persist `session.lastScreenshotDims`, but zoom captures return an image without replacing that session geometry, so later actions continue to map against the previous full-screen logical bounds.
- [x] (2026-04-01 23:27Z) Added `createScreenshotDims()` to `packages/computer-use-mcp/src/transforms/coordinates.ts` and refactored both `screenshot` and `zoom` to use one geometry serialization path.
- [x] (2026-04-01 23:27Z) Updated `zoom` to persist cropped logical bounds into `session.lastScreenshotDims`, keep display bookkeeping aligned, and return geometry fields in `structuredContent`.
- [x] (2026-04-01 23:27Z) Expanded `packages/computer-use-mcp/test/coordinates.test.ts` with nested zoom, post-zoom click, and post-zoom drag regression coverage.
- [x] (2026-04-01 23:27Z) Ran `node --test dist/computer-use-mcp/test/coordinates.test.js` and `npm test`; both passed.

## Surprises & Discoveries

- Observation: native zoom captures are already intentionally scaled to a target image size rather than preserving the cropped region's raw pixel size.
  Evidence: `ScreenshotService.capture()` defaults `targetWidth` and `targetHeight` to the display dimensions when the caller does not provide explicit values, and `zoomTool` currently omits those fields. See `packages/native-swift/Sources/ComputerUseBridge/ScreenshotService.swift`.

## Decision Log

- Decision: fix the regression by persisting the zoom image dimensions together with the cropped logical region origin and size, instead of changing the native capture size policy.
  Rationale: the bug is stale session geometry, not an invalid image. Preserving the current zoom image sizing avoids unrelated behavior changes while making all later coordinate transforms use the correct logical region.
  Date/Author: 2026-04-01 / @codex

- Decision: introduce a shared helper for screenshot geometry so full screenshots and zoom captures serialize the same shape into session state and structured output.
  Rationale: screenshot and zoom should not hand-roll slightly different `ScreenshotDims` payloads. A single helper reduces drift and makes the regression tests easier to reason about.
  Date/Author: 2026-04-01 / @codex

- Decision: place the shared helper in `packages/computer-use-mcp/src/transforms/coordinates.ts` instead of adding a new file.
  Rationale: the helper is part of the screenshot-to-desktop geometry model, and reusing the existing geometry module avoids unnecessary file churn while keeping the logic in one obvious place.
  Date/Author: 2026-04-01 / @codex

## Outcomes & Retrospective

The zoom coordinate drift bug is fixed. After a zoom capture, the session now stores the returned image dimensions together with the cropped logical region origin and size, so later action tools map through the zoomed region instead of the previous full screenshot. `zoom` now returns the same geometry fields as `screenshot`, which keeps the tool output machine-usable and aligned with session state.

The regression coverage is strong for this bug scope. The updated coordinate test file now proves that a second zoom uses the first zoom's logical region, that `left_click` lands at the expected desktop point after zoom, and that `left_click_drag` maps both endpoints through the zoomed logical region. The full suite passed with 39 tests.

## Context and Orientation

The desktop automation server lives under `packages/computer-use-mcp`. Each tool handler receives a `ToolExecutionContext` with the active `SessionContext`, and the session stores `lastScreenshotDims` in `packages/computer-use-mcp/src/session/sessionContext.ts`. That object describes how to map model-visible image coordinates back into desktop logical coordinates. The mapping functions live in `packages/computer-use-mcp/src/transforms/coordinates.ts`.

The `screenshot` tool in `packages/computer-use-mcp/src/tools/screenshot.ts` already captures the current display and then stores `lastScreenshotDims` using the returned image width and height plus the full display logical origin and size. The `zoom` tool in `packages/computer-use-mcp/src/tools/zoom.ts` already converts the requested zoom rectangle from the previous screenshot coordinate space into desktop logical coordinates before calling the native capture bridge, but it never replaces `lastScreenshotDims` with the new cropped logical region. Because `left_click`, `left_click_drag`, `mouse_move`, and `scroll` all call `mapScreenshotPointToDesktop()` with `session.lastScreenshotDims`, they continue to target the stale full-screen geometry after a zoom.

The native capture bridge in `packages/native-swift/Sources/ComputerUseBridge/ScreenshotService.swift` is important context. When a region capture does not specify `targetWidth` and `targetHeight`, it still renders the cropped content into a display-sized output image. That means the correct representation of a zoom image is: image width and height from the capture result, plus logical origin and logical size from the cropped region. This plan intentionally preserves that behavior.

## Plan of Work

First, add a shared helper in the TypeScript tool layer that converts a `CaptureResult` plus an optional logical region into a `ScreenshotDims` object. When no logical region is provided, it should describe the full display exactly the way `screenshot` already does today. When a logical region is provided, it should keep the capture image width and height but replace `originX`, `originY`, `logicalWidth`, and `logicalHeight` with the cropped logical bounds.

Next, update `packages/computer-use-mcp/src/tools/screenshot.ts` to use that helper for both session persistence and structured output. Then update `packages/computer-use-mcp/src/tools/zoom.ts` to map the requested rectangle through the current session geometry, capture the cropped region, build the new screenshot geometry from that logical region, store it in `session.lastScreenshotDims`, and return the same geometry fields in `structuredContent`. Also keep `selectedDisplayId` and `displayResolvedForAppsKey` aligned with the capture, the same way `screenshot` already does.

Finally, add regression tests in `packages/computer-use-mcp/test` that prove three behaviors. First, a second `zoom` maps its region through the previous zoom rather than the original full screenshot. Second, `left_click` after a zoom uses the cropped logical bounds. Third, `left_click_drag` after a zoom maps both the start and end points through the cropped logical bounds. The tests should run in fake mode with a stubbed screenshot bridge so they remain deterministic and do not depend on macOS screen capture.

## Milestones

### Milestone 1: Persist zoom capture geometry in session state

At the end of this milestone, both full screenshots and zoom captures serialize geometry through the same helper, and a zoom capture becomes the active coordinate source for subsequent tools in the session. Verification is by running the new geometry-focused tests and observing that `session.lastScreenshotDims` changes from full-display bounds to cropped logical bounds after `zoom`.

### Milestone 2: Add post-zoom action regression coverage

At the end of this milestone, the test suite demonstrates that click, drag, and nested zoom operations all use the post-zoom geometry instead of the stale full screenshot geometry. Verification is by running the new targeted tests and then `npm test` from the repository root.

## Validation

From `/Volumes/AGENAI/Coding/public-github/computer-use-mcp-server`, run:

  npm test

Green means the new regression tests pass together with the existing suite. The most important observable proof is that the added tests assert post-zoom coordinates land inside the cropped logical region rather than the original full-display bounds.
