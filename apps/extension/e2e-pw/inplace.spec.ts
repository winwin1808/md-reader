import { test, expect } from './fixtures'

const BODY = '# Xin chào\n\n- một\n- hai\n\n```mermaid\ngraph TD;A-->B\n```\n\n<script>window.__pwned=1</script>'

test('in-place reading renders the .md page safely and toggles raw view', async ({ context }) => {
  await context.route('http://mdr.test/doc.md', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: BODY }),
  )
  const page = await context.newPage()
  await page.goto('http://mdr.test/doc.md')

  const root = page.locator('#md-reader-root')
  await expect(root.getByRole('heading', { level: 1, name: 'Xin chào' })).toBeVisible({ timeout: 10000 })
  await expect(root.locator('li')).toHaveCount(2)
  await expect(root.locator('code.language-mermaid')).toHaveCount(1)
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined()

  await root.getByRole('button', { name: 'Xem bản thô' }).click()
  await expect(page.locator('pre')).toBeVisible()
  await expect(page.locator('pre')).toContainText('# Xin chào')

  await root.getByRole('button', { name: 'Xem bản đọc' }).click()
  await expect(root.locator('article.doc')).toBeVisible()
})

const XSS_BODY = [
  '# Xss',
  '',
  '<img src=x onerror="window.__pwned=2">',
  '',
  '<a href="javascript:window.__pwned=3" id="evil-a">x</a>',
  '',
  '<svg onload="window.__pwned=4"><circle r="1"/></svg>',
  '',
  '<iframe srcdoc="<script>parent.__pwned=5</script>"></iframe>',
  '',
  '[md-link](javascript:window.__pwned=6)',
  '',
  '<script>window.__pwned=1</script>',
].join('\n')

test('in-place reading neutralises XSS vectors (img/a/svg/iframe/markdown link)', async ({ context }) => {
  await context.route('http://mdr.test/xss.md', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: XSS_BODY }),
  )
  const page = await context.newPage()
  await page.goto('http://mdr.test/xss.md')
  const root = page.locator('#md-reader-root')
  await expect(root.getByRole('heading', { level: 1, name: 'Xss' })).toBeVisible({ timeout: 10000 })

  // Click every anchor that rendered, whatever its href was sanitised to.
  const anchors = root.locator('article.doc a')
  for (let i = 0; i < await anchors.count(); i++) {
    await anchors.nth(i).click({ noWaitAfter: true, force: true }).catch(() => {})
  }
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined()

  const bad = await root.evaluate((el) => {
    const out: string[] = []
    const walk = (n: Element | ShadowRoot) => {
      n.querySelectorAll('*').forEach((e) => {
        for (const a of Array.from(e.attributes)) {
          if (/^on/i.test(a.name)) out.push(`${e.tagName}@${a.name}`)
          if (/^\s*javascript:/i.test(a.value)) out.push(`${e.tagName}@${a.name}=js`)
        }
        if (['SCRIPT', 'IFRAME'].includes(e.tagName)) out.push(e.tagName)
        if (e.shadowRoot) walk(e.shadowRoot)
      })
    }
    walk(el)
    if (el.shadowRoot) walk(el.shadowRoot)
    return out
  })
  expect(bad).toEqual([])
  expect(page.url()).toBe('http://mdr.test/xss.md')
})
