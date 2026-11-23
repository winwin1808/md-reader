import { test, expect } from './fixtures'
import type { BrowserContext, Page } from '@playwright/test'

async function openApp(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(url)
  const open = page.getByRole('button', { name: 'Đọc trong MD Reader' })
  await expect(open).toBeVisible({ timeout: 5000 })
  await open.click()
  await page.waitForURL(/^chrome-extension:\/\//)
  return page
}

async function measure(app: Page, width: 'wide' | 'medium') {
  await app.evaluate((w) => Promise.all([chrome.storage.local.set({ pageWidth: w }), chrome.storage.sync.set({ pageWidth: w })]), width)
  await app.reload()
  await expect(app.locator('.app-container')).toHaveAttribute('data-width', width, { timeout: 10000 })
  await expect(app.locator('.a4-document-container').first()).toBeVisible()
  return app.evaluate(() => ({
    sheet: document.querySelector('.a4-document-container')!.getBoundingClientRect().width,
    scroll: document.documentElement.scrollWidth,
  }))
}

test('Rộng mở tờ giấy ~80% bề ngang, medium hẹp hơn', async ({ context, server }) => {
  server.write('wide.md', '# Rộng\n\nĐoạn văn.\n\n> [!NOTE]\n> Ghi chú.\n')
  const app = await openApp(context, `${server.origin}/wide.md`)
  await app.setViewportSize({ width: 1600, height: 900 })

  const wide = await measure(app, 'wide')
  console.log('wide sheet width', wide.sheet, 'scrollWidth', wide.scroll)
  expect(wide.sheet).toBeGreaterThanOrEqual(0.75 * 1600)
  expect(wide.sheet).toBeLessThanOrEqual(0.81 * 1600)
  expect(wide.scroll).toBeLessThanOrEqual(1600)

  await app.setViewportSize({ width: 1920, height: 1000 })
  const wide2 = await measure(app, 'wide')
  console.log('wide sheet width @1920', wide2.sheet, 'scrollWidth', wide2.scroll)
  expect(wide2.sheet).toBeGreaterThanOrEqual(0.75 * 1920)
  expect(wide2.sheet).toBeLessThanOrEqual(0.81 * 1920)
  expect(wide2.scroll).toBeLessThanOrEqual(1920)

  // medium: tài liệu thường (không có ghi chú lề, vốn nới thêm 17rem)
  server.write('plain.md', '# Thường\n\nĐoạn văn.\n')
  const plain = await openApp(context, `${server.origin}/plain.md`)
  await plain.setViewportSize({ width: 1600, height: 900 })
  const medium = await measure(plain, 'medium')
  console.log('medium sheet width', medium.sheet)
  expect(medium.sheet).toBeLessThan(0.65 * 1600)
})
