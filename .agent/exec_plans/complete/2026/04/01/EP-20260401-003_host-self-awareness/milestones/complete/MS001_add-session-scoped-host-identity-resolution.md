---
id: EP-20260401-003/MS001
execplan_id: EP-20260401-003
ms: 1
title: "Add session-scoped host identity resolution"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-01
tags: [host, sessions]
risk: med
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Add session-scoped host identity resolution

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Introduce a real host-identity model that lives on the session and is sourced either from explicit initialize metadata or from stdio parent-app inference. After this milestone, later safety code can ask a single question, "what host app owns this session?", without performing ad hoc metadata parsing or transport-specific logic at every call site.

## Definition of Done

- `packages/host-sdk/src/sessionMetadata.ts` can emit host bundle metadata for initialize requests.
- `packages/computer-use-mcp/src/mcp/*`, `src/session/*`, and the new host helper module preserve host identity per session without leaking it across sessions.
- Direct `tools/call` usage still works because host identity can be lazily resolved inside the tool execution path.
- Targeted tests cover explicit metadata parsing and stdio parent-app inference behavior.
- Any changed run instructions or assumptions are documented in the parent ExecPlan.

## Scope

### In Scope
- Add a `HostIdentity` type and helper functions under `packages/computer-use-mcp/src/runtime/`.
- Extend connection metadata and session state with host identity and resolution-attempt tracking.
- Parse additive initialize metadata for host identity.
- Implement stdio fallback inference by walking the local process tree and matching ancestor PIDs against `apps.listRunningApps()`.

### Out of Scope
- Capture exclusion and hide/unhide behavior changes.
- Host-aware input safety messaging.
- New Swift bridge methods unless implementation uncovers a real blocker.

## Current Health Snapshot

| Area | Status | Notes |
| --- | --- | --- |
| Architecture/design | ✅ | The explicit-metadata-plus-stdio-inference approach landed as designed. |
| Implementation | ✅ | The host identity helper and session plumbing are in place. |
| Tests & QA | ✅ | `hostIdentity.test.ts` covers parsing and stdio inference. |
| Docs & runbooks | ✅ | Parent ExecPlan records the implementation and verification. |

## Architecture / Design Snapshot

- `HostIdentity` will be a small object with `bundleId`, optional `displayName`, and a `source` tag.
- Explicit initialize metadata is the highest-priority source because embedded hosts already control that handshake.
- Stdio inference will use the current process's ancestor PID chain plus the existing `listRunningApps()` bridge method to find the first regular macOS app in the chain.
- The session will cache whether inference has already been attempted so repeated tool calls do not repeatedly shell out to `ps`.

## Workstreams & Tasks

### Workstream A – Metadata plumbing

| ID | Area | Description | Status |
|----|------|-------------|-------|
| A1 | Host SDK | Emit additive `computerUseHost` metadata from `sessionMetadata.ts`. | ✅ |
| A2 | Transport | Extend connection metadata and session state with `hostIdentity`. | ✅ |
| A3 | Router | Resolve and cache host identity inside tool execution. | ✅ |

### Workstream B – Inference and tests

| ID | Area | Description | Status |
|----|------|-------------|-------|
| B1 | Runtime | Implement stdio parent-app inference helpers. | ✅ |
| B2 | Tests | Add unit coverage for metadata parsing and inference. | ✅ |

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Process-tree parsing is brittle across environments. | Med | Keep it best-effort, stdio-only, and cache failures. |
| Host identity may be missing for direct `tools/call` clients that skip initialize. | Med | Resolve lazily in `callRouter` instead of relying solely on initialize. |

## Validation / QA Plan

- Run `npm test` after adding host identity tests.
- Verify that the new resolver tests pass in fake mode without requiring a real macOS app environment.
- Confirm that host identity remains per-session by using unit tests rather than process-global state.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Filled in milestone scope, design, and validation plan.
- 2026-04-01: Completed host identity plumbing, stdio inference, and resolver test coverage.
