<project_structure>
├── docs
│   ├── macos-computer-use-implementation-plan.md
│   ├── macos-computer-use-reimplementation-spec.md
│   └── macos-computer-use-starter-code-canvas.md
├── packages
│   ├── approval-ui-macos
│   │   ├── .build
│   │   ├── Sources
│   │   │   └── ApprovalUIBridge
│   │   │       └── main.swift
│   │   └── Package.swift
│   ├── computer-use-mcp
│   │   ├── src
│   │   │   ├── approvals
│   │   │   │   ├── approvalCoordinator.ts
│   │   │   │   ├── approvalProvider.ts
│   │   │   │   ├── hostCallbackProvider.ts
│   │   │   │   └── localUiProvider.ts
│   │   │   ├── errors
│   │   │   │   ├── errorMapper.ts
│   │   │   │   └── errorTypes.ts
│   │   │   ├── mcp
│   │   │   │   ├── callRouter.ts
│   │   │   │   ├── jsonRpc.ts
│   │   │   │   ├── server.ts
│   │   │   │   ├── sessionIdentity.ts
│   │   │   │   ├── stdioTransport.ts
│   │   │   │   ├── streamableHttpTransport.ts
│   │   │   │   ├── toolRegistry.ts
│   │   │   │   ├── toolSchemas.ts
│   │   │   │   └── transport.ts
│   │   │   ├── native
│   │   │   │   ├── bridgeTypes.ts
│   │   │   │   ├── helperClient.ts
│   │   │   │   └── swiftBridge.ts
│   │   │   ├── observability
│   │   │   │   └── logger.ts
│   │   │   ├── permissions
│   │   │   │   ├── appAllowlist.ts
│   │   │   │   └── tcc.ts
│   │   │   ├── runtime
│   │   │   │   └── hostIdentity.ts
│   │   │   ├── session
│   │   │   │   ├── cleanupRegistry.ts
│   │   │   │   ├── lock.ts
│   │   │   │   ├── sessionContext.ts
│   │   │   │   └── sessionStore.ts
│   │   │   ├── tools
│   │   │   │   ├── actionScope.ts
│   │   │   │   ├── applications.ts
│   │   │   │   ├── batch.ts
│   │   │   │   ├── captureScope.ts
│   │   │   │   ├── captureWithFallback.ts
│   │   │   │   ├── click.ts
│   │   │   │   ├── clipboard.ts
│   │   │   │   ├── cursorPosition.ts
│   │   │   │   ├── displayTargeting.ts
│   │   │   │   ├── drag.ts
│   │   │   │   ├── frontmostGate.ts
│   │   │   │   ├── holdKey.ts
│   │   │   │   ├── key.ts
│   │   │   │   ├── mouseMove.ts
│   │   │   │   ├── requestAccess.ts
│   │   │   │   ├── screenshot.ts
│   │   │   │   ├── scroll.ts
│   │   │   │   ├── selectDisplay.ts
│   │   │   │   ├── typeText.ts
│   │   │   │   ├── wait.ts
│   │   │   │   └── zoom.ts
│   │   │   ├── transforms
│   │   │   │   ├── coordinates.ts
│   │   │   │   └── screenshotSizing.ts
│   │   │   ├── config.ts
│   │   │   ├── main.ts
│   │   │   └── shims-node.d.ts
│   │   ├── test
│   │   │   ├── actionScope.test.ts
│   │   │   ├── approvalCoordinator.test.ts
│   │   │   ├── batch.test.ts
│   │   │   ├── captureScope.test.ts
│   │   │   ├── captureWithFallback.test.ts
│   │   │   ├── coordinates.test.ts
│   │   │   ├── displayTargeting.test.ts
│   │   │   ├── errorMapper.test.ts
│   │   │   ├── escapeHotkey.test.ts
│   │   │   ├── hostIdentity.test.ts
│   │   │   ├── lock.test.ts
│   │   │   ├── screenshotAutoTarget.test.ts
│   │   │   ├── screenshotSizing.test.ts
│   │   │   ├── selectDisplay.test.ts
│   │   │   ├── sessionStore.test.ts
│   │   │   ├── stdio.e2e.test.ts
│   │   │   ├── streamableHttpTransport.test.ts
│   │   │   └── targetAppSafety.test.ts
│   │   └── package.json
│   ├── host-sdk
│   │   └── src
│   │       ├── approvalCallbacks.ts
│   │       ├── index.ts
│   │       └── sessionMetadata.ts
│   ├── native-input
│   │   ├── src
│   │   │   └── lib.rs
│   │   └── Cargo.toml
│   ├── native-swift
│   │   ├── .build
│   │   ├── Sources
│   │   │   └── ComputerUseBridge
│   │   │       ├── AppService.swift
│   │   │       ├── BridgeMain.swift
│   │   │       ├── ClipboardService.swift
│   │   │       ├── DisplayService.swift
│   │   │       ├── HotkeyService.swift
│   │   │       ├── InputKey.swift
│   │   │       ├── InputService.swift
│   │   │       ├── Models.swift
│   │   │       ├── ScreenshotService.swift
│   │   │       ├── SyntheticInputMarker.swift
│   │   │       └── TccService.swift
│   │   ├── Tests
│   │   │   └── ComputerUseBridgeTests
│   │   │       └── InputKeyResolverTests.swift
│   │   └── Package.swift
│   └── SNAPSHOT.md
├── package.json
├── tsconfig.base.json
└── VALIDATION.md
</project_structure>
