import os from 'node:os'
import path from 'node:path'

export interface RuntimeConfig {
  serverName: string
  serverVersion: string
  fakeMode: boolean
  repoRoot: string
  lockPath: string
  protocolVersion: string
  supportedProtocolVersions: string[]
  approvalDefaultMode: 'local-ui' | 'host-callback' | 'hybrid'
  approvalRequestTimeoutMs: number
  screenshotDefaultFormat: 'jpeg' | 'png'
  screenshotTargetMaxDimension: number
  screenshotJpegQuality: number
  clickSettleMs: number
  dragAnimationMs: number
  clipboardSyncDelayMs: number
  clipboardPasteSettleMs: number
  nativeCallTimeoutMs: number
  hideDisallowedBeforeAction: boolean
  excludeDisallowedFromScreenshots: boolean
  sessionTtlMs: number
  daemonMode: boolean
  enableStdio: boolean
  enableStreamableHttp: boolean
  streamableHttpBindHost: string
  streamableHttpPort: number
  streamableHttpRequireOriginValidation: boolean
  streamableHttpAllowedOrigins: string[]
  swiftBridgePath?: string
  approvalUiPath?: string
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === '1' || value.toLowerCase() === 'true'
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export function loadConfig(): RuntimeConfig {
  const repoRoot = process.cwd()
  const home = os.homedir()
  const daemonMode = parseBoolean(process.env.COMPUTER_USE_DAEMON, false)
  const enableStreamableHttp = parseBoolean(process.env.COMPUTER_USE_ENABLE_HTTP, daemonMode)
  const enableStdio = parseBoolean(process.env.COMPUTER_USE_ENABLE_STDIO, !daemonMode)

  return {
    serverName: 'computer-use',
    serverVersion: '0.2.0',
    fakeMode: parseBoolean(process.env.COMPUTER_USE_FAKE, false),
    repoRoot,
    lockPath: process.env.COMPUTER_USE_LOCK_PATH ?? path.join(home, '.computer-use-mcp', 'desktop.lock'),
    protocolVersion: '2025-11-25',
    supportedProtocolVersions: ['2025-03-26', '2025-06-18', '2025-11-25'],
    approvalDefaultMode: (process.env.COMPUTER_USE_APPROVAL_MODE as RuntimeConfig['approvalDefaultMode'] | undefined) ?? 'hybrid',
    approvalRequestTimeoutMs: parseNumber(process.env.COMPUTER_USE_APPROVAL_TIMEOUT_MS, 15_000),
    screenshotDefaultFormat: (process.env.COMPUTER_USE_SCREENSHOT_FORMAT as 'jpeg' | 'png' | undefined) ?? 'jpeg',
    screenshotTargetMaxDimension: parseNumber(process.env.COMPUTER_USE_SCREENSHOT_MAX_DIMENSION, 1440),
    screenshotJpegQuality: parseNumber(process.env.COMPUTER_USE_SCREENSHOT_JPEG_QUALITY, 80),
    clickSettleMs: parseNumber(process.env.COMPUTER_USE_CLICK_SETTLE_MS, 75),
    dragAnimationMs: parseNumber(process.env.COMPUTER_USE_DRAG_ANIMATION_MS, 180),
    clipboardSyncDelayMs: parseNumber(process.env.COMPUTER_USE_CLIPBOARD_SYNC_DELAY_MS, 150),
    clipboardPasteSettleMs: parseNumber(process.env.COMPUTER_USE_CLIPBOARD_PASTE_SETTLE_MS, 400),
    nativeCallTimeoutMs: parseNumber(process.env.COMPUTER_USE_NATIVE_TIMEOUT_MS, 10_000),
    hideDisallowedBeforeAction: parseBoolean(process.env.COMPUTER_USE_HIDE_DISALLOWED, false),
    excludeDisallowedFromScreenshots: parseBoolean(process.env.COMPUTER_USE_EXCLUDE_DISALLOWED_SCREENSHOTS, true),
    sessionTtlMs: parseNumber(process.env.COMPUTER_USE_SESSION_TTL_MS, 30 * 60 * 1000),
    daemonMode,
    enableStdio,
    enableStreamableHttp,
    streamableHttpBindHost: process.env.COMPUTER_USE_HTTP_HOST ?? '127.0.0.1',
    streamableHttpPort: parseNumber(process.env.COMPUTER_USE_HTTP_PORT, 3900),
    streamableHttpRequireOriginValidation: parseBoolean(process.env.COMPUTER_USE_HTTP_VALIDATE_ORIGIN, true),
    streamableHttpAllowedOrigins: parseCsv(process.env.COMPUTER_USE_HTTP_ALLOWED_ORIGINS),
    swiftBridgePath: process.env.COMPUTER_USE_SWIFT_BRIDGE_PATH,
    approvalUiPath: process.env.COMPUTER_USE_APPROVAL_UI_PATH,
  }
}
