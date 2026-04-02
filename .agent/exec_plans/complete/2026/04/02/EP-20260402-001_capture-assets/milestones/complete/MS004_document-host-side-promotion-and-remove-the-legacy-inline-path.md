---
id: EP-20260402-001/MS004
execplan_id: EP-20260402-001
ms: 4
title: "Document host-side promotion and remove the legacy inline path"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-02
updated: 2026-04-02
tags: [docs, rollout]
risk: low
links:
  issue: ""
  docs: ".agent/exec_plans/complete/2026/04/02/EP-20260402-001_capture-assets/EP-20260402-001_capture-assets.md"
  pr: ""
---

# Document host-side promotion and remove the legacy inline path

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Close out the earlier host-promotion milestone after the design pivot to Codex-specific `imagePath` delivery. When this milestone is done, the plan record will make it explicit that no separate host-promotion layer remains in scope for this repo.

## Definition of Done

- The milestone records that the earlier `resource_link` and inline-image rollout plan was superseded
- The active ExecPlan points readers to the final `imagePath` plus `view_image` contract
- There is no remaining ambiguity about whether this milestone still requires implementation work

## Scope

### In Scope
- Document that the original milestone objective is obsolete after the Codex-only pivot
- Point readers at the final contract in the active ExecPlan and capture docs

### Out of Scope
- Reintroducing `resource_link`, `resources/read`, or inline-image compatibility
- Adding a separate host integration layer back into this repo

## Workstreams & Tasks

- [x] Record the milestone as superseded by the Codex-specific `imagePath` contract
- [x] Update the active plan so readers are redirected to the final design

## Risks & Mitigations

- Risk: readers may assume this milestone still represents outstanding work.
  Mitigation: close it explicitly and note that milestone 5 replaced its implementation intent.

## Validation / QA Plan

- Check that the active ExecPlan and docs describe `imagePath` plus `view_image`, not host-side asset promotion.

## Changelog

- 2026-04-02: Milestone created.
- 2026-04-02: Closed as superseded after the pivot from MCP asset promotion to Codex `imagePath` delivery.
