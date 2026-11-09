import { describe, it, expect, vi } from 'vitest'
import { browserLabel, feedbackMailto, sendFeedback, toFeedbackInput, type FeedbackInput } from './feedback-client'

const input: FeedbackInput = {
  kind: 'bug',
  reason: null,
  message: 'hello',
  email: null,
  version: '1.0.0',
  browser: 'Chrome 130',
  locale: 'vi',
}

describe('sendFeedback', () => {
  it('204 -> sent, gửi đúng request không định danh', async () => {
    const f = vi.fn().mockResolvedValue({ status: 204, ok: true })
    const r = await sendFeedback(input, f as unknown as typeof fetch, 'https://x.test/')
    expect(r).toBe('sent')
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('https://x.test/api/feedback')
    expect(init.method).toBe('POST')
    expect(Object.keys(init.headers)).toEqual(['content-type'])
    expect(init.credentials).toBe('omit')
    const body = JSON.parse(init.body)
    expect(Object.keys(body).sort()).toEqual(
      ['kind', 'reason', 'message', 'email', 'version', 'browser', 'locale', 'website'].sort(),
    )
    expect(body.website).toBe('')
  })
  it('429 và 500 -> failed', async () => {
    for (const status of [429, 500]) {
      const f = vi.fn().mockResolvedValue({ status, ok: false })
      expect(await sendFeedback(input, f as unknown as typeof fetch, 'https://x.test')).toBe('failed')
    }
  })
  it('fetch ném -> failed', async () => {
    const f = vi.fn().mockRejectedValue(new Error('net'))
    expect(await sendFeedback(input, f as unknown as typeof fetch, 'https://x.test')).toBe('failed')
  })
  it('base rỗng -> failed, không gọi fetch', async () => {
    const f = vi.fn()
    expect(await sendFeedback(input, f as unknown as typeof fetch, '')).toBe('failed')
    expect(f).not.toHaveBeenCalled()
  })
})

describe('browserLabel', () => {
  it('brands Chrome', () => {
    expect(browserLabel({ userAgentData: { brands: [{ brand: 'Google Chrome', version: '130' }] } })).toBe('Chrome 130')
  })
  it('UA Edge/Firefox/rỗng', () => {
    const edge = browserLabel({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537 Edg/120.0.1' })
    expect(edge).toBe('Edge 120')
    const ff = browserLabel({ userAgent: 'Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/118.0' })
    expect(ff).toBe('Firefox 118')
    expect(browserLabel({})).toBe('unknown')
    for (const s of [edge, ff]) expect(s).not.toMatch(/Mozilla|Windows|Mac/)
  })
})

describe('toFeedbackInput / feedbackMailto', () => {
  const diag = { version: '1.4.0', browser: 'Chrome 130', locale: 'vi' }
  it('email rỗng -> null, locale vi', () => {
    const r = toFeedbackInput({ kind: 'idea', message: 'm', email: '  ' }, diag)
    expect(r.email).toBeNull()
    expect(r.locale).toBe('vi')
    expect(r.reason).toBeNull()
  })
  it('mailto mã hoá đúng', () => {
    const u = feedbackMailto({ kind: 'bug', message: 'a&b\nc', email: '' }, diag)
    expect(u.startsWith('mailto:qhao.work@gmail.com?subject=')).toBe(true)
    expect(u).toContain(encodeURIComponent('MD Reader feedback (bug)'))
    expect(u).toContain(encodeURIComponent('a&b\nc\n\n---\nVersion: 1.4.0 · Browser: Chrome 130 · Language: vi'))
  })
})
