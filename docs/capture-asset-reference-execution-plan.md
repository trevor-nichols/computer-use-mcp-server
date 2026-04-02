# Capture Delivery Design Note

This repo now uses an image-first MCP capture contract.

## Final Contract

`screenshot` and `zoom` do three things:

1. Capture the image through the existing native bridge.
2. Save the image to a session-scoped file on disk.
3. Return MCP `content` with:
   - a text item containing `captureId=...`
   - an inline `image` item for immediate model consumption

Geometry and saved-file metadata are returned by a separate `capture_metadata` tool keyed by `captureId`.

The primary consumer flow is:

1. Call `screenshot` or `zoom`.
2. Use the inline image attachment immediately.
3. Call `capture_metadata(captureId)` only if geometry or saved-file details are needed.

The file-based fallback flow is:

1. Call `screenshot` or `zoom`.
2. Extract `captureId` from the text item.
3. Call `capture_metadata(captureId)`.
4. Read `structuredContent.imagePath`.
5. Call `view_image(imagePath)` if the client prefers file-based image viewing.

## Why This Replaced The Earlier Asset-URI Design

The intermediate `assetUri` plus `resources/read` design was removed because it solved a portability problem this repo does not need to solve. The supported consumers are Codex-style agents that already have:

- direct filesystem access
- a dedicated `view_image` tool

Given that environment, the server still keeps a local image path available. The key change is that the capture tool itself is now image-first so agent clients can inspect the screenshot without an extra file-open round trip.

## Current Server Behavior

- The file lifecycle is managed by `packages/computer-use-mcp/src/assets/captureAssetStore.ts`.
- HTTP session teardown and stale-session cleanup remove session-owned capture files.
- Process shutdown removes the current process-owned capture root.
- `screenshot` and `zoom` emit inline MCP `image` content and do not include metadata in `structuredContent`.
- `capture_metadata` returns the saved file path and screenshot geometry for a prior `captureId`.
- The MCP server does not expose `resources/list` or `resources/read` for capture delivery.

## Compatibility Note

If a future consumer needs a different image-delivery path, it should be introduced as a new deliberate design with its own contract. The current server is intentionally optimized for inline MCP images first, with `capture_metadata` as the explicit metadata and file-path lookup path.
