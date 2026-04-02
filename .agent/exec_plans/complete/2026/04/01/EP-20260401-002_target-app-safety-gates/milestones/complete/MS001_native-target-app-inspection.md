---
id: EP-20260401-002/MS001
execplan_id: EP-20260401-002
ms: 1
title: "Add native target-app inspection bridge"
status: completed
domain: backend
owner: "@codex"
created: 2026-04-01
updated: 2026-04-01
tags:
- safety
- swift
- bridge
risk: med
links:
  issue: ""
  docs: "docs/target.md"
  pr: ""
---

# Add native target-app inspection bridge

This milestone is a living document. Keep the YAML front matter accurate as work proceeds.

## Objective

Give the TypeScript runtime two new native inspection primitives: one for the current frontmost regular app and one for the app that owns the topmost on-screen window covering a desktop point. After this milestone, the server can make safety decisions using actual desktop state instead of only pre-hiding heuristics.

## Definition of Done

- `packages/native-swift/Sources/ComputerUseBridge/AppService.swift` exposes native lookups for the frontmost app and app under point
- `packages/native-swift/Sources/ComputerUseBridge/BridgeMain.swift` routes both methods
- `packages/computer-use-mcp/src/native/bridgeTypes.ts` and `packages/computer-use-mcp/src/native/swiftBridge.ts` expose typed bridge methods
- Fake mode provides deterministic implementations for both methods
- `npm test` passes or targeted tests for the bridge surface pass if later milestones are not yet wired
- Milestone status is updated when implementation and validation finish

## Scope

### In Scope
- Native app-inspection methods and their bridge plumbing
- Shared TypeScript bridge types for returned app identity
- Fake-mode support for tests

### Out of Scope
- Enforcing the safety decisions in tool handlers
- Host/self-awareness exclusions
- Additional keyboard coverage

## Workstreams & Tasks

### Workstream A: Native app identity methods

- [x] Add a compact app-identity payload shape in Swift
- [x] Implement `getFrontmostApp`
- [x] Implement `appUnderPoint`

### Workstream B: TypeScript bridge plumbing

- [x] Extend TypeScript bridge contracts
- [x] Expose the new calls through `swiftBridge.ts`
- [x] Add deterministic fake implementations for tests

## Risks & Mitigations

- Risk: point ownership can be ambiguous when macOS reports overlay or non-regular windows first.
  Mitigation: restrict resolution to regular applications with bundle identifiers and scan the on-screen window list in z-order until the first matching point owner is found.

## Validation / QA Plan

- Run the targeted safety-gate test file once it exists.
- Run `npm test` from the repository root before marking the milestone complete.
- Verify fake mode still boots the server and supports the new bridge surface.

## Changelog

- 2026-04-01: Milestone created.
- 2026-04-01: Expanded milestone with concrete Swift bridge and fake-mode scope.
- 2026-04-01: Completed by adding `getFrontmostApp` and `appUnderPoint` across the Swift and TypeScript bridge layers.
