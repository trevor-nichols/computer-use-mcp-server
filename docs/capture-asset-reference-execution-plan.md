# Capture Delivery Design Note

This repo now uses a Codex-specific capture contract.

## Final Contract

`screenshot` and `zoom` do three things:

1. Capture the image through the existing native bridge.
2. Save the image to a session-scoped file on disk.
3. Return `structuredContent.imagePath` with the existing geometry metadata.

The intended consumer flow is:

1. Call `screenshot` or `zoom`.
2. Read `structuredContent.imagePath`.
3. Call `view_image(imagePath)`.

## Why This Replaced The Earlier Asset-URI Design

The intermediate `assetUri` plus `resources/read` design was removed because it solved a portability problem this repo does not need to solve. The supported consumers are Codex-style agents that already have:

- direct filesystem access
- a dedicated `view_image` tool

Given that environment, a local image path is the cleanest and most understandable contract.

## Current Server Behavior

- The file lifecycle is managed by `packages/computer-use-mcp/src/assets/captureAssetStore.ts`.
- HTTP session teardown and stale-session cleanup remove session-owned capture files.
- Process shutdown removes the current process-owned capture root.
- `screenshot` and `zoom` do not emit inline base64 image content.
- The MCP server does not expose `resources/list` or `resources/read` for capture delivery.

## Compatibility Note

If a future consumer needs a different image-delivery path, it should be introduced as a new deliberate design with its own contract. The current server is intentionally optimized for `imagePath` plus `view_image`.
