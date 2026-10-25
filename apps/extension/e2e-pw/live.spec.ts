import { test, expect } from './fixtures'
import type { BrowserContext, Page } from '@playwright/test'

async function openViaContentScript(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(url)
  const open = page.getByRole('button', { name: 'Đọc trong MD Reader' })
  await expect(open).toBeVisible({ timeout: 5000 })
  await open.click()
  await page.waitForURL(/^chrome-extension:\/\//)
  return page
}

test('writing on the reading page renders bold live and persists to the reader', async ({ context, server }) => {
  server.write('live.md', '# Viết trực tiếp\n\nĐoạn một.\n\nĐoạn hai.\n')
  const app = await openViaContentScript(context, `${server.origin}/live.md`)
  await expect(app.getByRole('heading', { level: 1, name: 'Viết trực tiếp' })).toBeVisible()

  await app.getByRole('radio', { name: 'Sửa' }).click()
  const cm = app.locator('.cm-content')
  await expect(cm).toBeVisible({ timeout: 10000 })
  const first = cm.locator('.cm-line', { hasText: 'Đoạn một.' })
  await first.click()
  await app.keyboard.press('End')
  await app.keyboard.type(' **đậm**')
  await cm.locator('.cm-line', { hasText: 'Đoạn hai.' }).click()
  await app.keyboard.press('End')

  const line = cm.locator('.cm-line', { hasText: 'Đoạn một.' })
  await expect(line).toContainText('đậm')
  await expect(line).not.toContainText('**')

  await app.getByRole('radio', { name: 'Đọc' }).click()
  await expect(app.locator('strong', { hasText: 'đậm' })).toBeVisible()
})

test('share modal keeps Sao chép enabled after reopen and copies the link', async ({ context, server }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const API = 'http://localhost:8787'
  const TOKEN = 'tok_abcdef0123456789'
  const link = { tokenPrefix: 'tok_abcd', token: TOKEN, role: 'view', label: '', expiresAt: null, revokedAt: null, createdAt: Date.now() }
  await context.route(`${API}/api/**`, async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (req.method() === 'POST' && u.pathname === '/api/rooms') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ roomId: 'room1', ownerToken: 'own1' }) })
    }
    if (req.method() === 'POST' && u.pathname === '/api/rooms/room1/links') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(link) })
    }
    if (req.method() === 'GET' && u.pathname === '/api/rooms/room1/links') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...link, token: '' }]) })
    }
    return route.fulfill({ status: 404, body: '' })
  })

  server.write('share.md', '# Chia sẻ\n\nNội dung.\n')
  const app = await openViaContentScript(context, `${server.origin}/share.md`)
  await expect(app.getByRole('heading', { level: 1, name: 'Chia sẻ' })).toBeVisible()

  await app.getByRole('button', { name: 'Cài đặt' }).first().click()
  const dlg = app.getByRole('dialog')
  await dlg.getByRole('button', { name: 'Cộng tác' }).click()
  await dlg.getByLabel('Máy chủ đồng bộ').fill(API)
  await dlg.getByRole('button', { name: 'Đóng' }).click()
  await expect(dlg).toHaveCount(0)

  await app.getByRole('button', { name: 'Chia sẻ' }).first().click()
  const share = app.getByRole('dialog')
  await share.getByRole('button', { name: 'Bật chia sẻ' }).click()
  await share.getByRole('button', { name: 'Tạo link' }).click()
  await expect(share.getByLabel('Link vừa tạo')).toBeVisible({ timeout: 10000 })
  await share.getByRole('button', { name: 'Đóng' }).click()
  await expect(share).toHaveCount(0)

  await app.getByRole('button', { name: 'Chia sẻ' }).first().click()
  const again = app.getByRole('dialog')
  const copy = again.getByRole('button', { name: 'Sao chép link' }).first()
  await expect(copy).toBeEnabled({ timeout: 10000 })
  await copy.click()
  await expect(again.getByText('Đã sao chép')).toBeVisible()
  const clip = await app.evaluate(() => navigator.clipboard.readText())
  expect(clip.endsWith(TOKEN)).toBe(true)
})
