// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const html = readFileSync(resolve(root, 'site/uninstall.html'), 'utf8')
const js = readFileSync(resolve(root, 'site/uninstall.js'), 'utf8')
const feedback = readFileSync(resolve(root, 'apps/api/src/feedback.ts'), 'utf8')

describe('uninstall page', () => {
  it('reason values equal server UNINSTALL_REASONS', () => {
    const m = /UNINSTALL_REASONS\s*=\s*\[([^\]]*)\]/.exec(feedback)
    const body = m?.[1]
    if (body === undefined) throw new Error('UNINSTALL_REASONS not found in feedback.ts')
    const server = [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
    const page = [...html.matchAll(/<input[^>]*name="reason"[^>]*>/g)]
      .map((x) => /value="([^"]+)"/.exec(x[0])![1])
      .sort()
    expect(server.length).toBeGreaterThan(0)
    expect(page).toEqual(server)
  })

  it('has no telemetry', () => {
    expect(html).not.toMatch(/<script[^>]*\ssrc\s*=\s*["']?(?:https?:)?\/\//i)
    for (const s of [html, js]) {
      for (const bad of ['x-mdr-install', 'sendBeacon', 'XMLHttpRequest', 'document.cookie', 'gtag', 'analytics']) {
        expect(s).not.toContain(bad)
      }
    }
  })

  it('is bilingual for each section', () => {
    const block = (l: string) => new RegExp(`<div lang="${l}">([\\s\\S]*?)</div>`).exec(html)![1]
    const vi = block('vi')
    const en = block('en')
    expect(vi).toContain('đã bị xoá')
    expect(en).toContain('deleted')
    for (const b of [vi, en]) {
      expect(b).toContain('90')
      expect(b).toContain('mailto:qhao.work@gmail.com')
    }
    const form = /<form[\s\S]*<\/form>/.exec(html)![0]
    expect(form.match(/<span lang="vi"/g)!.length).toBe(form.match(/<span lang="en"/g)!.length)
    expect(form.match(/<span lang="vi"/g)!.length).toBeGreaterThan(5)
    expect(html).toContain('chromewebstore.google.com/detail/md-reader/eolclccibhickmpbpbdodbhopnddcdog')
    expect(html.match(/<form/g)!.length).toBe(1)
    expect(html).toContain('<script src="uninstall.js">')
  })

  it('honeypot is named mdr_hp and inert', () => {
    expect(html).toContain('name="mdr_hp"')
    expect(html).not.toContain('name="website"')
    expect(html).toMatch(/<div class="fb-trap"[^>]*\sinert/)
  })

  it('js posts feedback once with mailto fallback and 429 message', () => {
    expect(js).toMatch(/var API = '[^']*\/api\/feedback'/)
    expect(js.match(/fetch\(/g)!.length).toBe(1)
    expect(js).toMatch(/fetch\(API\b/)
    expect(js).toMatch(/kind: ['"]uninstall['"]/)
    const body = /JSON\.stringify\(\{([\s\S]*?)\}\)/.exec(js)![1]
    for (const k of ['kind', 'reason', 'message', 'email', 'version', 'browser', 'locale', 'website']) {
      expect(body).toMatch(new RegExp(`\\b${k}\\b\\s*:`))
    }
    expect(js).toContain("elements['mdr_hp']")
    expect(js).toContain('mailto:')
    expect(js).toContain('429')
    expect(js).toContain('Too many submissions today')
  })
})
