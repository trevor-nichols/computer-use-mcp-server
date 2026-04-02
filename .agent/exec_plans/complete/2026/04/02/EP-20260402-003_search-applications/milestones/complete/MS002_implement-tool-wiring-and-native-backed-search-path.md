---
id: EP-20260402-003/MS002
execplan_id: EP-20260402-003
ms: 2
title: "Implement tool wiring and native-backed search path"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-02
updated: 2026-04-02
tags: [tools, native, runtime]
risk: med
links:
  issue: ""
  docs: "docs/macos-computer-use-reimplementation-spec.md"
  pr: ""
---

# Implement tool wiring and native-backed search path

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Implement `search_applications` as a read-only MCP tool backed by existing native app discovery methods, with deterministic bounded results and no changes to approval or lock semantics.

## Definition of Done

- [x] `search_applications` is registered in `toolRegistry.ts` with read-only annotations.
- [x] Tool handler is implemented and uses existing `nativeHost.apps.listInstalledApps()` / `listRunningApps()`.
- [x] Structured response includes deterministic top-N matches and compatibility fields for `request_access`.
- [x] Fake mode behavior remains functional and deterministic.

## Scope

### In Scope
- `toolSchemas.ts` additions for input and output schema.
- `tools/applications.ts` (or a split helper module) for ranking/dedup/filter behavior.
- Registry wiring and exports/imports required for runtime tool dispatch.

### Out of Scope
- New native Swift methods.
- Changes to mutating tool lock acquisition rules.
- Changes to approval coordinator behavior.

## Workstreams & Tasks

- [x] Add strict schemas and registry entry.
- [x] Implement runtime search and scoring pipeline.
- [x] Ensure structured output remains machine-usable and bounded.

## Risks & Mitigations

- Risk: Duplicate app entries from running vs installed sources can produce unstable output.
  Mitigation: Deduplicate by bundle identifier before ranking output.

- Risk: Bridge method variability can surface malformed app metadata.
  Mitigation: Normalize and filter invalid entries defensively before scoring.

## Validation / QA Plan

- Run targeted tests for ranking behavior and source filtering.
- Run stdio e2e surface test to ensure tool discovery and callable behavior.
- Full build/test verification is captured in milestone 3.

## Changelog

- 2026-04-02: Milestone created.
- 2026-04-02: Filled milestone implementation scope, risks, and QA plan.
- 2026-04-02: Implemented `searchApplications.ts` and wired `search_applications` into the tool registry with read-only annotations.
