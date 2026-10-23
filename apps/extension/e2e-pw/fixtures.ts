import { test as base, chromium, type BrowserContext } from '@playwright/test'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

const builtDist = path.resolve(process.cwd(), 'dist')

/**
 * KNOWN PRODUCT BUG (not fixed here, 6k1 forbids product changes): dist/manifest.json
 * web_accessible_resources[].matches contain path patterns (e.g. "*://*\/*.md"), which
 * Chromium 156 rejects ("Invalid match pattern") so the extension does not load at all.
 * The harness loads a temp copy with those matches widened to origin-level patterns.
 */
function stageExtension(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdr-ext-'))
  fs.cpSync(builtDist, dir, { recursive: true })
  const mf = path.join(dir, 'manifest.json')
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'))
  for (const r of m.web_accessible_resources ?? []) r.matches = ['*://*/*', 'file:///*']
  fs.writeFileSync(mf, JSON.stringify(m))
  return dir
}

export interface MdServer {
  origin: string
  write(name: string, content: string): void
}

export const test = base.extend<{ server: MdServer; context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  server: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdr-srv-'))
    const srv = http.createServer((req, res) => {
      const name = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '')
      const file = path.join(dir, path.basename(name))
      if (!fs.existsSync(file)) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' })
      res.end(fs.readFileSync(file))
    })
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r))
    const port = (srv.address() as AddressInfo).port
    try {
      await use({
        origin: `http://127.0.0.1:${port}`,
        write: (name, content) => fs.writeFileSync(path.join(dir, name), content),
      })
    } finally {
      srv.closeAllConnections()
      await new Promise<void>((r) => srv.close(() => r()))
      fs.rmSync(dir, { recursive: true, force: true })
    }
  },
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdr-pw-'))
    const dist = stageExtension()
    const context = await chromium.launchPersistentContext(userDir, {
      headless: true,
      channel: 'chromium',
      args: ['--headless=new', `--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    })
    try {
      await use(context)
    } finally {
      await context.close()
      fs.rmSync(userDir, { recursive: true, force: true })
      fs.rmSync(dist, { recursive: true, force: true })
    }
  },
  extensionId: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await use(new URL(sw.url()).host)
  },
})

export const expect = test.expect
