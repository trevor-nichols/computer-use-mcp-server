import { loadConfig } from './config.js'
import { createLogger } from './observability/logger.js'
import { SessionStore } from './session/sessionStore.js'
import { DesktopLockManager } from './session/lock.js'
import { createNativeHost } from './native/swiftBridge.js'
import { LocalUiApprovalProvider } from './approvals/localUiProvider.js'
import { HostCallbackApprovalProvider } from './approvals/hostCallbackProvider.js'
import { ApprovalCoordinator } from './approvals/approvalCoordinator.js'
import { ComputerUseMcpServer } from './mcp/server.js'
import { connectStdioTransport } from './mcp/stdioTransport.js'
import { StreamableHttpTransport } from './mcp/streamableHttpTransport.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const logger = createLogger()
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
    logger,
  }

  const server = new ComputerUseMcpServer(runtime)

  if (config.enableStreamableHttp) {
    const httpTransport = new StreamableHttpTransport(server, config, sessionStore, logger)
    await httpTransport.start()
  }

  if (config.enableStdio) {
    await connectStdioTransport(server, logger)
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
