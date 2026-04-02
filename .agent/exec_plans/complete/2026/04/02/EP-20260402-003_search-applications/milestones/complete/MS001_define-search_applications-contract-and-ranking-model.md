---
id: EP-20260402-003/MS001
execplan_id: EP-20260402-003
ms: 1
title: "Define search_applications contract and ranking model"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-02
updated: 2026-04-02
tags: [tools, schemas]
risk: low
links:
  issue: ""
  docs: "docs/macos-computer-use-reimplementation-spec.md"
  pr: ""
---

# Define search_applications contract and ranking model

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Define a strict and implementation-ready contract for `search_applications` so callers can query app candidates without unbounded payloads and then pass selected results directly into `request_access`.

## Definition of Done

- [x] Input schema defines required `query`, bounded `limit`, optional source filter, and optional `includePaths`.
- [x] Output contract is machine-usable, bounded, and includes `apps` entries compatible with `request_access.apps`.
- [x] Ranking and filtering semantics are explicitly documented in the parent ExecPlan and reflected in implementation tests.
- [x] Milestone status is set to `completed` and moved to `milestones/complete/` when implementation confirms the contract.

## Scope

### In Scope
- Contract decisions for input and output fields.
- Deterministic ranking criteria and tie-break semantics.
- Response bounding behavior (`limit` and has-more signaling model).

### Out of Scope
- Full-text indexing, fuzzy libraries, or locale-aware collation.
- Approval flow changes or auto-grant behavior.
- Pagination primitives beyond bounded top-N results.

## Workstreams & Tasks

- [x] Audit current `AllowedApp` and `request_access` schema constraints to ensure compatibility.
- [x] Finalize schema constants and output fields in `toolSchemas.ts`.
- [x] Encode ranking/filtering rules in code and tests.

## Risks & Mitigations

- Risk: Overly complex ranking may be hard to reason about and maintain.
  Mitigation: Keep scoring simple, deterministic, and unit-tested with explicit expected ordering.

- Risk: Expanding output shape may break strict-schema clients.
  Mitigation: Keep `apps` items aligned with existing `AllowedApp` shape and constrain additional metadata at top level only.

## Validation / QA Plan

- Validate schema strictness through existing tool list/introspection tests.
- Add targeted tests that assert ranking order and response truncation behavior.
- Re-run full `npm test` in milestone 3 after implementation and docs updates.

## Changelog

- 2026-04-02: Milestone created.
- 2026-04-02: Updated objective, scope, and acceptance criteria; moved status to in-progress.
- 2026-04-02: Completed schema and ranking contract implementation (`searchApplicationsSchema`, `searchApplicationsOutputSchema`, and ranking tests).
