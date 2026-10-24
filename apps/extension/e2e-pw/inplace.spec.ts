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
