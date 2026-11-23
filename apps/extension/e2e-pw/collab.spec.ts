import { test, expect } from './fixtures'
import { apiBase } from './api-base'
import { chromium, type Page } from '@playwright/test'

// Creates a link with the given role in the open ShareModal; returns its full URL
// (the modal shows a shortened text, the full URL is in the title attribute).
async function createLink(share: any, role: 'Xem' | 'Sửa', previous?: string): Promise<string> {
  await share.getByRole('radio', { name: role }).click()
  await share.getByRole('button', { name: 'Tạo link' }).click()
  const created = share.getByLabel('Link vừa tạo')
  await expect.poll(async () => {
    const t = await created.getAttribute('title')
    return t && t !== previous ? t : ''
  }, { timeout: 15000 }).not.toBe('')
  return (await created.getAttribute('title')) as string
}

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
  await dlg.getByLabel('Máy chủ đồng bộ').fill(apiBase())
  await dlg.getByRole('button', { name: 'Đóng' }).click()
  await expect(dlg).toHaveCount(0)

  await app.getByRole('button', { name: 'Chia sẻ' }).first().click()
  const share = app.getByRole('dialog')
  await share.getByRole('button', { name: 'Bật chia sẻ' }).click()
  const url = await createLink(share, 'Sửa')
  expect(url.startsWith(`${apiBase()}/s/`)).toBe(true)
  await share.getByRole('button', { name: 'Đóng' }).click()

  const browser = await chromium.launch()
  try {
    const b = await browser.newContext({ locale: 'vi-VN' })
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
    const presence = app.getByRole('group', { name: /Đang trong phòng: 2 người/ })
    await expect(presence).toBeVisible({ timeout: 15000 })
    // presence bar shows the guest's chosen name (in text or in a title/aria label)
    await expect.poll(async () => (await presence.evaluate((el) => el.outerHTML)).includes('Khách'), { timeout: 15000 }).toBe(true)
  } finally {
    await browser.close()
  }
})

test('view link is read-only; revoke-all kills the edit link page', async ({ context, server }) => {
  server.write('doc2.md', '# Thu hồi\n\nNội dung gốc.\n')
  const app = await openViaContentScript(context, `${server.origin}/doc2.md`)
  await expect(app.getByRole('heading', { level: 1, name: 'Thu hồi' })).toBeVisible()

  await app.getByRole('button', { name: 'Cài đặt' }).first().click()
  const dlg = app.getByRole('dialog')
  await dlg.getByRole('button', { name: 'Cộng tác' }).click()
  await dlg.getByLabel('Tên hiển thị').fill('Chủ')
  await dlg.getByLabel('Máy chủ đồng bộ').fill(apiBase())
  await dlg.getByRole('button', { name: 'Đóng' }).click()
  await expect(dlg).toHaveCount(0)

  await app.getByRole('button', { name: 'Chia sẻ' }).first().click()
  const share = app.getByRole('dialog')
  await share.getByRole('button', { name: 'Bật chia sẻ' }).click()
  const viewUrl = await createLink(share, 'Xem')
  const editUrl = await createLink(share, 'Sửa', viewUrl)

  const browser = await chromium.launch()
  try {
    // view link: content visible, nothing editable
    const v = await (await browser.newContext({ locale: 'vi-VN' })).newPage()
    await v.goto(viewUrl)
    await expect(v.getByRole('heading', { level: 1, name: 'Thu hồi' })).toBeVisible({ timeout: 15000 })
    await expect(v.locator('.cm-content[contenteditable="true"]')).toHaveCount(0)
    await expect(v.getByRole('button', { name: 'Bắt đầu sửa' })).toHaveCount(0)

    // edit link: guest types, owner receives
    const e = await (await browser.newContext({ locale: 'vi-VN' })).newPage()
    await e.goto(editUrl)
    await e.getByLabel('Tên của bạn').fill('Khách')
    await e.getByRole('button', { name: 'Bắt đầu sửa' }).click()
    const cm = e.locator('.cm-content')
    await expect(cm).toContainText('Nội dung gốc.', { timeout: 15000 })
    await cm.click()
    await e.keyboard.press('ControlOrMeta+End')
    await e.keyboard.type(' Bổ sung.')
    await expect(app.locator('body')).toContainText('Bổ sung.', { timeout: 15000 })

    // owner revokes everything
    await share.getByRole('button', { name: 'Tắt chia sẻ' }).click()
    await share.getByRole('button', { name: 'Có' }).click()
    await expect(e.getByRole('alert')).toBeVisible({ timeout: 20000 })
    await expect(e.locator('.cm-content')).toHaveCount(0, { timeout: 20000 })
  } finally {
    await browser.close()
  }
})

// Selects `text` inside the page's rendered document and fires the events the comment layer listens to.
async function selectText(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = w.nextNode())) {
      const i = (n.textContent ?? '').indexOf(t)
      if (i < 0 || !(n.parentElement as HTMLElement).closest('[data-sp]')) continue
      const r = document.createRange()
      r.setStart(n, i)
      r.setEnd(n, i + t.length)
      const s = window.getSelection()!
      s.removeAllRanges()
      s.addRange(r)
      document.dispatchEvent(new Event('selectionchange'))
      ;(n.parentElement as HTMLElement).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      return
    }
    throw new Error('text not found: ' + t)
  }, text)
}

test('view link comments; edit link resolves', async ({ context, server }) => {
  server.write('doc3.md', '# Góp ý\n\nCâu cần sửa.\n')
  const app = await openViaContentScript(context, `${server.origin}/doc3.md`)
  await expect(app.getByRole('heading', { level: 1, name: 'Góp ý' })).toBeVisible()

  await app.getByRole('button', { name: 'Cài đặt' }).first().click()
  const dlg = app.getByRole('dialog')
  await dlg.getByRole('button', { name: 'Cộng tác' }).click()
  await dlg.getByLabel('Tên hiển thị').fill('Chủ')
  await dlg.getByLabel('Máy chủ đồng bộ').fill(apiBase())
  await dlg.getByRole('button', { name: 'Đóng' }).click()
  await expect(dlg).toHaveCount(0)

  await app.getByRole('button', { name: 'Chia sẻ' }).first().click()
  const share = app.getByRole('dialog')
  await share.getByRole('button', { name: 'Bật chia sẻ' }).click()
  const viewUrl = await createLink(share, 'Xem')
  const editUrl = await createLink(share, 'Sửa', viewUrl)
  await share.getByRole('button', { name: 'Đóng' }).click()

  const browser = await chromium.launch()
  try {
    // guest A (view link) comments
    const a = await (await browser.newContext({ locale: 'vi-VN' })).newPage()
    await a.goto(viewUrl)
    await expect(a.getByRole('heading', { level: 1, name: 'Góp ý' })).toBeVisible({ timeout: 15000 })
    await selectText(a, 'Câu cần sửa')
    await a.locator('.comment-add-btn').click()
    const composer = a.locator('.comment-composer')
    await composer.getByLabel('Tên của bạn').fill('Khách A')
    await composer.getByLabel('Bình luận').fill('Sửa câu này')
    await composer.getByRole('button', { name: 'Gửi' }).click()
    await expect(a.locator('.web-comments-toggle')).toContainText('(1)', { timeout: 15000 })

    // owner sees it
    await app.keyboard.press('ControlOrMeta+Shift+M')
    await expect(app.locator('body')).toContainText('Sửa câu này', { timeout: 15000 })
    await expect(app.locator('body')).toContainText('Khách A', { timeout: 15000 })

    // guest B (edit link) resolves
    const b = await (await browser.newContext({ locale: 'vi-VN' })).newPage()
    await b.goto(editUrl)
    await b.getByLabel('Tên của bạn').fill('Khách B')
    await b.getByRole('button', { name: 'Bắt đầu sửa' }).click()
    await expect(b.locator('.cm-content')).toContainText('Câu cần sửa', { timeout: 15000 })
    await b.locator('.web-comments-toggle').click()
    const drawer = b.locator('.web-comments-drawer')
    await expect(drawer).toContainText('Sửa câu này', { timeout: 15000 })
    await drawer.getByRole('button', { name: 'Xong' }).first().click()

    // guest A sees it resolved
    await expect(a.locator('.web-comments-toggle')).toContainText('(0)', { timeout: 15000 })
    await expect(a.locator('.web-comments-drawer')).toBeVisible()
    const done = a.locator('.web-comments-drawer').getByRole('tab', { name: /Đã xong \(1\)/ })
    await expect(done).toBeVisible({ timeout: 15000 })
    await done.click()
    await expect(a.locator('.web-comments-drawer')).toContainText('Sửa câu này')
  } finally {
    await browser.close()
  }
})
