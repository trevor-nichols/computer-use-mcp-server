---
id: EP-20260402-002
title: Split screenshot image attachments from capture metadata
status: archived
kind: feature
domain: backend
owner: '@codex'
created: 2026-04-02
updated: '2026-04-02'
tags:
- mcp
- screenshots
- tool-contracts
touches:
- agents
- tests
risk: low
breaking: true
migration: false
links:
  issue: ''
  pr: ''
  docs: ''
depends_on: []
supersedes: []
---

# EP-20260402-002 - Split screenshot image attachments from capture metadata

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date as work proceeds.

If `.agent/PLANS.md` exists in this repository, maintain this plan in accordance with that guidance.

## Purpose / Big Picture

Screenshot-style tools must deliver image attachments directly to MCP clients instead of forcing clients to reconstruct screenshots from metadata or large text payloads. After this change, `screenshot` and `zoom` return an MCP `content` array with human-readable text plus an inline `image` item, which allows agent clients such as Codex to inspect the capture immediately. Geometry and saved-file metadata move to a separate `capture_metadata` tool keyed by `captureId`.

You can verify the behavior end to end by starting the server, calling `screenshot`, confirming the response contains `content` entries of types `text` and `image` with no `structuredContent`, then calling `capture_metadata` with the returned `captureId` and confirming the structured metadata includes `imagePath`, dimensions, display geometry, and `excludedBundleIds`.

## Scope

In scope: changing the `screenshot` and `zoom` tool contracts to be image-first, persisting capture metadata in the session-scoped asset store, adding a `capture_metadata` lookup tool, and updating transport and tool tests to reflect the new split contract.

Out of scope: changing screenshot coordinate math, altering session cleanup semantics, or adding new compatibility shims for legacy clients. This is an intentionally breaking contract change because the server is not yet published and the goal is to optimize MCP behavior for current agent clients.

## Progress

- [x] (2026-04-02 16:35Z) Created the ExecPlan and confirmed the current gap: Playwright preserves inline MCP image attachments, while this server previously returned screenshot metadata through `structuredContent`, which Codex flattened into a metadata-only tool result.
- [x] (2026-04-02 16:55Z) Reworked `packages/computer-use-mcp/src/tools/captureResult.ts` so `screenshot` and `zoom` return only text plus inline image content and store their metadata in the per-session capture asset store.
- [x] (2026-04-02 17:05Z) Added `packages/computer-use-mcp/src/tools/captureMetadata.ts`, registered `capture_metadata`, extended the capture asset store to retain `excludedBundleIds`, and added a session-scoped lookup path that fails closed when a capture ID is unknown.
- [x] (2026-04-02 17:18Z) Updated unit and transport tests so they validate the new contract, including session isolation for `capture_metadata`.
- [x] (2026-04-02 17:24Z) Ran `npm run build` and `npm test` from the repository root; the full suite passed.
- [x] (2026-04-02 17:40Z) Verified against the restarted live server that `screenshot` now yields `content` entries of types `text` and `image` with no `structuredContent`, which allows Codex to receive the image inline.

## Surprises & Discoveries

- The server-side implementation was correct before the live verification passed, but an older long-running Node process was still serving the previous build. Rebuilding alone was not enough; the live MCP process had to be restarted before Codex observed the new tool contract.
- Codex preserves Playwright screenshot images because those responses rely on MCP `content` attachments instead of `structuredContent`. When both are present, the function-tool bridge on this client surface prefers the flattened `structuredContent`, which hides the image attachment from the agent.
- Session-scoped metadata lookup is required for the split contract to remain safe. A global capture lookup would have leaked saved-path and display metadata across sessions.

## Decision Log

- 2026-04-02: Made `screenshot` and `zoom` intentionally breaking by removing `structuredContent` rather than keeping a compatibility field. Reason: inline image delivery is the primary requirement, the server is pre-publication, and Codex currently hides image attachments when `structuredContent` is present.
- 2026-04-02: Added a dedicated `capture_metadata` tool keyed by `captureId` instead of inventing tool-specific optional flags. Reason: the split keeps screenshot responses small and image-first while preserving machine-usable geometry through an explicit follow-up lookup.
- 2026-04-02: Stored `excludedBundleIds` inside the capture asset record so `capture_metadata` can return the same full metadata shape that prior screenshot responses exposed, without weakening session isolation.

## Outcomes & Retrospective

The repo now follows the same effective pattern that made Playwright screenshots visible to Codex: image-bearing tools emit MCP `content` with an inline `image` item, and metadata retrieval is handled separately. The split contract keeps screenshot responses concise, prevents base64 text from bloating model context, and preserves session isolation by resolving metadata only within the originating session.

Validation covered unit tests, stdio transport tests, Streamable HTTP tests, and a live end-to-end check against the restarted MCP server. No follow-up work is required for the immediate issue. A possible later enhancement is downscaling or recompressing inline images before attachment if payload size becomes a practical concern, but the current screenshot sizing limits already bound the response size.
