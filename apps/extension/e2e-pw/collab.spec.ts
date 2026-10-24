import { test, expect } from './fixtures'
import { chromium, type Page } from '@playwright/test'

async function openViaContentScript(context: any, url: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(url)
  const open = page.getByRole('button', { name: 'Đọc trong MD Reader' })
  await expect(open).toBeVisible({ timeout: 5000 })
  await open.click()
  await page.waitForURL(/^chrome-extension:\/\//)
  return page
}

test('extension owner and web guest edit the same doc', async ({ context, server }) => {
  server.write('doc.md', '# Cộng tác\n\nĐoạn đầu.\n')
  const app = await openViaContentScript(context, `${server.origin}/doc.md`)
  await expect(app.getByRole('heading', { level: 1, name: 'Cộng tác' })).toBeVisible()

  await app.getByRole('button', { name: 'Cài đặt' }).first().click()
  const dlg = app.getByRole('dialog')
  await dlg.getByRole('button', { name: 'Cộng tác' }).click()
  await dlg.getByLabel('Tên hiển thị').fill('Chủ')
  await dlg.getByLabel('Máy chủ đồng bộ').fill('http://localhost:8787')
  await dlg.getByRole('button', { name: 'Đóng' }).click()
  await expect(dlg).toHaveCount(0)

  await app.getByRole('button', { name: 'Chia sẻ' }).first().click()
  const share = app.getByRole('dialog')
  await share.getByRole('button', { name: 'Bật chia sẻ' }).click()
  await share.getByLabel('Sửa').check()
  await share.getByRole('button', { name: 'Tạo link' }).click()
  const link = share.getByLabel('Link chia sẻ')
  await expect(link).toBeVisible({ timeout: 15000 })
  const url = await link.inputValue()
  expect(url.startsWith('http://localhost:8787/s/')).toBe(true)
  await share.getByRole('button', { name: 'Đóng' }).click()

  const browser = await chromium.launch()
  try {
    const b = await browser.newContext()
    const guest = await b.newPage()
    await guest.goto(url)
    await guest.getByLabel('Tên của bạn').fill('Khách')
    await guest.getByRole('button', { name: 'Bắt đầu sửa' }).click()
    const cm = guest.locator('.cm-content')
    await expect(cm).toBeVisible({ timeout: 15000 })
    await expect(cm).toContainText('Đoạn đầu.')
    await cm.click()
    await guest.keyboard.press('ControlOrMeta+End')
    await guest.keyboard.type(' Khách gõ.')

    await expect(app.locator('body')).toContainText(' Khách gõ.', { timeout: 15000 })
    await expect(app.getByRole('group', { name: /Đang trong phòng: 2 người/ })).toBeVisible({ timeout: 15000 })
  } finally {
    await browser.close()
  }
})
