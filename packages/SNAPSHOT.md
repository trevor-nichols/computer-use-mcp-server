├── approval-ui-macos  # macOS app for displaying permission approval prompts
│   ├── Package.swift  # Swift package definition for ApprovalUIBridge
│   └── Sources  # Source code for the macOS approval UI
│       └── ApprovalUIBridge  # Main module for the approval UI bridge
│           └── main.swift  # Entry point for handling and displaying TCC/app permission alerts
├── computer-use-mcp  # Main Node.js MCP server for computer interaction
│   ├── package.json  # NPM package configuration for the MCP server
│   ├── src  # Source code for the MCP server
│   │   ├── approvals  # Logic for handling permission approval flows
│   │   │   ├── approvalCoordinator.ts  # Coordinates approvals between local UI and host callbacks
│   │   │   ├── approvalProvider.ts  # Interfaces for TCC and app access approval providers
│   │   │   ├── hostCallbackProvider.ts  # Provider delegating approvals to the connected MCP client/host
│   │   │   └── localUiProvider.ts  # Provider using the local macOS UI bridge for approvals
│   │   ├── config.ts  # Configuration loading and environment variable parsing
│   │   ├── errors  # Error handling and mapping
│   │   │   ├── errorMapper.ts  # Maps internal errors to MCP tool error responses
│   │   │   └── errorTypes.ts  # Custom error classes (e.g., MissingOsPermissionsError)
│   │   ├── main.ts  # Entry point for the MCP server, setting up transports and runtime
│   │   ├── mcp  # Model Context Protocol core implementation
│   │   │   ├── callRouter.ts  # Routes MCP tool calls and manages execution contexts
│   │   │   ├── jsonRpc.ts  # Types and utilities for JSON-RPC 2.0 messages
│   │   │   ├── server.ts  # Core MCP server handling initialization and tool dispatch
│   │   │   ├── sessionIdentity.ts  # Resolves session identities and capabilities from requests
│   │   │   ├── stdioTransport.ts  # Stdio-based transport for the MCP server
│   │   │   ├── streamableHttpTransport.ts  # HTTP/SSE transport for the MCP server
│   │   │   ├── toolRegistry.ts  # Registry defining all available computer use tools
│   │   │   ├── toolSchemas.ts  # JSON schemas for validating tool inputs
│   │   │   └── transport.ts  # Base interfaces and classes for MCP transports
│   │   ├── native  # Integration with the native macOS Swift bridge
│   │   │   ├── bridgeTypes.ts  # TypeScript interfaces mapping to native Swift bridge services
│   │   │   ├── helperClient.ts  # Process manager and client for the Swift bridge binary
│   │   │   └── swiftBridge.ts  # Adapter implementation for the native bridge with a fake mode fallback
│   │   ├── observability  # Logging and monitoring utilities
│   │   │   └── logger.ts  # Simple JSON logger for the MCP server
│   │   ├── permissions  # Application and OS permission management
│   │   │   ├── appAllowlist.ts  # Logic for checking and merging allowed applications
│   │   │   └── tcc.ts  # Logic for checking macOS TCC permissions (Accessibility/Screen Recording)
│   │   ├── runtime
│   │   │   └── hostIdentity.ts
│   │   ├── session  # Session management and state tracking
│   │   │   ├── cleanupRegistry.ts  # Manages cleanup tasks (e.g., releasing locks, unhiding apps)
│   │   │   ├── lock.ts  # File-based desktop control lock manager
│   │   │   ├── sessionContext.ts  # Defines context and state for an active session
│   │   │   └── sessionStore.ts  # In-memory storage and lifecycle management for sessions
│   │   ├── tools  # Implementations of individual computer use tools
│   │   │   ├── actionScope.ts  # Manages execution scopes, locks, and app hiding for tools
│   │   │   ├── applications.ts  # Tools for opening and listing allowed applications
│   │   │   ├── batch.ts  # Tool for executing a sequence of actions atomically
│   │   │   ├── captureScope.ts  # Determines scope options for screenshot captures
│   │   │   ├── captureWithFallback.ts  # Screenshot capture logic with fallback to temporary app hiding
│   │   │   ├── click.ts  # Tools for left, right, middle, and double mouse clicks
│   │   │   ├── clipboard.ts  # Tools for reading and writing the system clipboard
│   │   │   ├── cursorPosition.ts  # Tool for retrieving the current mouse cursor coordinates
│   │   │   ├── displayTargeting.ts  # Logic for automatically determining the best display to target
│   │   │   ├── drag.ts  # Tool for executing click-and-drag mouse actions
│   │   │   ├── frontmostGate.ts
│   │   │   ├── holdKey.ts  # Tool for holding down specified keys for a duration
│   │   │   ├── key.ts  # Tool for pressing specific key sequences or shortcuts
│   │   │   ├── mouseMove.ts  # Tool for moving the mouse cursor to specific coordinates
│   │   │   ├── requestAccess.ts  # Tool for explicitly requesting user permissions
│   │   │   ├── screenshot.ts  # Tool for capturing full screenshots of a display
│   │   │   ├── scroll.ts  # Tool for scrolling the mouse wheel
│   │   │   ├── selectDisplay.ts  # Tool for manually pinning a specific display for actions
│   │   │   ├── typeText.ts  # Tool for typing text via keyboard injection or clipboard pasting
│   │   │   ├── wait.ts  # Tool for sleeping/waiting for a specified duration
│   │   │   └── zoom.ts  # Tool for capturing a cropped/zoomed region of a display
│   │   └── transforms  # Math and coordinate transformations
│   │       ├── coordinates.ts  # Maps screenshot coordinates back to logical desktop coordinates
│   │       └── screenshotSizing.ts  # Calculates dimensions for scaling down large screenshots
│   ├── test  # Unit and integration tests for the MCP server
│   │   ├── actionScope.test.ts  # Tests for action execution scopes and app hiding
│   │   ├── approvalCoordinator.test.ts  # Tests for the approval coordination logic
│   │   ├── batch.test.ts  # Tests for the batched tool execution
│   │   ├── captureScope.test.ts  # Tests for screenshot scope configuration
│   │   ├── captureWithFallback.test.ts  # Tests for screenshot app hiding fallback logic
│   │   ├── coordinates.test.ts  # Tests for coordinate mapping math
│   │   ├── displayTargeting.test.ts  # Tests for auto-display targeting logic
│   │   ├── errorMapper.test.ts  # Tests for error-to-MCP-response mapping
│   │   ├── escapeHotkey.test.ts  # Tests for escape key abort monitoring
│   │   ├── hostIdentity.test.ts
│   │   ├── lock.test.ts  # Tests for the file-based lock manager
│   │   ├── screenshotAutoTarget.test.ts  # Tests for screenshot display auto-targeting
│   │   ├── screenshotSizing.test.ts  # Tests for screenshot downscaling logic
│   │   ├── selectDisplay.test.ts  # Tests for the select_display tool
│   │   ├── sessionStore.test.ts  # Tests for session storage and lifecycle
│   │   ├── stdio.e2e.test.ts  # End-to-end tests for the stdio transport and tools
│   │   ├── streamableHttpTransport.test.ts  # Tests for the HTTP/SSE transport
│   │   └── targetAppSafety.test.ts
│   └── tsconfig.json  # TypeScript configuration for the MCP server
├── host-sdk  # SDK for host applications to interact with the MCP server
│   └── src  # Source code for the host SDK
│       ├── approvalCallbacks.ts  # Types and helpers for host-side approval callbacks
│       ├── index.ts  # Main export module for the host SDK
│       └── sessionMetadata.ts  # Types and helpers for session metadata and initialization
├── native-input  # Placeholder Rust package for native input
│   ├── Cargo.toml  # Rust package manifest
│   └── src  # Rust source code
│       └── lib.rs  # Placeholder library implementation
└── native-swift  # Native macOS Swift bridge for OS integrations
    ├── Package.swift  # Swift package definition for ComputerUseBridge
    ├── Sources  # Source code for the Swift bridge
    │   └── ComputerUseBridge  # Main module for the Swift bridge
    │       ├── AppService.swift  # Service for listing, opening, and hiding macOS applications
    │       ├── BridgeMain.swift  # Entry point and JSON-RPC router for the Swift bridge
    │       ├── ClipboardService.swift  # Service for reading and writing the macOS clipboard
    │       ├── DisplayService.swift  # Service for querying connected displays and their properties
    │       ├── HotkeyService.swift  # Service for monitoring global escape key aborts
    │       ├── InputKey.swift  # Shared key normalization, alias resolution, and CGKeyCode mapping
    │       ├── InputService.swift  # Service for injecting synthetic mouse and keyboard events
    │       ├── Models.swift  # JSON parsing, error modeling, and utility functions
    │       ├── ScreenshotService.swift  # Service for capturing screenshots using ScreenCaptureKit
    │       ├── SyntheticInputMarker.swift  # Utility to mark and filter synthetically injected input events
    │       └── TccService.swift  # Service for checking macOS TCC permissions (Accessibility/Screen Recording)
    └── Tests  # Swift package tests for the native bridge
        └── ComputerUseBridgeTests
            └── InputKeyResolverTests.swift  # Covers native key aliases, mappings, and fail-closed resolution
