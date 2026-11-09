import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '../..')
const html = readFileSync(resolve(root, 'site/uninstall.html'), 'utf8')
const js = readFileSync(resolve(root, 'site/uninstall.js'), 'utf8')
const feedback = readFileSync(resolve(root, 'apps/api/src/feedback.ts'), 'utf8')

describe('uninstall page', () => {
  it('reason values equal server UNINSTALL_REASONS', () => {
    const m = /UNINSTALL_REASONS\s*=\s*\[([^\]]*)\]/.exec(feedback)!
    const server = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
    const page = [...html.matchAll(/<input[^>]*name="reason"[^>]*>/g)]
      .map((x) => /value="([^"]+)"/.exec(x[0])![1])
      .sort()
    expect(server.length).toBeGreaterThan(0)
    expect(page).toEqual(server)
  })

  it('has no telemetry', () => {
    for (const s of [html, js]) {
      for (const bad of ['<script src="http', 'x-mdr-install', 'document.cookie', 'gtag', 'analytics']) {
        expect(s).not.toContain(bad)
      }
    }
  })

  it('is bilingual for each section', () => {
    expect(html.match(/<div lang="vi"/g)!.length).toBeGreaterThanOrEqual(1)
    expect(html.match(/<div lang="en"/g)!.length).toBeGreaterThanOrEqual(1)
    expect(html.match(/<span lang="vi"/g)!.length).toBeGreaterThan(5)
    expect(html.match(/<span lang="en"/g)!.length).toBeGreaterThan(5)
    expect(html).toMatch(/<div lang="vi"[^>]*>[\s\S]*đã bị xoá/)
    expect(html).toMatch(/<div lang="en"[^>]*>[\s\S]*deleted/)
    expect(html).toContain('90')
    expect(html).toContain('mailto:qhao.work@gmail.com')
    expect(html).toContain('chromewebstore.google.com/detail/md-reader/eolclccibhickmpbpbdodbhopnddcdog')
    expect(html).toContain('name="website"')
    expect(html.match(/<form/g)!.length).toBe(1)
    expect(html).toContain('<script src="uninstall.js">')
  })

  it('js posts feedback once with mailto fallback', () => {
    expect(js).toContain('/api/feedback')
    expect(js).toMatch(/kind: ['"]uninstall['"]/)
    expect(js).toContain('mailto:')
    expect(js.match(/fetch\(/g)!.length).toBe(1)
  })
})
