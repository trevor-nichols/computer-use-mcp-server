import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { extractCaptureId } from './captureResultHelpers.js'

test('stdio server exposes the computer-use tool surface and supports the fake screenshot loop', async () => {
  const entry = path.resolve(process.cwd(), 'dist/computer-use-mcp/src/main.js')
  const captureAssetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'computer-use-capture-assets-'))
  const child = spawn(process.execPath, [entry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COMPUTER_USE_FAKE: '1',
      COMPUTER_USE_CAPTURE_ASSET_ROOT: captureAssetRoot,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const rl = createInterface({ input: child.stdout })
  const readResponse = () =>
    new Promise<any>((resolve, reject) => {
      rl.once('line', (line: string) => {
        try {
          resolve(JSON.parse(line))
        } catch (error) {
          reject(error)
        }
      })
    })

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'node-test', version: '0.1.0' },
    },
  }) + '\n')
  const init = await readResponse()
  assert.equal(init.result.serverInfo.name, 'computer-use')

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  }) + '\n')

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  }) + '\n')
  const tools = await readResponse()
  const toolNames = tools.result.tools.map((tool: any) => tool.name)
  for (const expected of [
    'request_access',
    'screenshot',
    'list_displays',
    'select_display',
    'zoom',
    'capture_metadata',
    'cursor_position',
    'mouse_move',
    'left_click',
    'right_click',
    'double_click',
    'left_click_drag',
    'scroll',
    'key',
    'hold_key',
    'type',
    'read_clipboard',
    'write_clipboard',
    'search_applications',
    'open_application',
    'list_granted_applications',
    'wait',
    'computer_batch',
  ]) {
    assert.equal(toolNames.includes(expected), true, `missing tool ${expected}`)
  }

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'request_access',
      arguments: {
        apps: [{ bundleId: 'com.apple.TextEdit', displayName: 'TextEdit' }],
        flags: { clipboardRead: true, clipboardWrite: true },
      },
    },
  }) + '\n')
  const access = await readResponse()
  assert.equal(access.result.structuredContent.ok, true)

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'list_displays',
      arguments: {},
    },
  }) + '\n')
  const listDisplays = await readResponse()
  assert.equal(listDisplays.result.structuredContent.ok, true)
  assert.equal(listDisplays.result.structuredContent.displayPinnedByModel, false)
  assert.equal(listDisplays.result.structuredContent.selectedDisplayId, null)
  assert.equal(Array.isArray(listDisplays.result.structuredContent.displays), true)
  assert.equal(listDisplays.result.structuredContent.displays.length, 1)
  assert.equal(listDisplays.result.structuredContent.displays[0]?.displayId, 1)

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'select_display',
      arguments: { displayName: 'Fake Display' },
    },
  }) + '\n')
  const selectDisplay = await readResponse()
  assert.equal(selectDisplay.result.structuredContent.ok, true)
  assert.equal(selectDisplay.result.structuredContent.selectedDisplayId, 1)

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'screenshot',
      arguments: {},
    },
  }) + '\n')
  const screenshot = await readResponse()
  const captureId = extractCaptureId(screenshot.result)
  assert.equal(screenshot.result.content[0]?.type, 'text')
  assert.equal(screenshot.result.content[1]?.type, 'image')
  assert.equal(typeof screenshot.result.content[1]?.data, 'string')
  assert.equal(screenshot.result.content[1]?.mimeType, 'image/jpeg')
  assert.equal(screenshot.result.structuredContent, undefined)

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: {
      name: 'capture_metadata',
      arguments: { captureId },
    },
  }) + '\n')
  const captureMetadata = await readResponse()
  assert.equal(captureMetadata.result.structuredContent.ok, true)
  assert.equal(captureMetadata.result.structuredContent.captureId, captureId)
  assert.equal(typeof captureMetadata.result.structuredContent.imagePath, 'string')
  assert.equal((await fs.stat(captureMetadata.result.structuredContent.imagePath)).isFile(), true)

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 8,
    method: 'tools/call',
    params: {
      name: 'left_click',
      arguments: { x: 10, y: 10 },
    },
  }) + '\n')
  const click = await readResponse()
  assert.equal(click.result.structuredContent.ok, true)

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/call',
    params: {
      name: 'type',
      arguments: { text: 'hello from node test', viaClipboard: true },
    },
  }) + '\n')
  const typeResult = await readResponse()
  assert.equal(typeResult.result.structuredContent.ok, true)

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: {
      name: 'select_display',
      arguments: { auto: true },
    },
  }) + '\n')
  const autoDisplay = await readResponse()
  assert.equal(autoDisplay.result.structuredContent.ok, true)
  assert.equal(autoDisplay.result.structuredContent.mode, 'auto')

  child.kill()
  await fs.rm(captureAssetRoot, { recursive: true, force: true })
})
