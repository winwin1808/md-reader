import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

function launch(userDir: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDir, {
    headless: true,
    channel: 'chromium',
    locale: 'vi-VN',
    args: ['--headless=new', '--lang=vi', `--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const countUrls = (ctx: BrowserContext, needle: string) => ctx.pages().filter((pg) => pg.url().includes(needle)).length

test('cài mới mở chào một lần, mở mẫu, khởi động lại không mở thêm tab', async () => {
  test.setTimeout(90_000)
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdr-life-'))
  let context: BrowserContext | undefined
  try {
    context = await launch(userDir)

    const deadline = Date.now() + 10_000
    let welcome: Page | undefined
    while (!welcome && Date.now() < deadline) {
      welcome = context.pages().find((pg) => pg.url().includes('app.html?welcome=1'))
      if (!welcome) await sleep(100)
    }
    expect(welcome, 'trang chào phải mở').toBeTruthy()
    await sleep(1500)
    expect(countUrls(context, 'welcome=1')).toBe(1)

    const sample = welcome!
      .getByRole('button', { name: 'Mở tài liệu mẫu' })
      .or(welcome!.getByRole('link', { name: 'Mở tài liệu mẫu' }))
    await expect(sample).toBeVisible()
    await sample.click()

    const found = Date.now() + 10_000
    let doc: Page | undefined
    while (!doc && Date.now() < found) {
      doc = context.pages().find((pg) => /app\.html\?.*\bd=/.test(pg.url()))
      if (!doc) await sleep(100)
    }
    expect(doc, 'trang tài liệu mẫu phải có d=').toBeTruthy()
    await expect(doc!.locator('h1').first()).toBeVisible({ timeout: 10_000 })

    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8')) as { version: string }
    const state = (await sw.evaluate(() => chrome.storage.local.get('mdr:lifecycle'))) as {
      'mdr:lifecycle': { startedAt: unknown; pendingWelcome: unknown; lastSeenVersion: unknown }
    }
    const lc = state['mdr:lifecycle']
    expect(typeof lc.startedAt).toBe('number')
    expect(lc.pendingWelcome).toBe(false)
    expect(lc.lastSeenVersion).toBe(manifest.version)

    await context.close()
    context = await launch(userDir)
    const sw2 = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15_000 }))
    await expect
      .poll(() =>
        sw2.evaluate(() =>
          chrome.storage.local.get('mdr:lifecycle').then((r) => (r['mdr:lifecycle'] as { startedAt?: unknown } | undefined)?.startedAt),
        ),
      )
      .toBe(lc.startedAt)
    await sleep(2000)
    expect(countUrls(context, 'welcome=1')).toBe(0)
    expect(countUrls(context, 'whatsnew=1')).toBe(0)
  } finally {
    await context?.close().catch(() => {})
    fs.rmSync(userDir, { recursive: true, force: true })
  }
})
