import { test as base, chromium, type BrowserContext } from '@playwright/test'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

const builtDist = path.resolve(process.cwd(), 'dist')

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
    const dist = builtDist
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
    }
  },
  extensionId: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await use(new URL(sw.url()).host)
  },
})

export const expect = test.expect
