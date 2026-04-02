# Capture Asset Reference Execution Plan

## Objective

Move `screenshot` and `zoom` from inline image payloads toward session-scoped capture assets that hosts can explicitly promote into real model-visible image inputs.

This keeps the native capture path intact, removes image bytes from the routine tool-result path, and gives us a transport-agnostic contract that works across `stdio` and streamable HTTP.

## Current State

- Native capture returns `dataBase64` plus metadata.
- `screenshot` and `zoom` currently emit MCP `image` content items.
- The safe improvement is already applied: raw image bytes are no longer duplicated inside `structuredContent`.
- Session state only tracks screenshot geometry, not a durable capture asset.

## Target Contract

`screenshot` and `zoom` should eventually return:

- `structuredContent`
  - `ok`
  - `captureId`
  - `assetUri`
  - `mimeType`
  - screenshot geometry fields
  - `excludedBundleIds`
- `content`
  - a `resource_link` that points at the capture asset
  - a short text summary

Host/client responsibility:

- Read the capture asset through MCP resource APIs.
- Materialize a local temp file if needed.
- Promote that file or URL into a real model image input such as `localImage` or an image attachment.

The MCP server should own asset storage and cleanup. The host client should own model-facing image promotion.

## Design Rules

- Do not put raw image bytes in `structuredContent`.
- Do not make model perception depend on arbitrary JSON fields.
- Keep geometry updates tied to the latest capture visible to the session.
- Make the asset reference contract transport-agnostic.
- Keep a compatibility path until host integrations are migrated.

## Milestone 0

Status: complete

Scope:

- remove `structuredContent.image` from `screenshot`
- remove `structuredContent.image` from `zoom`
- add regression tests so raw image bytes do not reappear in metadata

Exit criteria:

- `structuredContent` contains only metadata
- inline MCP `image` content still works exactly as before

## Milestone 1

Internal capture asset store

Scope:

- add a session-scoped capture asset store
- persist screenshot bytes to disk under a dedicated asset root
- track asset metadata separately from screenshot geometry
- clean up assets on session deletion, stale-session cleanup, and server shutdown

Likely files:

- `packages/computer-use-mcp/src/config.ts`
- `packages/computer-use-mcp/src/session/sessionContext.ts`
- `packages/computer-use-mcp/src/session/sessionStore.ts`
- `packages/computer-use-mcp/src/mcp/streamableHttpTransport.ts`
- `packages/computer-use-mcp/src/mcp/stdioTransport.ts`
- `packages/computer-use-mcp/src/mcp/server.ts`
- new `packages/computer-use-mcp/src/assets/captureAssetStore.ts`

Deliverables:

- `CaptureAssetRecord` type with `captureId`, `sessionId`, `mimeType`, `path`, `createdAt`, and geometry metadata
- configurable asset root, for example `~/.computer-use-mcp/assets`
- cleanup hooks that remove session assets when the session is closed or expires

Exit criteria:

- every new screenshot/zoom can be persisted as a named asset
- deleting a session deletes its assets
- stale-session cleanup deletes corresponding assets

## Milestone 2

MCP resource surface for capture assets

Scope:

- expose capture assets through MCP resources instead of inline tool payloads
- add resource URIs for captures
- implement `resources/read` for binary image retrieval

Recommended URI shape:

- `computer-use://sessions/{sessionId}/captures/{captureId}`

Likely files:

- `packages/computer-use-mcp/src/mcp/server.ts`
- new `packages/computer-use-mcp/src/mcp/resourceRegistry.ts`
- new tests for `resources/read` over both `stdio` and streamable HTTP

Deliverables:

- server advertises MCP `resources` capability
- capture asset can be fetched by URI
- resource read is access-controlled by session

Exit criteria:

- given a `captureId`, a client can retrieve the image bytes through MCP without calling the native capture path again
- session A cannot read session B assets

## Milestone 3

Upgrade screenshot and zoom to return asset references

Scope:

- mint a capture asset after every successful screenshot/zoom
- return `captureId` and `assetUri` in `structuredContent`
- add a `resource_link` content item
- keep the existing inline MCP `image` content behind a temporary compatibility flag

Recommended temporary config:

- `COMPUTER_USE_CAPTURE_INLINE_IMAGE=true|false`

Likely files:

- `packages/computer-use-mcp/src/tools/screenshot.ts`
- `packages/computer-use-mcp/src/tools/zoom.ts`
- `packages/computer-use-mcp/src/config.ts`
- `packages/computer-use-mcp/test/stdio.e2e.test.ts`

Exit criteria:

- tool callers receive a stable asset reference for every capture
- existing clients can remain on inline-image mode during migration
- new clients can consume reference-only mode

## Milestone 4

Host integration for model-visible image promotion

Scope:

- define the client contract for turning capture assets into actual model image inputs
- document or implement a host capability flag for capture-asset support
- provide one reference integration path for OpenAI/Codex-style clients

Recommended host flow:

1. call `screenshot` or `zoom`
2. inspect `captureId` and `assetUri`
3. fetch the asset via `resources/read`
4. materialize a local temp file when needed
5. send that file to the model as `localImage` or equivalent image input

Notes:

- This is the step that actually fixes model perception.
- The MCP server should not assume that a raw `resource_link` is automatically visible to the model.

Exit criteria:

- at least one host client can promote capture assets into real model-visible images without relying on inline base64 tool results

## Milestone 5

Flip the default and remove the legacy path

Scope:

- default `COMPUTER_USE_CAPTURE_INLINE_IMAGE` to `false`
- later remove the flag entirely once downstream clients are migrated
- update docs and examples to show reference-only capture delivery

Exit criteria:

- screenshot and zoom no longer emit inline image bytes by default
- all supported clients use capture assets plus explicit image promotion

## Test Plan

- unit tests for asset store create, read, list, and cleanup
- unit tests for session-scoped authorization on capture reads
- regression tests proving `structuredContent` never contains raw image bytes
- stdio end-to-end test for `screenshot` then `resources/read`
- streamable HTTP end-to-end test for `screenshot` then `resources/read`
- cleanup test proving `DELETE /mcp` removes session assets

## Open Questions

- Whether `resources/list` is needed, or whether `resources/read` by URI is enough for the first release
- Whether streamable HTTP also needs a direct binary asset endpoint later for efficiency
- Whether the host-capability handshake should be generic or OpenAI/Codex-specific

## Recommendation

Implement Milestones 1 through 3 in this repo first. Do not remove inline MCP `image` content until Milestone 4 exists in at least one real client integration.
