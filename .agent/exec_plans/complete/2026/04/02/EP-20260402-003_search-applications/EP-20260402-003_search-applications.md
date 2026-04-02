---
id: EP-20260402-003
title: Add search_applications tool for bounded app discovery
status: archived
kind: feature
domain: backend
owner: '@codex'
created: 2026-04-02
updated: '2026-04-02'
tags:
- tools
- applications
- approval
touches:
- api
- tests
- docs
risk: med
breaking: false
migration: false
links:
  issue: ''
  pr: ''
  docs: docs/macos-computer-use-reimplementation-spec.md
depends_on: []
supersedes: []
---

# EP-20260402-003 - Add search_applications tool for bounded app discovery

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date as work proceeds.

If `.agent/PLANS.md` exists in this repository, maintain this plan in accordance with that guidance.

## Purpose / Big Picture

After this change, a model can discover candidate macOS apps with a query and a bounded response size, then pass a selected `{ bundleId, displayName, path? }` entry directly into `request_access`. This removes the need to dump or parse full installed-app lists while keeping the approval model explicit and fail-closed. A human can verify this by calling `tools/call` for `search_applications` with a small `limit`, seeing deterministic sorted matches, and successfully using one match in `request_access`.

## Scope

In scope are an additive read-only MCP tool (`search_applications`), strict schemas and machine-usable structured output, deterministic ranking/filtering over existing native app-discovery primitives, fake-mode parity, test coverage, and documentation updates for the tool surface.

Out of scope are changes to approval semantics, auto-granting, lock behavior for mutating tools, bulk pagination APIs, or new native Swift methods unless implementation reveals a blocker.

## Progress

- [x] (2026-04-02 21:25Z) Created `EP-20260402-003` and milestone scaffolds with `agentrules execplan new` and `agentrules execplan milestone new`.
- [x] (2026-04-02 21:28Z) Audited current tool surface and native bridge methods; confirmed `listInstalledApps`/`listRunningApps` already exist behind the TypeScript adapter.
- [x] (2026-04-02 21:30Z) Implemented strict `search_applications` input/output schemas, tool registry wiring, and a dedicated `searchApplications.ts` handler module.
- [x] (2026-04-02 21:32Z) Added deterministic ranking/dedup/argument-validation tests plus transport tool-surface coverage updates.
- [x] (2026-04-02 21:33Z) Updated README/VALIDATION and verified with `npm run build` and `npm test` (65/65 passing).

## Surprises & Discoveries

- Observation: the native bridge already exposes `listInstalledApps` and `listRunningApps`, but MCP currently exposes neither, so search can be implemented in TypeScript without Swift changes.
  Evidence: `packages/native-swift/Sources/ComputerUseBridge/BridgeMain.swift` routes both methods, while `packages/computer-use-mcp/src/mcp/toolRegistry.ts` currently only exposes `open_application` and `list_granted_applications`.

- Observation: `request_access.apps` already expects strict `AllowedApp` objects with `additionalProperties: false`, which gives a direct shape target for search results.
  Evidence: `packages/computer-use-mcp/src/mcp/toolSchemas.ts` defines `allowedAppItem` and reuses it in `requestAccessSchema`.

- Observation: installed-app discovery currently enumerates `/Applications` and `/System/Applications`, so discovery is intentionally bounded to canonical app roots.
  Evidence: `packages/native-swift/Sources/ComputerUseBridge/AppService.swift` `listInstalledApps()` iterates those two roots directly.

## Decision Log

- Decision: introduce one additive read-only tool (`search_applications`) instead of exposing full installed/running lists directly.
  Rationale: bounded responses are better for agent reliability and reduce accidental token bloat while preserving explicit approval calls.
  Date/Author: 2026-04-02 / @codex

- Decision: keep tool output pass-through compatible with `request_access.apps`.
  Rationale: this minimizes caller glue code and makes approval workflows deterministic.
  Date/Author: 2026-04-02 / @codex

- Decision: use deterministic, local ranking (exact > prefix > substring with running/granted/installed tie-break boosts) and a hard result cap.
  Rationale: deterministic ranking is testable and stable across transports while keeping response payloads bounded.
  Date/Author: 2026-04-02 / @codex

## Outcomes & Retrospective

`search_applications` is now part of the MCP tool surface as a read-only, bounded discovery API. It returns strict structured output that is directly consumable by `request_access.apps`, with deterministic ranking and configurable source/limit/path inclusion.

The implementation stayed additive and transport-neutral. No lock, approval, or Swift bridge behavior changed, fake mode remains functional, and transport tests assert the new tool is discoverable. Remaining future improvements (explicit pagination, richer metadata facets) are optional and were intentionally deferred to keep the first version simple and reliable.

## Context and Orientation

`packages/computer-use-mcp/src/mcp/toolSchemas.ts` and `packages/computer-use-mcp/src/mcp/toolRegistry.ts` define the MCP contract and tool surface. `packages/computer-use-mcp/src/tools/applications.ts` currently contains app-related handlers (`open_application`, `list_granted_applications`) and is the natural location for search behavior unless complexity warrants a new module. `packages/computer-use-mcp/src/native/swiftBridge.ts` already provides both installed and running app fetch methods through the `AppBridge` interface in `packages/computer-use-mcp/src/native/bridgeTypes.ts`.

The approval state is session scoped in `packages/computer-use-mcp/src/session/sessionContext.ts`, with existing granted apps held in `allowedApps`. Search must remain read-only and never mutate session state or perform approval prompts.

## Plan of Work

First, extend tool schemas with a strict `search_applications` input schema and output schema, keeping `additionalProperties: false` and bounded numeric constraints. Input includes query and optional knobs (`limit`, source selection, and path inclusion); output includes bounded results plus metadata that helps callers choose candidates without extra calls.

Second, implement the handler in a dedicated `searchApplications.ts` tool module. It will gather candidate apps from running and/or installed sources, deduplicate by bundle identifier, compute deterministic relevance scores, sort stably, and return only the top `limit`. The structured content will include `apps` in the exact `AllowedApp` shape for direct use with `request_access`.

Third, wire the tool into the registry as read-only and add tests. Coverage will include ranking precedence, dedupe behavior, limit enforcement, source filtering, and stdio tool-surface exposure in fake mode. Documentation in `README.md` and `VALIDATION.md` will be updated to reflect the new tool.

## Milestones

### Milestone 1: Define schema contract and ranking model

Lock down exact input/output shape and ranking semantics so implementation and tests target the same deterministic behavior.

### Milestone 2: Implement runtime wiring and handler behavior

Add the new schema, registry entry, and TypeScript handler over existing native primitives while preserving session isolation and read-only behavior.

### Milestone 3: Add regression coverage and docs, then verify

Add tests and docs, run repository validation commands, and confirm fake mode and transport behavior remain intact.

## Validation

From `/Volumes/AGENAI/Coding/public-github/computer-use-mcp-server`, run:

  npm run build
  npm test
