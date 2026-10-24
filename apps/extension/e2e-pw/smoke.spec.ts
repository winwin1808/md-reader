import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

async function openViaContentScript(context: any, url: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(url)
  const open = page.getByRole('button', { name: 'Đọc trong MD Reader' })
  await expect(open).toBeVisible({ timeout: 5000 })
  const bg = await page.evaluate(() => {
    const tab = document.querySelector('#md-reader-root')?.shadowRoot?.querySelector('.tab')
    return tab ? getComputedStyle(tab).backgroundColor : ''
  })
  expect(bg).not.toBe('')
  expect(bg).not.toBe('rgba(0, 0, 0, 0)')
  expect(bg).not.toBe('transparent')
  await page.getByRole('button', { name: 'Đọc trong MD Reader' }).click()
  // worker replaces the current tab with app.html?file=... (then ?doc=<id>)
  await page.waitForURL(/^chrome-extension:\/\//)
  return page
}

async function toEditor(app: Page) {
  await app.getByRole('radio', { name: 'Soạn' }).click()
  const cm = app.locator('.cm-content')
  await expect(cm).toBeVisible()
  return cm
}

test('content script opens the doc in the app', async ({ context, server, extensionId }) => {
  expect(extensionId).toBeTruthy()
  server.write('doc.md', '# Hello Smoke\n\nbody\n')
  const app = await openViaContentScript(context, `${server.origin}/doc.md`)
  await expect(app.getByRole('heading', { level: 1, name: 'Hello Smoke' })).toBeVisible()
})

test('editor edits persist across reload', async ({ context, server }) => {
  server.write('doc.md', '# Persist\n\nline\n')
  const app = await openViaContentScript(context, `${server.origin}/doc.md`)
  await expect(app.getByRole('heading', { level: 1, name: 'Persist' })).toBeVisible()
  const cm = await toEditor(app)
  await cm.click()
  await app.keyboard.press('ControlOrMeta+End')
  await app.keyboard.type('xyz')
  await app.waitForTimeout(500)
  await app.reload()
  await expect(app.locator('body')).toContainText('xyz')
})

test('remote change with local edits shows the banner', async ({ context, server }) => {
  server.write('doc.md', '# Remote\n\nv1\n')
  const app = await openViaContentScript(context, `${server.origin}/doc.md`)
  await expect(app.getByRole('heading', { level: 1, name: 'Remote' })).toBeVisible()
  const cm = await toEditor(app)
  await cm.click()
  await app.keyboard.press('ControlOrMeta+End')
  await app.keyboard.type('local edit')
  await app.waitForTimeout(500)
  server.write('doc.md', '# Remote\n\nv2 changed\n')
  await app.reload()
  await expect(app.getByText('Tài liệu gốc đã thay đổi')).toBeVisible()
})
