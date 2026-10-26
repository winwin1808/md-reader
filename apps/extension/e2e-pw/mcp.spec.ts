import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const cliPath = path.join(repoRoot, 'packages', 'mcp', 'dist', 'cli.js')

interface Rpc { id?: number; result?: any; error?: any }

class McpClient {
  private buf = ''
  private nextId = 1
  private waiters = new Map<number, (m: Rpc) => void>()
  constructor(private proc: ChildProcessWithoutNullStreams) {
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (d: string) => {
      this.buf += d
      let i: number
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim()
        this.buf = this.buf.slice(i + 1)
        if (!line) continue
        try {
          const m = JSON.parse(line) as Rpc
          if (m.id !== undefined) this.waiters.get(m.id)?.(m)
        } catch { /* ignore non-JSON */ }
      }
    })
  }
  request(method: string, params: unknown, timeoutMs = 90_000): Promise<Rpc> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout ${method}`)), timeoutMs)
      this.waiters.set(id, (m) => { clearTimeout(t); resolve(m) })
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }
  notify(method: string): void {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n')
  }
  call(name: string, args: unknown, timeoutMs?: number): Promise<{ isError: boolean; text: string }> {
    return this.request('tools/call', { name, arguments: args }, timeoutMs).then((m) => {
      if (m.error) throw new Error(JSON.stringify(m.error))
      return { isError: !!m.result.isError, text: String(m.result.content?.[0]?.text ?? '') }
    })
  }
}

test.describe('MCP CLI <-> extension', () => {
  test.skip(!fs.existsSync(cliPath), 'packages/mcp/dist/cli.js missing: run `pnpm --filter @md-reader/mcp build`')
  test.setTimeout(240_000)

  test('publish / get / update / share-deny', async ({ context, extensionId }) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdr-mcp-'))
    const proc = spawn('node', [cliPath], {
      env: { ...process.env, MDR_PAIR_FILE: path.join(tmp, 'mcp.json') },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const mcp = new McpClient(proc)
    try {
      const init = await mcp.request('initialize', {
        protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '0' },
      })
      expect(init.result).toBeTruthy()
      mcp.notify('notifications/initialized')
      const list = await mcp.request('tools/list', {})
      expect(list.result.tools).toHaveLength(7)

      // Enable the bridge from an extension page.
      const page = await context.newPage()
      await page.goto(`chrome-extension://${extensionId}/app.html`)
      await page.evaluate(() => chrome.storage.local.set({ 'mdr.bridge': { enabled: true, approved: [] } }))

      // list_docs triggers pairing; scan on demand instead of waiting for the alarm.
      const pairingTab = context.waitForEvent('page', { predicate: (p) => p.url().includes('pair='), timeout: 60_000 })
      const listDocs = mcp.call('list_docs', {}, 120_000)
      const scan = setInterval(() => {
        page.evaluate(() => chrome.runtime.sendMessage({ type: 'mdr-bridge-scan' })).catch(() => {})
      }, 3000)
      let pair
      try { pair = await pairingTab } finally { clearInterval(scan) }
      await pair.getByRole('button', { name: 'Cho phép' }).click()
      const listed = await listDocs
      expect(listed.isError, listed.text).toBe(false)
      expect(JSON.parse(listed.text)).toHaveProperty('docs')

      // publish_doc opens an app tab showing the heading.
      const pub = await mcp.call('publish_doc', { title: 'E2E MCP', markdown: '# Xin chào\n\nđoạn một' })
      expect(pub.isError, pub.text).toBe(false)
      const { docId } = JSON.parse(pub.text) as { docId: string }
      const findDoc = () => context.pages().find((p) => p !== page && /app\.html\?/.test(p.url()))
      await expect.poll(() => !!findDoc(), { timeout: 30_000 }).toBe(true)
      const docPage = findDoc()!
      await expect(docPage.getByRole('heading', { name: 'Xin chào' })).toBeVisible({ timeout: 30_000 })
      await expect(docPage.getByText('đoạn một')).toBeVisible()

      const got = await mcp.call('get_doc', { docId })
      expect(got.isError, got.text).toBe(false)
      const g = JSON.parse(got.text) as { markdown: string; hash: string }
      expect(g.markdown).toContain('đoạn một')

      const upd = await mcp.call('update_doc', { docId, markdown: g.markdown.replace('đoạn một', 'đoạn hai'), baseHash: g.hash })
      expect(upd.isError, upd.text).toBe(false)
      await expect(docPage.getByText('đoạn hai')).toBeVisible({ timeout: 30_000 })

      const stale = await mcp.call('update_doc', { docId, markdown: '# x', baseHash: g.hash })
      expect(stale.isError).toBe(true)
      expect(stale.text).toContain('CONFLICT')

      // share_doc: confirmation dialog names the client; deny.
      const share = mcp.call('share_doc', { docId, role: 'view', expiresInDays: 7 }, 60_000)
      let dialogPage = null
      for (let i = 0; i < 60 && !dialogPage; i++) {
        for (const p of context.pages()) {
          if (await p.getByRole('dialog').filter({ hasText: 'MCP' }).count().catch(() => 0)) { dialogPage = p; break }
        }
        if (!dialogPage) await new Promise((r) => setTimeout(r, 500))
      }
      expect(dialogPage, 'confirm dialog not shown').not.toBeNull()
      await dialogPage!.getByRole('button', { name: 'Từ chối' }).click()
      const denied = await share
      expect(denied.isError).toBe(true)
      expect(denied.text).toContain('DENIED')
    } finally {
      proc.kill()
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})
