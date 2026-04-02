---
id: EP-20260402-003/MS003
execplan_id: EP-20260402-003
ms: 3
title: "Add regression coverage, docs, and verification"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-02
updated: 2026-04-02
tags: [tests, docs, validation]
risk: low
links:
  issue: ""
  docs: "README.md"
  pr: ""
---

# Add regression coverage, docs, and verification

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Add durable regression tests and documentation for `search_applications`, then run repository validation to prove compatibility across fake mode and existing transport behavior.

## Definition of Done

- [x] Test coverage asserts ordering, dedupe, and limit behavior for `search_applications`.
- [x] `stdio.e2e.test.ts` tool-surface expectation includes the new tool.
- [x] `README.md` and `VALIDATION.md` reflect the expanded tool surface.
- [x] `npm run build` and `npm test` pass after changes.

## Scope

### In Scope
- Unit/integration tests needed for the new tool contract.
- Documentation updates for public tool surface and validation checklist.
- Final verification command execution and milestone closure.

### Out of Scope
- Non-related refactors in action/capture/approval subsystems.
- New transport features beyond the added tool entry.

## Workstreams & Tasks

- [x] Add and pass targeted search tool tests.
- [x] Update user-facing docs and validation checklist.
- [x] Execute full build/test verification and capture outcomes.

## Risks & Mitigations

- Risk: E2E assertions may become brittle if tool ordering changes.
  Mitigation: Keep assertions order-independent by checking membership only.

- Risk: Documentation drift after API surface changes.
  Mitigation: Update README + VALIDATION in the same change as the registry/schema updates.

## Validation / QA Plan

- From repo root:
  - `npm run build`
  - `npm test`
- Confirm new tests specifically assert:
  - bounded response size
  - deterministic result ordering for representative queries
  - pass-through compatibility with `request_access` app shape

## Changelog

- 2026-04-02: Milestone created.
- 2026-04-02: Added concrete test/docs/verification acceptance criteria.
- 2026-04-02: Added search tool regression tests, updated docs, and validated with `npm test` (65/65 passing).
