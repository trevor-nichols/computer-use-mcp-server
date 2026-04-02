---
id: EP-20260401-002/MS002
execplan_id: EP-20260401-002
ms: 2
title: "Enforce fail-closed action safety gates"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-01
tags:
- safety
- tools
- input
risk: med
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Enforce fail-closed action safety gates

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Refuse to send input when the resolved target application is not granted for the current session. After this milestone, point-targeted actions validate the app under the action point and active-UI actions validate the frontmost app before mutating the desktop.

## Definition of Done

- A dedicated helper, likely `packages/computer-use-mcp/src/tools/frontmostGate.ts`, encapsulates target-app validation
- Click and drag validate the app under their resolved desktop point
- Type validates the frontmost app before clipboard writes or keyboard injection
- Key and scroll validate the frontmost app before sending input
- Failures are mapped into machine-usable tool errors
- `npm test` passes or milestone-targeted tests pass if milestone 3 coverage is still in progress

## Scope

### In Scope
- Typed fail-closed validation helper
- Tool wiring for click, drag, type, key, and scroll
- Error selection and structured error behavior

### Out of Scope
- Host identity exemptions
- Approval model changes
- Changing mouse move semantics unless required by implementation evidence

## Workstreams & Tasks

### Workstream A: Safety helper

- [x] Add a shared validation helper for frontmost and point-targeted checks
- [x] Reuse existing session app grant data rather than adding a new grant store
- [x] Return typed errors for ungranted or unresolved target apps

### Workstream B: Tool wiring

- [x] Gate click and drag on the resolved app under point
- [x] Gate type on the frontmost app
- [x] Gate key and hold_key on the frontmost app
- [x] Gate scroll on the resolved app under point

## Risks & Mitigations

- Risk: applying the gate in the wrong place could allow clipboard mutation or cursor motion before the safety decision is made.
  Mitigation: perform the check immediately before the first mutating side effect in each tool path, not only in outer scope setup.

## Validation / QA Plan

- Add focused tests for allowed and denied tool flows.
- Run `npm test` from the repository root.
- Verify that failing cases return `isError: true` with a structured error payload rather than a plain thrown string.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Expanded milestone with the selected tool surface and fail-closed enforcement approach.
- 2026-04-01: Completed by adding `frontmostGate.ts` and wiring fail-closed validation into the mutating input tools.
