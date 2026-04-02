---
id: EP-20260401-003
title: Add host self-awareness to capture and action flows
status: archived
kind: feature
domain: backend
owner: '@codex'
created: 2026-04-01
updated: '2026-04-01'
tags:
- host
- safety
- capture
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

# EP-20260401-003 - Add host self-awareness to capture and action flows

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date as work proceeds.

If `.agent/PLANS.md` exists in this repository, maintain this plan in accordance with that guidance.

## Purpose / Big Picture

After this change, the server will treat the connected host application as a first-class part of desktop safety. When the server is embedded in a host app or launched from a terminal app, screenshots will exclude that host where ScreenCaptureKit supports exclusion, hide/unhide flows will not hide the host, and input safety gates will tell the caller when the host has become the accidental target instead of letting host focus drift remain implicit. A human can verify the change by running the targeted regression tests and observing that capture fallback never hides the host bundle while keyboard and point-targeted tools fail closed with a host-specific message when the host is frontmost or under the action point.

## Scope

In scope are the session, transport, and host SDK changes needed to carry a host bundle identifier into the runtime; the new host-identity helper layer that resolves explicit metadata first and falls back to stdio parent-app inference; refactoring screenshot preparation so screenshot exclusion and fallback hiding are modeled separately; and host-aware safety checks for actions that already use frontmost-app and app-under-point resolution.

Out of scope are broad native keyboard coverage changes from item 2 in `docs/target.md`, any redesign of approval UI flows, and speculative daemon-only host discovery that would require new global configuration or new native process-inspection APIs. This plan will stay additive and session-scoped.

## Progress

- [x] (2026-04-01 23:59Z) Reviewed `docs/target.md`, the completed target-app safety ExecPlan, and the current runtime modules to isolate the host/self-awareness follow-on from the already-landed frontmost / under-point safety gates.
- [x] (2026-04-01 23:59Z) Audited `packages/computer-use-mcp/src/tools/actionScope.ts`, `captureScope.ts`, `captureWithFallback.ts`, `frontmostGate.ts`, the host SDK metadata builder, and the transport/session metadata path to determine where host identity must live.
- [x] (2026-04-01 23:59Z) Created this ExecPlan and milestone scaffolds with `agentrules execplan new` and `agentrules execplan milestone new`.
- [x] (2026-04-02 00:10Z) Implemented `packages/computer-use-mcp/src/runtime/hostIdentity.ts` plus the transport/session plumbing so host identity can come from initialize metadata or stdio parent-app inference and be cached per session.
- [x] (2026-04-02 00:10Z) Refactored capture preparation so screenshot exclusions and fallback-hide candidates are modeled separately, and ensured host bundles are excluded from screenshots but never hidden during pre-hide or fallback restore flows.
- [x] (2026-04-02 00:10Z) Added host-aware safety messaging plus new regression coverage in `hostIdentity.test.ts`, `actionScope.test.ts`, `captureWithFallback.test.ts`, and `targetAppSafety.test.ts`.
- [x] (2026-04-02 00:10Z) Verified the implementation with `npm test`, `swift build --package-path packages/native-swift -c release`, and `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext packages/host-sdk/src/*.ts`.

## Surprises & Discoveries

- Observation: the existing code already has the primitives needed for safe stdio host inference.
  Evidence: `packages/computer-use-mcp/src/native/bridgeTypes.ts` and `packages/computer-use-mcp/src/native/swiftBridge.ts` already expose `apps.listRunningApps()`, and the stdio server process can derive its parent chain from the local process table without adding a new native bridge call.

- Observation: the current `PreparedActionContext` shape conflates two different concepts: "exclude from screenshot capture" and "safe to temporarily hide when exclusion capture fails."
  Evidence: `packages/computer-use-mcp/src/tools/captureWithFallback.ts` currently derives the fallback hide set directly from `prepared.excludedBundleIds`, which would incorrectly make the host eligible for fallback hiding if the host were added to that list.

- Observation: the existing native bridge already had enough screenshot exclusion support for the host/self-awareness feature; no Swift code changes were required for the actual behavior change.
  Evidence: `packages/native-swift/Sources/ComputerUseBridge/ScreenshotService.swift` already routes non-empty `excludeBundleIds` through ScreenCaptureKit, so the host-aware behavior was unlocked by TypeScript-side exclusion-set management.

- Observation: the root monorepo build does not compile `packages/host-sdk`, even though the host SDK is part of this feature surface.
  Evidence: `package.json` only builds `packages/computer-use-mcp`, so a separate `npx tsc --noEmit ... packages/host-sdk/src/*.ts` verification step was necessary after changing `packages/host-sdk/src/sessionMetadata.ts`.

## Decision Log

- Decision: represent the host as a session-scoped `HostIdentity` object carried through connection metadata and cached on the session.
  Rationale: host identity must not leak across sessions, and it must be available to both capture logic and input safety gates without introducing new global state.
  Date/Author: 2026-04-01 / @codex

- Decision: accept explicit host metadata from initialize payloads first, then fall back to stdio parent-app inference when explicit metadata is absent.
  Rationale: embedded hosts can and should identify themselves directly, while terminal-hosted usage still needs a best-effort standalone path. The process-tree plus `listRunningApps()` approach is sufficient for stdio without changing the Swift bridge.
  Date/Author: 2026-04-01 / @codex

- Decision: do not auto-activate away from the host when the host is frontmost or under the action point.
  Rationale: automatic focus changes would be surprising, harder to test, and easier to misuse. Failing closed with a host-specific message preserves determinism and matches the existing safety model.
  Date/Author: 2026-04-01 / @codex

- Decision: split screenshot exclusion from fallback hiding in the prepared capture state.
  Rationale: the host should be excluded from screenshots where supported, but it must never be hidden as part of the fallback path on older macOS versions or failed ScreenCaptureKit calls.
  Date/Author: 2026-04-01 / @codex

- Decision: reuse the existing `excludeBundleIds` screenshot bridge surface instead of adding a new native method or a second exclusion channel.
  Rationale: the current native bridge already supports application exclusion, and keeping the change on the TypeScript side minimizes native regression risk while still satisfying the standalone production requirement.
  Date/Author: 2026-04-01 / @codex

## Outcomes & Retrospective

The host/self-awareness follow-on is implemented. Sessions now carry a `HostIdentity` resolved from explicit initialize metadata or, for stdio connections, from a best-effort parent-app inference path. Screenshot-style tools always request host exclusion where the native capture stack supports it, while the pre-hide and fallback-hide logic now treat the host as non-hideable. Input safety gates also explain when the host has become the accidental target instead of collapsing that case into a generic ungranted-app failure.

The change stayed additive. No new native bridge methods were required, fake mode still works, and the existing frontmost / under-point safety gates remain the single place where mutating tools decide whether to proceed. The remaining open item from `docs/target.md` is broader native key coverage, which this plan intentionally left untouched.

## Context and Orientation

The TypeScript MCP server lives in `packages/computer-use-mcp`. Tool execution enters through `packages/computer-use-mcp/src/mcp/server.ts` and `packages/computer-use-mcp/src/mcp/callRouter.ts`. Each tool call is associated with a `SessionContext` stored in `packages/computer-use-mcp/src/session/sessionContext.ts` and `packages/computer-use-mcp/src/session/sessionStore.ts`.

The current host-related metadata path is partial. `packages/host-sdk/src/sessionMetadata.ts` can send `sessionId`, `clientId`, and approval callback capability metadata, and `packages/computer-use-mcp/src/mcp/server.ts` stores that data on the connection. There is no runtime concept of a host application bundle identifier yet, so the action safety layer cannot distinguish the controlling host from any other ungranted app.

The capture preparation path is `packages/computer-use-mcp/src/tools/captureScope.ts`, `packages/computer-use-mcp/src/tools/actionScope.ts`, and `packages/computer-use-mcp/src/tools/captureWithFallback.ts`. Today `actionScope.ts` computes a single `excludedBundleIds` list from visible disallowed apps, and `captureWithFallback.ts` assumes every excluded app is safe to temporarily hide if ScreenCaptureKit exclusion fails. That is the exact coupling this plan must break.

The input safety path is now in `packages/computer-use-mcp/src/tools/frontmostGate.ts`. The new target-app safety ExecPlan already introduced frontmost-app and under-point resolution. This plan should build on those helpers rather than inventing a second input targeting model. "Host-aware activation behavior" in this repository will mean "if the controlling host app is the resolved target and the session did not intentionally grant it, fail closed with an explicit host-focused message." It will not mean automatic focus switching.

The native screenshot bridge already supports application exclusion through the existing `excludeBundleIds` capture option. In `packages/native-swift/Sources/ComputerUseBridge/ScreenshotService.swift`, any non-empty exclusion list routes capture through ScreenCaptureKit on macOS 14+, and older systems fall back by throwing an error. That means the TypeScript layer only needs to ensure the host bundle is included in the screenshot exclusion set and omitted from the fallback hide set.

## Plan of Work

First, add a dedicated host-identity helper module under `packages/computer-use-mcp/src/runtime/hostIdentity.ts`. This module will define the `HostIdentity` shape, normalize explicit initialize metadata, and provide a best-effort stdio inference helper. The stdio inference path will inspect the local process table, walk the current server process's ancestor chain, and match the first ancestor process that appears in `nativeHost.apps.listRunningApps()`. That yields the terminal app for terminal-hosted usage and the embedding app for direct host-spawned usage without adding a new Swift bridge method.

Second, wire that identity through the connection and session layers. `packages/host-sdk/src/sessionMetadata.ts` should emit an additive `computerUseHost` object when the caller supplies host name and bundle metadata. `packages/computer-use-mcp/src/mcp/server.ts`, `transport.ts`, `sessionIdentity.ts`, `callRouter.ts`, `sessionContext.ts`, and `sessionStore.ts` must all learn about `HostIdentity`. The session should cache whether host resolution was attempted so failed inference does not repeat on every tool call, but explicit initialize metadata must still override a previous empty inference result.

Third, refactor capture preparation. `packages/computer-use-mcp/src/tools/captureScope.ts` should always request host screenshot exclusion for screenshot-style tools. `packages/computer-use-mcp/src/tools/actionScope.ts` should compute a screenshot exclusion list that includes host bundles plus any visible disallowed bundles requested by configuration, while separately computing the subset of bundles that may be hidden on fallback. The host bundle must be removed from pre-hide flows for mutating actions and from fallback hiding in `packages/computer-use-mcp/src/tools/captureWithFallback.ts`.

Fourth, teach the action safety gates how to talk about the host. `packages/computer-use-mcp/src/tools/frontmostGate.ts` should detect when the resolved app matches `session.hostIdentity.bundleId`. If the session did not explicitly grant that host app, the tool should fail closed with a clearer message explaining that the controlling host is frontmost or under the action point. Existing typed errors can carry this message; a new error class is not required unless the implementation shows a real need for machine-level distinction.

Finally, add tests that prove the design instead of just the types. Add targeted coverage for host metadata parsing and stdio inference, host exemption from hide and fallback-hide flows, host exclusion in screenshot capture inputs, and host-specific safety failures in point-targeted and frontmost-app tools. Keep fake mode working, run the TypeScript test suite, and build the Swift bridge to confirm that no native regression was introduced.

## Milestones

### Milestone 1: Add session-scoped host identity resolution

At the end of this milestone, the session can carry a host identity from either explicit initialize metadata or stdio parent-app inference, and the host SDK can send the richer metadata. Verification is by targeted unit tests for the resolver logic and updated transport/session wiring that persists the identity per session.

### Milestone 2: Wire host-aware capture and hide behavior

At the end of this milestone, screenshot-style tools exclude the host bundle where supported, but neither the action pre-hide path nor the screenshot fallback path hides the host. Verification is by targeted capture tests that inspect the exclusion and hide sets directly.

### Milestone 3: Add host-aware safety tests and verify rollout

At the end of this milestone, mutating tools return host-focused fail-closed messages when the host accidentally becomes the target, and the repository verification commands pass. Verification is by the new tests plus `npm test` and `swift build --package-path packages/native-swift -c release`.

## Validation

From `/Volumes/AGENAI/Coding/public-github/computer-use-mcp-server`, run:

  npm test
  swift build --package-path packages/native-swift -c release
  npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext packages/host-sdk/src/*.ts

Green means the existing suite still passes together with the new host-awareness regressions. The key observable proof is that screenshot exclusion inputs now include the host bundle while fallback hiding does not, and that input tools fail with a host-specific explanation when the host is the accidental target.
