import { describe, expect, it } from 'vitest'
import {
  D1FeedbackStore, FEEDBACK_PRUNE_BATCH, MAX_FEEDBACK_MESSAGE, MemoryFeedbackStore, parseFeedback,
  type FeedbackInput,
} from './feedback'

const ok = (o: Record<string, unknown> = {}) => ({ kind: 'bug', message: 'x', ...o })
const fb = (o: Partial<FeedbackInput> = {}): FeedbackInput => ({
  kind: 'bug', reason: null, message: 'm', email: null, version: null, browser: null, locale: null, ...o,
})

describe('18d2.1 hardening', () => {
  it('rejects whitespace/control chars in email', () => {
    expect(parseFeedback(ok({ email: 'a@b.c\nBcc: x' }))).toBeNull()
    expect(parseFeedback(ok({ email: 'a @b.c' }))).toBeNull()
    expect(parseFeedback(ok({ email: 'a@b.c\u0007' }))).toBeNull()
  })
  it('browser: no split surrogate, <= 64 code points, control chars dropped', () => {
    const b = 'a'.repeat(63) + '😀' + 'zzz'
    const r = parseFeedback(ok({ browser: b }))!
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(r.browser!)).toBe(false)
    expect(Array.from(r.browser!).length).toBeLessThanOrEqual(64)
    expect(parseFeedback(ok({ browser: 'Chr\nome' }))!.browser).toBe('Chrome')
    expect(parseFeedback(ok({ version: '1.\n2' }))!.version).toBe('1.2')
  })
  it('boundary sizes valid', () => {
    expect(parseFeedback(ok({ message: 'x'.repeat(2000) }))).not.toBeNull()
    const email = 'a'.repeat(252) + '@b'
    expect(email.length).toBe(254)
    expect(parseFeedback(ok({ email }))?.email).toBe(email)
  })
})

describe('parseFeedback', () => {
  it('accepts each kind', () => {
    expect(parseFeedback({ kind: 'uninstall', reason: 'bugs' })).toEqual(fb({ kind: 'uninstall', reason: 'bugs', message: '' }))
    expect(parseFeedback(ok())?.kind).toBe('bug')
    expect(parseFeedback({ kind: 'idea', message: ' hi ' })?.message).toBe('hi')
  })
  it('rejects unknown enums and bad shapes', () => {
    expect(parseFeedback(ok({ kind: 'spam' }))).toBeNull()
    expect(parseFeedback(ok({ reason: 'zzz' }))).toBeNull()
    expect(parseFeedback({ kind: 'uninstall' })).toBeNull()
    expect(parseFeedback({ kind: 'uninstall', reason: 'zzz' })).toBeNull()
    expect(parseFeedback(null)).toBeNull()
    expect(parseFeedback('str')).toBeNull()
    expect(parseFeedback(5)).toBeNull()
  })
  it('message rules', () => {
    expect(parseFeedback(ok({ message: '' }))).toBeNull()
    expect(parseFeedback(ok({ message: '   ' }))).toBeNull()
    expect(parseFeedback({ kind: 'uninstall', reason: 'other', message: '' })).not.toBeNull()
    expect(parseFeedback(ok({ message: 'a'.repeat(MAX_FEEDBACK_MESSAGE) }))).not.toBeNull()
    expect(parseFeedback(ok({ message: 'a'.repeat(MAX_FEEDBACK_MESSAGE + 1) }))).toBeNull()
  })
  it('email rules', () => {
    expect(parseFeedback(ok({ email: 'nope' }))).toBeNull()
    expect(parseFeedback(ok({ email: 5 }))).toBeNull()
    expect(parseFeedback(ok({ email: 'a'.repeat(253) + '@b' }))).toBeNull()
    expect(parseFeedback(ok({ email: '' }))?.email).toBeNull()
    expect(parseFeedback(ok({ email: null }))?.email).toBeNull()
    expect(parseFeedback(ok({ email: ' a@b.c ' }))?.email).toBe('a@b.c')
  })
  it('version/browser/locale/extras', () => {
    const r = parseFeedback(ok({ browser: 'b'.repeat(100), version: 3, locale: 'fr', ip: '1.2.3.4' }))!
    expect(r.browser).toHaveLength(64)
    expect(r.version).toBeNull()
    expect(r.locale).toBeNull()
    expect('ip' in r).toBe(false)
    expect(parseFeedback(ok({ locale: 'vi' }))?.locale).toBe('vi')
    expect(parseFeedback(ok({ version: '' }))?.version).toBeNull()
  })
})

describe('MemoryFeedbackStore', () => {
  it('add/list order, before, limit', async () => {
    const s = new MemoryFeedbackStore(() => 1)
    for (let i = 0; i < 3; i++) await s.add(fb({ message: `m${i}` }))
    const all = await s.list({ limit: 10 })
    expect(all.map((r) => r.id)).toEqual([3, 2, 1])
    expect((await s.list({ limit: 10, before: 3 })).map((r) => r.id)).toEqual([2, 1])
    expect((await s.list({ limit: 1 })).map((r) => r.id)).toEqual([3])
    expect(all[0]?.createdAt).toBe(1)
  })
  it('prune boundary and batch', async () => {
    let t = 10
    const s = new MemoryFeedbackStore(() => t)
    await s.add(fb())
    t = 20
    await s.add(fb())
    expect(await s.prune(10)).toBe(0)
    expect(await s.prune(11)).toBe(1)
    t = 1
    for (let i = 0; i < FEEDBACK_PRUNE_BATCH + 1; i++) await s.add(fb())
    expect(await s.prune(2)).toBe(FEEDBACK_PRUNE_BATCH)
    expect(await s.prune(2)).toBe(1)
  })
})

describe('D1FeedbackStore', () => {
  const mk = () => {
    const calls: { sql: string; args: unknown[] }[] = []
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => { calls.push({ sql, args }); return { meta: { changes: 7 } } },
          all: async () => {
            calls.push({ sql, args })
            return { results: [{ id: 2, kind: 'idea', reason: null, message: 'm', email: null, version: 'v', browser: null, locale: 'en', created_at: 9 }] }
          },
        }),
      }),
    } as unknown as D1Database
    return { calls, st: new D1FeedbackStore(db, () => 42) }
  }
  it('add', async () => {
    const { calls, st } = mk()
    await st.add(fb({ kind: 'uninstall', reason: 'bugs', message: '', locale: 'vi' }))
    expect(calls[0]!.sql).toContain('INSERT INTO feedback')
    expect(calls[0]!.args).toEqual(['uninstall', 'bugs', '', null, null, null, 'vi', 42])
  })
  it('list with and without before', async () => {
    const { calls, st } = mk()
    const rows = await st.list({ limit: 5 })
    expect(calls[0]!.sql).toContain('ORDER BY id DESC LIMIT ?')
    expect(calls[0]!.sql).not.toContain('id < ?')
    expect(calls[0]!.args).toEqual([5])
    expect(rows[0]).toEqual({ id: 2, kind: 'idea', reason: null, message: 'm', email: null, version: 'v', browser: null, locale: 'en', createdAt: 9 })
    await st.list({ limit: 5, before: 8 })
    expect(calls[1]!.sql).toContain('id < ?')
    expect(calls[1]!.args).toEqual([8, 5])
  })
  it('prune', async () => {
    const { calls, st } = mk()
    expect(await st.prune(100)).toBe(7)
    expect(calls[0]!.sql).toBe('DELETE FROM feedback WHERE id IN (SELECT id FROM feedback WHERE created_at < ? ORDER BY created_at LIMIT ?)')
    expect(calls[0]!.args).toEqual([100, FEEDBACK_PRUNE_BATCH])
  })
})
