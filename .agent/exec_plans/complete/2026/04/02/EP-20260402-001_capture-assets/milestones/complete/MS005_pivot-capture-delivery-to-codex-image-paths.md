---
id: EP-20260402-001/MS005
execplan_id: EP-20260402-001
ms: 5
title: "Pivot capture delivery to Codex image paths"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-02
updated: 2026-04-02
tags: [capture, codex, breaking-change]
risk: med
links:
  issue: ""
  docs: ".agent/exec_plans/complete/2026/04/02/EP-20260402-001_capture-assets/EP-20260402-001_capture-assets.md"
  pr: ""
---

# Pivot capture delivery to Codex image paths

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Replace the intermediate MCP asset-URI contract with the final Codex-specific contract: `screenshot` and `zoom` save a local image file and return `imagePath` for immediate use with `view_image`.

## Definition of Done

- `screenshot` and `zoom` return absolute `imagePath` values
- The MCP server no longer advertises or implements `resources/list` and `resources/read`
- Inline image compatibility output is removed
- Tests and docs describe the `imagePath` plus `view_image` flow
- Build and test validation pass

## Scope

### In Scope
- Refactor the capture store to remain file-backed without exposing MCP asset URIs
- Change capture output schemas and tool responses to `imagePath`
- Remove the unused resource surface and compatibility config
- Update tests, plan docs, and user-facing design notes

### Out of Scope
- Automatic viewer invocation inside the MCP server
- Supporting non-Codex agents or alternate image-delivery models

## Workstreams & Tasks

- [x] Replace `assetUri` output with `imagePath`
- [x] Remove `resource_link` and inline image content from `screenshot` and `zoom`
- [x] Remove `resources/list`, `resources/read`, and the resource-registry helper
- [x] Remove `COMPUTER_USE_CAPTURE_INLINE_IMAGE`
- [x] Update unit, stdio, and streamable HTTP tests
- [x] Update the active ExecPlan and design note to reflect the final contract

## Risks & Mitigations

- Risk: a partially removed asset-URI path would leave the repo with conflicting contracts.
  Mitigation: update the server surface, output schemas, tests, and docs in the same change.

- Risk: changing the capture payload could accidentally break coordinate-dependent follow-on tools.
  Mitigation: keep the geometry metadata intact and re-run the existing zoom and coordinate regression tests.

## Validation / QA Plan

- Run `npm run build`.
- Run `npm test`.
- Confirm that capture-tool regression tests assert `imagePath` and that HTTP teardown still deletes session-owned files.

## Changelog

- 2026-04-02: Milestone created.
- 2026-04-02: Completed by pivoting the capture contract from MCP asset URIs to local `imagePath` delivery for Codex-style agents.
