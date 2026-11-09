import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

async function openDoc(context: any, url: string): Promise<Page> {
  const page: Page = await context.newPage()
  await page.goto(url)
  const open = page.getByRole('button', { name: 'Đọc trong MD Reader' })
  await expect(open).toBeVisible({ timeout: 5000 })
  await open.click()
  await page.waitForURL(/^chrome-extension:\/\//)
  return page
}

function longDoc(): string {
  const paras = Array.from(
    { length: 8 },
    (_, i) =>
      `Đoạn văn số ${i + 1}. ` +
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(
        4,
      ),
  )
  const list = Array.from({ length: 35 }, (_, i) => `- mục danh sách ${i + 1}`)
  const table = ['| a | b |', '| - | - |', ...Array.from({ length: 35 }, (_, i) => `| hàng ${i + 1} | giá trị ${i + 1} |`)]
  const code = ['```ts', ...Array.from({ length: 45 }, (_, i) => `const v${i} = ${i} // dòng code ${i}`), '```']
  return [
    paras.slice(0, 4).join('\n\n'),
    list.join('\n'),
    '<!-- slide-break -->',
    paras.slice(4).join('\n\n'),
    table.join('\n'),
    code.join('\n'),
    '',
  ].join('\n\n')
}

test('slide PDF không cắt chữ', async ({ context, server }) => {
  server.write('doc.md', longDoc())
  const app = await openDoc(context, `${server.origin}/doc.md`)
  await expect(app.getByText('Đoạn văn số 1.').first()).toBeVisible()
  await app.evaluate(() => {
    window.print = () => {
      ;(window as any).__snap = [...document.querySelectorAll('.deck-print-slide')].map((el) => ({
        sh: el.scrollHeight,
        ch: el.clientHeight,
        ...(() => {
          const r = el.getBoundingClientRect()
          const cs = getComputedStyle(el)
          const c = el.querySelector('.deck-slide-content')
          const cr = c ? c.getBoundingClientRect() : r
          return {
            top: cr.top - r.top - parseFloat(cs.paddingTop),
            bottom: r.bottom - parseFloat(cs.paddingBottom) - cr.bottom,
          }
        })(),
      }))
      const orig = window.setTimeout
      // printSlides() and useExport each schedule a 1000ms cleanup; block both
      let blocked = 0
      window.setTimeout = ((fn: any, ms?: number, ...rest: any[]) => {
        if (ms === 1000) {
          if (++blocked >= 2) window.setTimeout = orig
          return 0 as any
        }
        return (orig as any)(fn, ms, ...rest)
      }) as any
    }
  })
  await app.getByRole('button', { name: /Xuất/ }).first().click()
  const pdfBtn = app.getByRole('button', { name: /PDF trình chiếu/ }).first()
  await expect(pdfBtn).toBeVisible()
  // print media hides app chrome; click through the DOM after switching media
  await app.emulateMedia({ media: 'print' })
  await app.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /PDF trình chiếu/.test(x.textContent ?? ''))
    ;(b as HTMLElement).click()
  })
  await app.waitForFunction(() => (window as any).__snap !== undefined)
  const snap: { sh: number; ch: number; top: number; bottom: number }[] = await app.evaluate(() => (window as any).__snap)
  const worst = Math.max(...snap.map((s) => s.sh - s.ch))
  console.log('SLIDES', snap.length, 'worst overflow', worst, JSON.stringify(snap.map((s, i) => [i, s.sh, s.ch]).filter((x) => x[1] > x[2])))
  expect(snap.length).toBeGreaterThan(2)
  console.log('GAPS min top', Math.min(...snap.map((s) => s.top)), 'min bottom', Math.min(...snap.map((s) => s.bottom)), 'max sh/ch', Math.max(...snap.map((s) => s.sh)), snap[0].ch)
  for (const s of snap) {
    expect(s.sh).toBeLessThanOrEqual(s.ch + 1)
    expect(s.top).toBeGreaterThanOrEqual(-1)
    expect(s.bottom).toBeGreaterThanOrEqual(-1)
  }
  const inDom = await app.locator('.deck-print-slide').count()
  const pdf = await app.pdf({ preferCSSPageSize: true, printBackground: true })
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  console.log('PDF pages', pages, 'DOM slides', inDom)
  expect(pages).toBe(inDom)
})

test('nút Ngắt slide tại đây chèn dấu', async ({ context, server }) => {
  server.write('doc.md', '# T\n\nmột\n\nhai\n\nba\n')
  const app = await openDoc(context, `${server.origin}/doc.md`)
  await app.getByRole('radio', { name: 'Sửa' }).click()
  const cm = app.locator('.cm-content')
  await expect(cm).toBeVisible()
  await cm.getByText('hai', { exact: true }).click()
  await app.getByRole('button', { name: 'Ngắt slide tại đây' }).click()
  await expect(cm).toContainText('<!-- slide-break -->')
  const text = (await cm.textContent()) ?? ''
  expect(text.split('<!-- slide-break -->').length - 1).toBe(1)
  expect(text.indexOf('<!-- slide-break -->')).toBeLessThan(text.indexOf('hai'))
})
