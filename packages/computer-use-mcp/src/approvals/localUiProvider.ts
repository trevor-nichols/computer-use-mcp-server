import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { RuntimeConfig } from '../config.js'
import type { Logger } from '../observability/logger.js'
import type {
  AppAccessRequest,
  AppAccessResult,
  ApprovalProvider,
  TccApprovalRequest,
  TccApprovalResult,
} from './approvalProvider.js'
import type { SessionContext } from '../session/sessionContext.js'

export class LocalUiApprovalProvider implements ApprovalProvider {
  readonly name = 'local-ui'

  constructor(
    private readonly config: RuntimeConfig,
    private readonly logger: Logger,
  ) {}

  supports(_session: SessionContext, _kind: 'tcc' | 'app-access'): boolean {
    return true
  }

  async requestTccApproval(_session: SessionContext, req: TccApprovalRequest): Promise<TccApprovalResult> {
    if (this.config.fakeMode) {
      return {
        acknowledged: true,
        recheckedState: {
          accessibility: true,
          screenRecording: true,
        },
      }
    }

    const helperPath = this.resolveApprovalHelperPath()
    if (!helperPath) {
      throw new Error('Approval helper binary is not available. Build approval-ui-macos or set COMPUTER_USE_APPROVAL_UI_PATH.')
    }

    const payload = {
      mode: 'tcc',
      sessionId: req.sessionId,
      accessibilityRequired: req.accessibilityRequired,
      screenRecordingRequired: req.screenRecordingRequired,
    }

    const result = await this.invokeHelper(helperPath, payload)
    return {
      acknowledged: Boolean(result.acknowledged),
      recheckedState: result.recheckedState && typeof result.recheckedState === 'object'
        ? {
            accessibility: Boolean((result.recheckedState as Record<string, unknown>).accessibility),
            screenRecording: Boolean((result.recheckedState as Record<string, unknown>).screenRecording),
          }
        : undefined,
    }
  }

  async requestAppAccess(_session: SessionContext, req: AppAccessRequest): Promise<AppAccessResult> {
    if (this.config.fakeMode) {
      return {
        approved: true,
        grantedApps: req.requestedApps,
        deniedApps: [],
        effectiveFlags: req.requestedFlags,
      }
    }

    const helperPath = this.resolveApprovalHelperPath()
    if (!helperPath) {
      throw new Error('Approval helper binary is not available. Build approval-ui-macos or set COMPUTER_USE_APPROVAL_UI_PATH.')
    }

    const payload = {
      mode: 'app-access',
      sessionId: req.sessionId,
      requestedApps: req.requestedApps,
      requestedFlags: req.requestedFlags,
      currentTccState: req.currentTccState,
    }

    const result = await this.invokeHelper(helperPath, payload)
    const effectiveFlags = result.effectiveFlags as Record<string, unknown> | undefined

    return {
      approved: Boolean(result.approved),
      grantedApps: Array.isArray(result.grantedApps) ? (result.grantedApps as AppAccessResult['grantedApps']) : [],
      deniedApps: Array.isArray(result.deniedApps) ? (result.deniedApps as AppAccessResult['deniedApps']) : [],
      effectiveFlags: {
        clipboardRead: Boolean(effectiveFlags?.clipboardRead),
        clipboardWrite: Boolean(effectiveFlags?.clipboardWrite),
        systemKeyCombos: Boolean(effectiveFlags?.systemKeyCombos),
      },
    }
  }

  private resolveApprovalHelperPath(): string | undefined {
    if (this.config.approvalUiPath && existsSync(this.config.approvalUiPath)) {
      return this.config.approvalUiPath
    }
    const bundled = path.join(this.config.repoRoot, 'packages', 'approval-ui-macos', '.build', 'release', 'ApprovalUIBridge')
    return existsSync(bundled) ? bundled : undefined
  }

  private async invokeHelper(helperPath: string, payload: unknown): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const child = spawn(helperPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk: string) => {
        stdout += String(chunk)
      })
      child.stderr.on('data', (chunk: string) => {
        stderr += String(chunk)
      })
      child.on('error', reject)
      child.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new Error(`Approval helper exited with code ${code}: ${stderr}`))
          return
        }
        try {
          const parsed = JSON.parse(stdout || '{}') as Record<string, unknown>
          resolve(parsed)
        } catch (error) {
          reject(error)
        }
      })

      this.logger.info('launching local approval helper', { helperPath, mode: (payload as Record<string, unknown>).mode })
      child.stdin.write(JSON.stringify(payload))
      child.stdin.end()
    })
  }
}
