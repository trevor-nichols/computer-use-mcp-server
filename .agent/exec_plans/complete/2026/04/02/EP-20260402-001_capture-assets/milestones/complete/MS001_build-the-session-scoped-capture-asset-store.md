---
id: EP-20260402-001/MS001
execplan_id: EP-20260402-001
ms: 1
title: "Build the session-scoped capture asset store"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-02
updated: 2026-04-02
tags: [capture, storage]
risk: med
links:
  issue: ""
  docs: ".agent/exec_plans/complete/2026/04/02/EP-20260402-001_capture-assets/EP-20260402-001_capture-assets.md"
  pr: ""
---

# Build the session-scoped capture asset store

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Introduce a server-owned capture asset store that persists screenshot bytes to disk, indexes them by session, and can clean them up deterministically. When this milestone is done, the server will have everything needed to mint durable capture references without changing the MCP protocol surface yet.

## Definition of Done

- A new asset-store module writes capture bytes to a process-owned asset root and returns stable asset metadata.
- Runtime config includes additive capture-asset settings for the asset root and inline-image compatibility.
- HTTP stale-session cleanup and explicit session deletion remove session assets.
- Process shutdown removes the current server's asset root.
- Targeted asset-store tests pass, plus `npm run build`.

## Scope

### In Scope
- Add `packages/computer-use-mcp/src/assets/captureAssetStore.ts`
- Extend runtime config with `COMPUTER_USE_CAPTURE_ASSET_ROOT` and `COMPUTER_USE_CAPTURE_INLINE_IMAGE`
- Wire asset-store construction into `src/main.ts`
- Hook per-session cleanup into HTTP delete and stale-session cleanup
- Add shutdown cleanup for the current server-owned asset root

### Out of Scope
- Adding MCP `resources/list` or `resources/read`
- Changing the `screenshot` and `zoom` tool result shape
- Implementing downstream host promotion helpers

## Workstreams & Tasks

### Workstream A: Asset persistence

- [ ] Define `CaptureAssetRecord` and the process-owned root layout
- [ ] Persist decoded capture bytes under a per-session directory
- [ ] Track records in memory by `captureId` and `assetUri`

### Workstream B: Cleanup and runtime wiring

- [ ] Construct the asset store from `main.ts`
- [ ] Remove session assets on HTTP delete and stale-session eviction
- [ ] Remove the current server asset root on shutdown
- [ ] Add unit tests for create, lookup, and cleanup behavior

## Risks & Mitigations

- Risk: cleanup could accidentally delete assets belonging to another live process.
  Mitigation: use a process-owned subdirectory under the configurable asset base root and only delete that subdirectory on shutdown.

- Risk: file cleanup failures could leave orphaned assets behind.
  Mitigation: log cleanup failures with session and path metadata, keep cleanup idempotent, and prefer recursive session-directory deletion so retries are simple.

## Validation / QA Plan

- Run `npm run build`.
- Add and run targeted tests for asset creation and deletion.
- Manually verify that creating an asset writes a file and that deleting the session removes the corresponding session directory.

## Changelog

- 2026-04-02: Milestone created.
- 2026-04-02: Expanded milestone with the chosen process-owned asset-root design and cleanup strategy.
- 2026-04-02: Completed by adding `src/assets/captureAssetStore.ts`, new runtime config for capture assets, HTTP session cleanup hooks, and shutdown cleanup wiring in `src/main.ts`.
