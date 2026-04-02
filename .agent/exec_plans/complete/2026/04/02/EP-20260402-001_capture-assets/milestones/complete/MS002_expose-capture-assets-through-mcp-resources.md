---
id: EP-20260402-001/MS002
execplan_id: EP-20260402-001
ms: 2
title: "Expose capture assets through MCP resources"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-02
updated: 2026-04-02
tags: [mcp, resources]
risk: med
links:
  issue: ""
  docs: ".agent/exec_plans/complete/2026/04/02/EP-20260402-001_capture-assets/EP-20260402-001_capture-assets.md"
  pr: ""
---

# Expose capture assets through MCP resources

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Add the MCP protocol surface that lets clients fetch capture assets by URI. When this milestone is done, the server will advertise the `resources` capability, list session-visible capture resources, and return capture bytes through `resources/read` with explicit session isolation.

## Definition of Done

- `initialize` advertises `resources: { listChanged: false }`
- `resources/list` returns capture resources visible to the current session
- `resources/read` returns binary contents for a valid capture URI
- Cross-session reads are rejected
- Targeted resource-surface tests pass over both stdio and streamable HTTP

## Scope

### In Scope
- Extend `src/mcp/server.ts` with resource methods
- Add a small registry or helper for capture-resource listing and reading
- Define the resource URI parser and validation behavior
- Add stdio and HTTP regression tests for `resources/read`

### Out of Scope
- Changing the screenshot/zoom tool contract
- Host-side promotion into model-visible images
- Notifications for resource list changes

## Workstreams & Tasks

### Workstream A: Server protocol surface

- [ ] Add the `resources` capability to `initialize`
- [ ] Implement `resources/list`
- [ ] Implement `resources/read`

### Workstream B: Access control and regression coverage

- [ ] Enforce that a session can read only its own capture URIs
- [ ] Add a streamable HTTP regression covering `screenshot` then `resources/read`
- [ ] Add a stdio regression covering `screenshot` then `resources/read`

## Risks & Mitigations

- Risk: a permissive URI parser could allow one session to guess another session's resource path.
  Mitigation: validate both the URI format and the in-memory asset record, and require the current server session ID to match the asset record's session ID.

- Risk: advertising `resources` without list support could confuse generic clients.
  Mitigation: implement `resources/list` now, even if callers typically use the `resource_link` directly.

## Validation / QA Plan

- Run `npm run build`.
- Run the new resource-surface tests plus the existing HTTP and stdio transport tests.
- Verify that a resource created in one session returns `404` or an equivalent JSON-RPC failure from another session.

## Changelog

- 2026-04-02: Milestone created.
- 2026-04-02: Expanded milestone with explicit `resources/list` plus `resources/read` scope and session-isolation checks.
- 2026-04-02: Completed by advertising MCP `resources` capability, adding `resources/list` and `resources/read` in `src/mcp/server.ts`, and covering the new surface in streamable HTTP and stdio tests.
