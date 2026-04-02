import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { CaptureResult, ScreenshotDims } from '../native/bridgeTypes.js'
import type { Logger } from '../observability/logger.js'

export interface CaptureAssetRecord extends ScreenshotDims {
  captureId: string
  sessionId: string
  imagePath: string
  mimeType: CaptureResult['mimeType']
  createdAt: string
  sizeBytes: number
}

export class CaptureAssetStore {
  private readonly serverInstanceId = randomUUID()
  private readonly sessionIndex = new Map<string, Map<string, CaptureAssetRecord>>()

  readonly rootDir: string

  constructor(
    private readonly assetRoot: string,
    private readonly logger: Logger,
  ) {
    this.rootDir = path.join(assetRoot, this.serverInstanceId)
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true })
  }

  async createAsset(sessionId: string, capture: CaptureResult, screenshotDims: ScreenshotDims): Promise<CaptureAssetRecord> {
    const captureId = randomUUID()
    const sessionDir = path.join(this.rootDir, encodeURIComponent(sessionId))
    const extension = capture.mimeType === 'image/png' ? 'png' : 'jpg'
    const imagePath = path.join(sessionDir, `${captureId}.${extension}`)
    const bytes = Buffer.from(capture.dataBase64, 'base64')

    await fs.mkdir(sessionDir, { recursive: true })
    await fs.writeFile(imagePath, bytes)

    const record: CaptureAssetRecord = {
      captureId,
      sessionId,
      imagePath,
      mimeType: capture.mimeType,
      createdAt: new Date().toISOString(),
      sizeBytes: bytes.byteLength,
      ...screenshotDims,
    }

    let sessionAssets = this.sessionIndex.get(sessionId)
    if (!sessionAssets) {
      sessionAssets = new Map<string, CaptureAssetRecord>()
      this.sessionIndex.set(sessionId, sessionAssets)
    }
    sessionAssets.set(captureId, record)

    this.logger.debug('stored capture asset', {
      sessionId,
      captureId,
      imagePath,
      sizeBytes: record.sizeBytes,
    })

    return record
  }

  listSessionAssets(sessionId: string): CaptureAssetRecord[] {
    return [...(this.sessionIndex.get(sessionId)?.values() ?? [])]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async deleteSessionAssets(sessionId: string): Promise<void> {
    this.sessionIndex.delete(sessionId)
    await fs.rm(path.join(this.rootDir, encodeURIComponent(sessionId)), {
      recursive: true,
      force: true,
    })
  }

  async cleanupAll(): Promise<void> {
    this.sessionIndex.clear()
    await fs.rm(this.rootDir, {
      recursive: true,
      force: true,
    })
  }
}
