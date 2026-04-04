import { loadConfig } from './config.js'
import { createLogger } from './observability/logger.js'
import { SessionStore } from './session/sessionStore.js'
import { DesktopLockManager } from './session/lock.js'
import { createNativeHost } from './native/nativeHost.js'
import { CaptureAssetStore } from './assets/captureAssetStore.js'
import { LocalUiApprovalProvider } from './approvals/localUiProvider.js'
import { HostCallbackApprovalProvider } from './approvals/hostCallbackProvider.js'
import { ApprovalCoordinator } from './approvals/approvalCoordinator.js'
import { ComputerUseMcpServer } from './mcp/server.js'
import { connectStdioTransport } from './mcp/stdioTransport.js'
import { StreamableHttpTransport } from './mcp/streamableHttpTransport.js'
import type { TransportAdapter } from './mcp/transport.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const logger = createLogger()
  const captureAssetStore = new CaptureAssetStore(config.captureAssetRoot, logger)
  await captureAssetStore.initialize()
  const sessionStore = new SessionStore()
  const lockManager = new DesktopLockManager(config.lockPath)
  const nativeHost = createNativeHost(config, logger)
  const localApprovalProvider = new LocalUiApprovalProvider(config, logger)
  const hostApprovalProvider = new HostCallbackApprovalProvider(config.approvalRequestTimeoutMs, logger)
  const approvalCoordinator = new ApprovalCoordinator(nativeHost, localApprovalProvider, hostApprovalProvider, logger)

  const runtime = {
    config,
    sessionStore,
    lockManager,
    approvalCoordinator,
    nativeHost,
    captureAssetStore,
    logger,
  }

  const server = new ComputerUseMcpServer(runtime)
  const transports: TransportAdapter[] = []
  let shuttingDown = false

  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true

    for (const transport of [...transports].reverse()) {
      await transport.stop().catch(error => {
        logger.warn('transport shutdown failed', {
          transport: transport.name,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }

    await captureAssetStore.cleanupAll().catch(error => {
      logger.warn('capture asset cleanup failed during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())

  if (config.enableStreamableHttp) {
    const httpTransport = new StreamableHttpTransport(server, config, sessionStore, captureAssetStore, logger)
    await httpTransport.start()
    transports.push(httpTransport)
  }

  if (config.enableStdio) {
    const stdioTransport = await connectStdioTransport(server, logger)
    transports.push(stdioTransport)
    logger.info('computer-use MCP server connected over stdio', { fakeMode: config.fakeMode })
  } else if (!config.enableStreamableHttp) {
    throw new Error('At least one transport must be enabled.')
  }
}

main().catch(error => {
  const logger = createLogger()
  logger.error('fatal startup error', error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error)
  process.exitCode = 1
})
