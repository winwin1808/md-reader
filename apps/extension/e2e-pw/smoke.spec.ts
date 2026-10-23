import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

async function openViaContentScript(context: any, url: string): Promise<Page> {
  const page = await context.newPage()
  const failed: string[] = []
  page.on('requestfailed', (r: any) => {
    if (r.url().includes('app.css')) failed.push(r.url())
  })
  await page.goto(url)
  await page.waitForFunction(
    () =>
      !!(document.querySelector('#md-reader-root')?.shadowRoot?.querySelector('link[href*="app.css"]') as HTMLLinkElement | null)
        ?.sheet,
    undefined,
    { timeout: 5000 },
  )
  expect(failed).toEqual([])
  await page.getByRole('button', { name: 'Open in MD Reader' }).click()
  // worker replaces the current tab with app.html?file=... (then ?doc=<id>)
  await page.waitForURL(/^chrome-extension:\/\//)
  return page
}

async function toEditor(app: Page) {
  await app.getByRole('button', { name: 'Chế độ Soạn thảo' }).click()
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
  await expect(app.getByText('File gốc đã thay đổi')).toBeVisible()
})
