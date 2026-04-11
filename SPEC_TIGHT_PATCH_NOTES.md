# Spec-Tight MCP Patch Notes

## What changed

This patch hardens the MCP implementation around protocol correctness, transport behavior, and runtime schema validation.

### Protocol and lifecycle
- Narrowed supported MCP protocol versions to `2025-11-25`.
- Added explicit per-connection lifecycle state (`pre_initialize`, `initialize_responded`, `ready`, `closed`).
- Enforced `initialize` as the first request and disallowed repeated `initialize` on the same connection.
- Enforced `notifications/initialized` before normal operations like `tools/list` and `tools/call`.
- Split JSON-RPC handling into request / notification / response paths.
- Tightened JSON-RPC id handling to `string | number` only.

### Schema validation
- Added central JSON Schema validation with Ajv 2020-12.
- Added protocol request validators for:
  - `initialize`
  - `notifications/initialized`
  - `tools/list`
  - `tools/call`
- Added runtime validation for every tool input schema.
- Added output schema validation for stable structured tool results.
- Changed invalid tool arguments to return a `CallToolResult` error with `isError: true`.
- Changed unknown tool lookup to return JSON-RPC `-32602`.

### Transport hardening
- STDIO transport now rejects JSON-RPC batch payloads.
- STDIO transport keeps notifications response-free and only logs rejected notifications.
- Streamable HTTP transport now:
  - rejects JSON array bodies / JSON-RPC batches
  - validates `Accept` headers
  - validates session-scoped `MCP-Protocol-Version` headers
  - returns negotiated protocol version headers
  - returns `202 Accepted` for accepted notifications / responses
  - sets `Allow` on `405 Method Not Allowed`
  - keeps origin validation and session enforcement

### Tooling and batch execution
- Tightened tool schemas, including exact-one selection for `select_display`.
- Added output schemas for stable structured-content tools.
- Reworked `computer_batch` so nested actions are validated against real subtool schemas before execution.

## Validation run in this environment
- `npm run build`
- `npm test`

Result: full build and test suite passing.

## Local validations still worth running
These require your local macOS / real host environment and could not be fully exercised here:
- real STDIO host integration with your MCP client / host
- real Streamable HTTP client integration
- native macOS permission flows (Accessibility / Screen Recording)
- real desktop input backends beyond fake mode
- end-to-end approval callback flows with your actual host application
