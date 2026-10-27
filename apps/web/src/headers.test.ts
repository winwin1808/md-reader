import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const headersPath = resolve(here, '../public/_headers')
const read = () => readFileSync(headersPath, 'utf8')
const csp = () => {
  const line = read().split('\n').map((l) => l.trim()).find((l) => l.startsWith('Content-Security-Policy:'))
  expect(line).toBeTruthy()
  return line!.slice('Content-Security-Policy:'.length).trim()
}
const directive = (name: string) => csp().split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ') || d === name)

describe('_headers', () => {
  it('script-src chỉ self, không unsafe-inline/eval', () => {
    const s = directive('script-src')
    expect(s).toBe("script-src 'self'")
    expect(s).not.toContain('unsafe-inline')
    expect(s).not.toContain('unsafe-eval')
  })
  it('chặn framing và object', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive('object-src')).toBe("object-src 'none'")
  })
  it('đủ các header còn lại', () => {
    const t = read()
    expect(t).toMatch(/^\s*X-Content-Type-Options: nosniff$/m)
    expect(t).toMatch(/^\s*Referrer-Policy: no-referrer$/m)
    expect(t).toMatch(/^\s*X-Frame-Options: DENY$/m)
  })
  it('sau build: dist/_headers có và index.html không có script inline', () => {
    const dist = resolve(here, '../dist')
    if (!existsSync(resolve(dist, 'index.html'))) return
    expect(existsSync(resolve(dist, '_headers'))).toBe(true)
    const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i)
  })
})
