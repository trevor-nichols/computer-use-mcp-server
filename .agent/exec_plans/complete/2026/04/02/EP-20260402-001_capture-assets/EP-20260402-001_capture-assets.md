---
id: EP-20260402-001
title: Session-scoped capture files and Codex image-path delivery
status: archived
kind: feature
domain: backend
owner: '@codex'
created: 2026-04-02
updated: '2026-04-02'
tags:
- capture
- codex
- images
touches:
- api
- tests
- docs
risk: med
breaking: true
migration: true
links:
  issue: ''
  pr: ''
  docs: docs/capture-asset-reference-execution-plan.md
depends_on: []
supersedes: []
---

# EP-20260402-001 - Session-scoped capture files and Codex image-path delivery

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date as work proceeds.

If `.agent/PLANS.md` exists in this repository, maintain this plan in accordance with that guidance.

## Purpose / Big Picture

`screenshot` and `zoom` now target one concrete consumer model: Codex-style agents that already have a local image-view tool. The server writes each capture to a session-scoped file on disk, returns the absolute `imagePath` in `structuredContent`, and expects the caller to follow with `view_image(imagePath)`.

This intentionally replaces the earlier generic MCP asset-URI design. That design proved unnecessary for the actual target environment and made the contract harder to understand. For this repo, a local file path is the correct long-term interface because the agent and the MCP server already share a filesystem and the image-perception step is explicit in the agent runtime.

## Scope

In scope are the TypeScript runtime changes inside `packages/computer-use-mcp` required to persist capture files on disk, return `imagePath` from `screenshot` and `zoom`, keep session-scoped cleanup for HTTP session expiry and process shutdown, and remove the unneeded `resources/*` and inline-image compatibility surface that was briefly added during the earlier design iteration.

Out of scope is automatic viewer invocation inside the MCP server. The server returns the file path; the agent runtime remains responsible for calling its own `view_image` tool.

## Progress

- [x] (2026-04-02 13:26Z) Reviewed `.agent/PLANS.md`, the milestone template, and the earlier draft in `docs/capture-asset-reference-execution-plan.md`.
- [x] (2026-04-02 13:26Z) Audited `src/main.ts`, `src/mcp/server.ts`, `src/mcp/streamableHttpTransport.ts`, `src/mcp/stdioTransport.ts`, `src/session/sessionStore.ts`, `src/session/sessionContext.ts`, and the screenshot/zoom tool path to map the current capture lifecycle.
- [x] (2026-04-02 13:42Z) Implemented a session-scoped capture store and wired deterministic cleanup into HTTP session deletion, stale-session cleanup, and process shutdown.
- [x] (2026-04-02 13:42Z) Implemented an intermediate MCP resource-based asset flow and validated it end to end.
- [x] (2026-04-02 14:05Z) Reassessed the target consumer contract with the user and recorded the pivot to Codex-specific local image paths.
- [x] (2026-04-02 14:12Z) Replaced `assetUri` and `resource_link` outputs with `imagePath`, removed `resources/list` and `resources/read`, removed the inline-image compatibility flag, and kept the file-backed store only for lifecycle management.
- [x] (2026-04-02 14:13Z) Updated regression coverage for the new path-based contract and verified `npm run build` plus `npm test`.

## Surprises & Discoveries

- Observation: the earlier resource-based design solved a portability problem this repo does not actually have.
  Evidence: the user clarified that every supported consumer is a Codex-style agent with a guaranteed `view_image` tool and direct filesystem access.

- Observation: the useful part of the earlier work was the file-backed capture lifecycle, not the MCP resource surface layered on top of it.
  Evidence: once the target contract was narrowed, the asset store remained the right place to write and clean up files, while `resource_link`, `assetUri`, and `resources/read` all became redundant.

- Observation: the capture tools did not need any geometry-model changes for this pivot.
  Evidence: `session.lastScreenshotDims`, zoom mapping, and click/drag transforms continued to pass unchanged once only the delivery contract changed.

## Decision Log

- Decision: optimize the capture contract for Codex-style agents only.
  Rationale: that is the actual supported environment, and a narrower contract is clearer, easier to test, and easier for users to reason about than a speculative multi-client abstraction.
  Date/Author: 2026-04-02 / @codex

- Decision: keep the file-backed capture store and session cleanup hooks.
  Rationale: even in the Codex-only design, the server still needs deterministic file creation, indexing, and cleanup across session expiry, explicit HTTP teardown, and process shutdown.
  Date/Author: 2026-04-02 / @codex

- Decision: remove MCP `resources/*`, `assetUri`, `resource_link`, and `COMPUTER_USE_CAPTURE_INLINE_IMAGE`.
  Rationale: each of those surfaces existed only to support the discarded generic asset-delivery path and would now make the server contract more confusing without providing value.
  Date/Author: 2026-04-02 / @codex

- Decision: make `imagePath` the primary machine-usable capture output.
  Rationale: the agent runtime already knows how to turn a local path into perception through `view_image`, which is the explicit and correct image-consumption step for this environment.
  Date/Author: 2026-04-02 / @codex

## Outcomes & Retrospective

The landed contract is simpler than the intermediate design. `screenshot` and `zoom` now save the capture to a session-scoped file, return `captureId`, `imagePath`, `mimeType`, and the existing geometry metadata, and emit only a text content item that tells the caller to inspect the saved file with its image-viewer tool.

The file-backed store, HTTP cleanup hooks, and shutdown cleanup remain valuable and are part of the final design. The generic MCP resource layer is not. Milestones 2 through 4 from the earlier iteration should be read as superseded history, not as the current target shape.

## Context and Orientation

The capture path starts in `packages/computer-use-mcp/src/tools/screenshot.ts` and `packages/computer-use-mcp/src/tools/zoom.ts`. Both tools call `captureWithFallback()` to reach the native screenshot bridge, then persist logical geometry into `session.lastScreenshotDims` so follow-on coordinate transforms stay correct.

Capture files are managed by `packages/computer-use-mcp/src/assets/captureAssetStore.ts`. The store decodes native base64 output into bytes, writes a file under a process-owned root, indexes that file by session and capture ID, and exposes cleanup methods used by HTTP session teardown and process shutdown.

Transport lifecycle still matters. `packages/computer-use-mcp/src/mcp/streamableHttpTransport.ts` is responsible for stale-session cleanup and explicit `DELETE /mcp` teardown, while `packages/computer-use-mcp/src/mcp/stdioTransport.ts` keeps a single connection alive until process exit. `packages/computer-use-mcp/src/main.ts` coordinates final cleanup for both modes.

## Target Contract

After the pivot, `screenshot` and `zoom` return `structuredContent` shaped like this:

- `ok: true`
- `captureId`
- `imagePath`
- `mimeType`
- the existing screenshot geometry fields used by coordinate transforms
- `excludedBundleIds`

The `content` array contains one text item that points the caller at `imagePath` and tells it to use its image-viewer tool. There is no inline image block and no MCP resource link.

The intended consumer flow is:

1. Call `screenshot` or `zoom`.
2. Read `structuredContent.imagePath`.
3. Call `view_image(imagePath)`.

## Plan of Work

First, keep the file-backed capture store as the server-owned lifecycle manager. It remains responsible for decoding bytes, writing files, indexing them by session, and cleaning them up deterministically.

Second, make `imagePath` the capture contract for `screenshot` and `zoom`. The tools continue to update `session.lastScreenshotDims`, but the returned machine-usable field becomes the absolute file path rather than a transport-level asset reference.

Third, remove the now-unneeded protocol and compatibility surface. `server.ts` no longer advertises or handles MCP resources, and `config.ts` no longer exposes `COMPUTER_USE_CAPTURE_INLINE_IMAGE`.

Fourth, update the docs and tests so the repo consistently describes and verifies the Codex-only `view_image(imagePath)` workflow.

## Milestones

### Milestone 1: Build the session-scoped capture store

Implemented. The server writes captures to a process-owned root and cleans them up deterministically.

### Milestone 2: Expose capture assets through MCP resources

Implemented as an intermediate step, then superseded by the Codex-only pivot.

### Milestone 3: Return capture references from screenshot and zoom

Implemented as an intermediate step, then superseded by the Codex-only pivot.

### Milestone 4: Document host-side promotion and retire the compatibility path

Superseded. The final contract no longer uses a host-side promotion layer in this repo; it uses `imagePath` plus the caller's existing `view_image` tool.

### Milestone 5: Pivot capture delivery to Codex image paths

Implemented. The server now returns `imagePath` directly and no longer exposes the generic asset URI path.

## Validation

From `/Volumes/AGENAI/Coding/public-github/computer-use-mcp-server`, run:

  npm run build
  npm test

Green means the server builds, `screenshot` and `zoom` return real image paths, the file-backed store cleans up files correctly, HTTP teardown removes session-owned capture files, and the existing geometry contract continues to hold.
