---
id: EP-20260401-002
title: Add fail-closed target app safety gates
status: archived
kind: feature
domain: backend
owner: '@codex'
created: 2026-04-01
updated: '2026-04-01'
tags:
- safety
- applications
- input
touches:
- api
- security
- tests
- docs
risk: med
breaking: false
migration: false
links:
  issue: ''
  pr: ''
  docs: docs/target.md
depends_on: []
supersedes: []
---

# EP-20260401-002 - Add fail-closed target app safety gates

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date as work proceeds.

If `.agent/PLANS.md` exists in this repository, maintain this plan in accordance with that guidance.

## Purpose / Big Picture

After this change, mutating desktop actions will verify the actual application they are about to target immediately before sending input. If the frontmost app or the app under the target point is outside the session's granted application set, the tool will fail closed instead of sending input anyway. A human can verify the change by running the new regression tests and by observing that click, drag, and type flows now return a structured safety error when the resolved target app is not granted.

## Scope

In scope are the native and TypeScript changes required to resolve the frontmost macOS application and the application that owns the window under a desktop point, expose that data through the Swift bridge, and enforce those checks inside the pre-action path for mutating tools. This includes fake-mode behavior, error mapping, targeted regression coverage, and keeping lock, approval, and cleanup behavior unchanged.

Out of scope are host/self-awareness changes from item 2 in `docs/target.md`, screenshot/capture exclusion redesign, new environment variables, and broad native keyboard coverage work from item 3 in `docs/target.md`. Those remain follow-on work after the safety gates land.

## Progress

- [x] (2026-04-01 23:41Z) Reviewed `docs/target.md`, `SNAPSHOT.md`, and `packages/SNAPSHOT.md` against the current codebase and confirmed that frontmost / under-cursor safety gates are still the highest-priority remaining production gap.
- [x] (2026-04-01 23:41Z) Audited the current safety and input path in `packages/computer-use-mcp/src/tools/actionScope.ts`, the mutating tool handlers, and the Swift bridge, and confirmed that input still reaches `nativeHost.input` without a final target-app validation step.
- [x] (2026-04-01 23:44Z) Created this ExecPlan and milestone scaffolds with `agentrules execplan new` and `agentrules execplan milestone new`.
- [x] (2026-04-01 23:47Z) Implemented native target-app inspection APIs in `packages/native-swift/Sources/ComputerUseBridge/AppService.swift` and bridged them through `BridgeMain.swift`, `bridgeTypes.ts`, and `swiftBridge.ts`, including fake-mode support.
- [x] (2026-04-01 23:48Z) Added `packages/computer-use-mcp/src/tools/frontmostGate.ts` and wired fail-closed validation into click, drag, type, key, hold_key, and scroll before their first mutating side effect.
- [x] (2026-04-01 23:49Z) Added `packages/computer-use-mcp/test/targetAppSafety.test.ts` covering allowed, denied, unresolved, and no-grant behavior.
- [x] (2026-04-01 23:49Z) Verified the native bridge with `swift build --package-path packages/native-swift -c release`.
- [x] (2026-04-01 23:50Z) Ran `npm test` successfully with 46 passing tests.

## Surprises & Discoveries

- Observation: the native layer already contains enough window-listing machinery to resolve app-to-display visibility, which means the bridge can likely derive point ownership without introducing a new macOS dependency.
  Evidence: `packages/native-swift/Sources/ComputerUseBridge/AppService.swift` already uses `CGWindowListCopyWindowInfo` to map windows to displays.

- Observation: preserving backward compatibility requires the new gate to activate only when the session actually has app grants.
  Evidence: many existing unit tests and fake-mode flows intentionally exercise input tools without `session.allowedApps`, and those flows continued to pass once the helper treated an empty grant set as "no app-scoped gate configured" rather than as an implicit deny-all.

- Observation: `scroll` should use the app under the scroll point rather than the frontmost app.
  Evidence: the tool already maps an explicit desktop point before scrolling, so validating that point aligns the safety check with the actual target semantics better than a frontmost-only check.

## Decision Log

- Decision: make frontmost / under-cursor validation the next active ExecPlan before host-awareness or broader key coverage work.
  Rationale: this closes the most important remaining fail-closed safety gap. The current product can lock the desktop and hide disallowed apps, but it still lacks the final target check immediately before input injection.
  Date/Author: 2026-04-01 / @codex

- Decision: keep host/self-awareness explicitly out of scope for this plan and document it as the first follow-on after implementation.
  Rationale: host identity touches capture, hide/unhide, and activation semantics across more surfaces. Mixing it into the initial safety-gate implementation would increase risk and slow delivery of the more urgent fail-closed guard.
  Date/Author: 2026-04-01 / @codex

- Decision: enforce target-app validation only when `session.allowedApps` is non-empty.
  Rationale: this keeps the feature additive and preserves existing fake-mode and low-level transform tests that are not modeling app-grant behavior, while still making granted sessions fail closed against the resolved target app.
  Date/Author: 2026-04-01 / @codex

- Decision: gate `scroll` by the app under the mapped point and gate `hold_key` by the frontmost app.
  Rationale: point-targeted tools should validate the UI element they are about to interact with, while active-UI keyboard tools should validate the focused application.
  Date/Author: 2026-04-01 / @codex

## Outcomes & Retrospective

The fail-closed target-app safety gate is now implemented. The Swift bridge can resolve the frontmost app and the app under a desktop point, and the TypeScript runtime uses those primitives to block input before click, drag, scroll, type, key, and hold_key when the resolved target app is ungranted or unknown. The new regression file proves allowed, denied, unresolved, and backward-compatible no-grant flows, and the native Swift package plus the full Node test suite both passed.

The remaining production gap from `docs/target.md` is still the host/self-awareness follow-on. This plan deliberately leaves host bundle identity, host exclusion from hide/unhide, and host-aware capture exclusion for a separate ExecPlan rather than merging those changes into the first target-app gate rollout.

## Context and Orientation

The desktop automation server lives under `packages/computer-use-mcp`. Tool execution enters through `packages/computer-use-mcp/src/mcp/server.ts` and `packages/computer-use-mcp/src/mcp/callRouter.ts`, where each tool call is associated with a `SessionContext`. The session records the granted applications for that caller in `packages/computer-use-mcp/src/session/sessionContext.ts`.

The current action safety layer is `packages/computer-use-mcp/src/tools/actionScope.ts`. It acquires the desktop lock, registers the escape-abort monitor, resolves a target display, and optionally hides or excludes disallowed applications. That layer does not currently ask which application is frontmost or which application owns the window under the target point. After `withActionScope()` returns, the mutating tools directly call `nativeHost.input` methods.

The mutating tool implementations that matter for this plan are `packages/computer-use-mcp/src/tools/click.ts`, `packages/computer-use-mcp/src/tools/drag.ts`, `packages/computer-use-mcp/src/tools/typeText.ts`, `packages/computer-use-mcp/src/tools/key.ts`, `packages/computer-use-mcp/src/tools/scroll.ts`, and `packages/computer-use-mcp/src/tools/mouseMove.ts`. Click, drag, scroll, and mouse move operate on screenshot coordinates that are transformed into desktop coordinates. Type and key operate on the currently focused UI and therefore need frontmost-app validation rather than point-based validation alone.

The native bridge lives in `packages/native-swift/Sources/ComputerUseBridge`. `AppService.swift` already lists running apps, activates apps, hides apps, and enumerates visible windows for display targeting. `BridgeMain.swift` exposes bridge methods over a simple JSON-RPC line protocol. The TypeScript side mirrors that surface in `packages/computer-use-mcp/src/native/bridgeTypes.ts` and `packages/computer-use-mcp/src/native/swiftBridge.ts`. Any new native capability must be wired through all three layers and must keep fake mode working.

For this plan, a "fail-closed safety gate" means the tool refuses to send input unless the resolved target app is known and allowed for the current session. "Frontmost app" means the active regular macOS application. "App under point" means the bundle identifier of the frontmost on-screen window that contains a given desktop coordinate. If the native layer cannot resolve the app or resolves an app outside the granted set, the tool must return an error rather than trying to continue.

## Plan of Work

First, extend the native bridge so the server can ask two concrete questions: which regular app is frontmost right now, and which regular app owns the topmost on-screen window covering a desktop point. Implement those lookups in `packages/native-swift/Sources/ComputerUseBridge/AppService.swift`, expose them in `BridgeMain.swift`, add matching TypeScript bridge types, and provide fake-mode behavior that is deterministic for tests.

Second, add a dedicated TypeScript helper, likely `packages/computer-use-mcp/src/tools/frontmostGate.ts`, that validates the resolved app against `session.allowedApps`. This helper should provide separate entry points for frontmost-only and point-targeted checks so the callers remain explicit. The helper should produce typed, machine-usable errors through the existing error mapping path rather than ad hoc strings.

Third, wire the helper into the mutating tool path. Click and drag should validate the app under the target point before the final input step. Type, key, and hold_key should validate the frontmost app before clipboard writes or keystrokes. Scroll should validate the app under the mapped scroll point because the tool already targets a concrete location. Mouse move should remain out of the first enforcement pass because it does not itself mutate application state.

Finally, add deterministic regression coverage in `packages/computer-use-mcp/test` for allowed and disallowed frontmost cases, allowed and disallowed under-cursor cases, unresolved target cases, and fake-mode behavior. Run `npm test` from the repository root and keep the plan plus milestone files updated with completion notes and follow-on work.

## Milestones

### Milestone 1: Add native target-app inspection bridge

At the end of this milestone, the Swift bridge can report the frontmost app and the app under a desktop point, and the TypeScript adapter exposes those methods in both real and fake mode. Verification is by targeted tests that exercise the TypeScript-side bridge contract and by implementation review of the new native methods.

### Milestone 2: Enforce fail-closed action safety gates

At the end of this milestone, click, drag, type, and the chosen active-UI tools refuse to send input when the resolved target app is ungranted or unknown. Verification is by targeted tool tests that fail before the change and pass after it, together with machine-usable error assertions.

### Milestone 3: Add regression coverage and capture host-awareness follow-on

At the end of this milestone, the full test suite passes and this ExecPlan clearly records host/self-awareness as the next plan instead of leaving that work implicit. Verification is by `npm test` and updated plan documentation that names the explicit follow-on.

## Explicit Follow-On: Host / Self-Awareness

This plan intentionally does not implement item 2 from `docs/target.md`. Once fail-closed target gating lands, the next ExecPlan should add a runtime concept of host bundle identity, exempt the host from hide/unhide flows, prefer host exclusion from screenshot capture where supported, and prevent host activation from becoming the accidental click target. That work should build on the new target-app inspection primitives instead of competing with them in the same implementation.

## Validation

From `/Volumes/AGENAI/Coding/public-github/computer-use-mcp-server`, run:

  npm test

Green means the existing suite still passes together with the new target-app safety coverage. The most important observable proof is that mutating-tool tests now show fail-closed behavior when the resolved frontmost app or the app under the action point falls outside the session's granted set.
