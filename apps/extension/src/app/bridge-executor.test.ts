import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'
import { createDoc, ensureDoc, getHistory, getSource, createCheckpointTracker } from '@md-reader/core'
import { textHash, type BridgeRequest } from '@md-reader/core/bridge'
import { buildShareUrl, type ShareLink } from '@md-reader/core'
import { createBridgeExecutor as createRaw, DAY_MS, type ExecSession, type ExecShare } from './bridge-executor'

const createBridgeExecutor = (get: Parameters<typeof createRaw>[0], opts?: Parameters<typeof createRaw>[1]) => {
  const e = createRaw(get, opts)
  return (r: BridgeRequest) => e(r, 'test')
}

const hashHook = vi.hoisted(() => ({ fn: null as null | (() => void) }))
vi.mock('@md-reader/core/bridge', async (orig) => {
  const m = await orig<typeof import('@md-reader/core/bridge')>()
  return { ...m, textHash: async (t: string) => { const r = await m.textHash(t); const f = hashHook.fn; if (f) { hashHook.fn = null; f() } return r } }
})

const req = (tool: BridgeRequest['tool'], args: unknown): BridgeRequest => ({ type: 'req', id: 'r1', tool, args })
function sess(md = '# Hi', over: Partial<ExecSession> = {}): ExecSession {
  const yText = new Y.Doc().getText('source')
  yText.insert(0, md)
  return { docId: 'd1', title: 'T', yText, shared: true, synced: true, checkpoints: null, persisted: null, share: null, confirm: null, ...over }
}

describe('createBridgeExecutor', () => {
  it('get_doc returns markdown + hash', async () => {
    const run = createBridgeExecutor(() => sess())
    const r = await run(req('get_doc', { docId: 'd1' }))
    expect(r).toEqual({ type: 'res', id: 'r1', ok: true, result: { docId: 'd1', title: 'T', markdown: '# Hi', hash: await textHash('# Hi'), shared: true } })
  })
  it('other docId -> NOT_FOUND', async () => {
    const r = await createBridgeExecutor(() => sess())(req('get_doc', { docId: 'zz' }))
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND', message: 'document is not open in this tab' } })
  })
  it('null session -> NOT_FOUND', async () => {
    const r = await createBridgeExecutor(() => null)(req('get_doc', { docId: 'd1' }))
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
  it('share_doc without share/confirm -> INTERNAL', async () => {
    const r = await createBridgeExecutor(() => sess())(req('share_doc', { docId: 'd1', role: 'view', expiresInDays: 7 }))
    expect(r).toMatchObject({ ok: false, error: { code: 'INTERNAL', message: 'sharing unavailable' } })
  })
  it('bad args -> INVALID_ARGS', async () => {
    const r = await createBridgeExecutor(() => sess())(req('get_doc', {}))
    expect(r).toMatchObject({ ok: false, error: { code: 'INVALID_ARGS' } })
  })
  it('waits until synced and reads latest yText', async () => {
    let calls = 0
    const stale = sess('stale', { synced: false })
    const fresh = sess('fresh', { synced: true })
    const get = () => (++calls > 3 ? fresh : stale)
    const run = createBridgeExecutor(get, { waitMs: 1000, pollMs: 10, sleep: async () => {} })
    const r = await run(req('get_doc', { docId: 'd1' }))
    expect(r).toMatchObject({ ok: true, result: { markdown: 'fresh' } })
  })
  it('never synced -> TIMEOUT', async () => {
    let t = 0
    const run = createBridgeExecutor(() => sess('x', { synced: false }), { waitMs: 50, pollMs: 10, sleep: async (ms) => { t += ms } })
    const r = await run(req('get_doc', { docId: 'd1' }))
    expect(r).toMatchObject({ ok: false, error: { code: 'TIMEOUT', message: 'document is still loading' } })
    expect(t).toBeGreaterThanOrEqual(50)
  })
  it('docId changes while waiting -> NOT_FOUND', async () => {
    let n = 0
    const run = createBridgeExecutor(() => (++n > 2 ? sess('y', { docId: 'other' }) : sess('x', { synced: false })), { waitMs: 1000, pollMs: 10, sleep: async () => {} })
    const r = await run(req('get_doc', { docId: 'd1' }))
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  describe('update_doc', () => {
    function real(md: string) {
      const doc = createDoc()
      ensureDoc(doc)
      const yText = getSource(doc)
      yText.insert(0, md)
      const checkpoints = createCheckpointTracker(doc)
      const s: ExecSession = { docId: 'd1', title: 'T', yText, shared: false, synced: true, checkpoints, persisted: null, share: null, confirm: null }
      return { doc, yText, s }
    }
    const upd = (markdown: string, baseHash: string) => req('update_doc', { docId: 'd1', markdown, baseHash })

    it('changes one word with minimal delta and origin mcp', async () => {
      const { doc, yText, s } = real('alpha beta gamma')
      const deltas: unknown[] = []
      let origin: unknown
      yText.observe((e, tr) => { deltas.push(e.changes.delta); origin = tr.origin })
      const r = await createBridgeExecutor(() => s)(upd('alpha BETA gamma', await textHash('alpha beta gamma')))
      expect(r).toMatchObject({ ok: true, result: { hash: await textHash('alpha BETA gamma') } })
      expect(yText.toString()).toBe('alpha BETA gamma')
      expect(origin).toBe('mcp')
      const all = (deltas as Array<Array<Record<string, unknown>>>).flat()
      expect(all.filter((d) => 'delete' in d)).toHaveLength(1)
      expect(all.filter((d) => 'insert' in d)).toHaveLength(1)
      void doc
    })
    it('converges with a concurrent replica edit', async () => {
      const a = real('first para\n\nlast para')
      const bDoc = new Y.Doc({ gc: false })
      Y.applyUpdate(bDoc, Y.encodeStateAsUpdate(a.doc))
      const bText = bDoc.getText('source')
      bText.insert(bText.length, ' END')
      await createBridgeExecutor(() => a.s)(upd('FIRST para\n\nlast para', await textHash('first para\n\nlast para')))
      Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(bDoc))
      Y.applyUpdate(bDoc, Y.encodeStateAsUpdate(a.doc))
      expect(a.yText.toString()).toBe(bText.toString())
      expect(a.yText.toString()).toContain('FIRST')
      expect(a.yText.toString()).toContain('END')
    })
    it('wrong baseHash -> CONFLICT, no change', async () => {
      const { yText, s } = real('abc')
      const r = await createBridgeExecutor(() => s)(upd('xyz', 'a'.repeat(64)))
      expect(r).toMatchObject({ ok: false, error: { code: 'CONFLICT' } })
      expect((r as { error: { message: string } }).error.message).toContain(await textHash('abc'))
      expect(yText.toString()).toBe('abc')
    })
    it('text changed while hashing -> CONFLICT, interleaved edit intact', async () => {
      const { yText, s } = real('abc')
      const base = await textHash('abc')
      hashHook.fn = () => { yText.insert(3, 'Z') }
      const r = await createBridgeExecutor(() => s)(upd('xyz', base))
      expect(r).toMatchObject({ ok: false, error: { code: 'CONFLICT' } })
      expect((r as { error: { message: string } }).error.message).toContain(await textHash('abcZ'))
      expect(yText.toString()).toBe('abcZ')
    })
    it('writes under an AI client id registered in meta.actors', async () => {
      const { doc, yText, s } = real('hello world')
      await createBridgeExecutor(() => s)(upd('hello WORLD', await textHash('hello world')))
      const ids = new Set<number>()
      for (let n = yText._start; n; n = n.right as typeof n) ids.add(n.id.client)
      const ai = [...ids].filter((c) => c !== doc.clientID)
      expect(ai.length).toBeGreaterThan(0)
      const actors = doc.getMap('meta').get('actors') as Y.Map<string>
      for (const c of ai) expect(actors.get(String(c))).toBe('AI')
    })
    it('waits for checkpoints then applies; never ready -> TIMEOUT', async () => {
      const { doc, yText, s } = real('one')
      let n = 0
      const late = () => (++n > 2 ? s : { ...s, checkpoints: null })
      const run = createBridgeExecutor(late, { waitMs: 1000, pollMs: 10, sleep: async () => {} })
      expect(await run(upd('two', await textHash('one')))).toMatchObject({ ok: true })
      expect(getHistory(doc).toArray().filter((h) => h.label === 'AI: cập nhật')).toHaveLength(1)
      const { yText: y2, s: s2 } = real('one')
      const never = createBridgeExecutor(() => ({ ...s2, checkpoints: null }), { waitMs: 50, pollMs: 10, sleep: async () => {} })
      expect(await never(upd('two', await textHash('one')))).toMatchObject({ ok: false, error: { code: 'TIMEOUT' } })
      expect(y2.toString()).toBe('one')
      void yText
    })
    it('awaits persisted before responding; hung persisted -> returns after sleep(2000)', async () => {
      const { s } = real('one')
      let release!: () => void
      const persisted = () => new Promise<void>((r) => { release = r })
      let done = false
      const run = createBridgeExecutor(() => ({ ...s, persisted }), { sleep: () => new Promise<void>(() => {}) })
      const p = run(upd('two', await textHash('one'))).then((r) => { done = true; return r })
      await new Promise((r) => setTimeout(r, 50))
      expect(done).toBe(false)
      release()
      expect(await p).toMatchObject({ ok: true })
      const { s: s2 } = real('one')
      const sleeps: number[] = []
      const run2 = createBridgeExecutor(() => ({ ...s2, persisted: () => new Promise<void>(() => {}) }), { sleep: async (ms) => { sleeps.push(ms) } })
      expect(await run2(upd('two', await textHash('one')))).toMatchObject({ ok: true })
      expect(sleeps).toContain(2000)
    })
    it('adds AI checkpoint only when changed', async () => {
      const { doc, s } = real('one')
      const run = createBridgeExecutor(() => s)
      await run(upd('one', await textHash('one')))
      const labels = () => getHistory(doc).toArray().filter((h) => h.label === 'AI: cập nhật')
      expect(labels()).toHaveLength(0)
      await run(upd('two', await textHash('one')))
      expect(labels()).toHaveLength(1)
      expect(labels()[0]!.actor).toBe('AI')
    })
  })

  it('null session then ready after 2 polls -> get_doc works; always null -> NOT_FOUND', async () => {
    let n = 0
    const ready = sess('late')
    const run = createBridgeExecutor(() => (++n > 2 ? ready : null), { waitMs: 1000, pollMs: 10, sleep: async () => {} })
    expect(await run(req('get_doc', { docId: 'd1' }))).toMatchObject({ ok: true, result: { markdown: 'late' } })
    const never = createBridgeExecutor(() => null, { waitMs: 50, pollMs: 10, sleep: async () => {} })
    expect(await never(req('get_doc', { docId: 'd1' }))).toMatchObject({ ok: false, error: { code: 'NOT_FOUND', message: 'document is not open in this tab' } })
  })

  describe('sharing', () => {
    const link = (over: Partial<ShareLink> = {}): ShareLink => ({ tokenPrefix: 'abcd12', role: 'view', label: 'x', createdAt: 1, expiresAt: null, revokedAt: null, token: 'SECRET', ...over } as ShareLink)
    function mk(over: Partial<ExecShare> = {}, ok: boolean | Error = true, links: ShareLink[] = []) {
      const share = {
        serverUrl: 'https://s.example', bound: vi.fn(() => true), links: vi.fn(() => links), refresh: vi.fn(async () => {}),
        enable: vi.fn(async () => {}), createLink: vi.fn(async () => link({ token: 'TOK', tokenPrefix: 'TOKPRE', expiresAt: 99 })), revoke: vi.fn(async () => {}),
        ...over,
      } as ExecShare & Record<string, ReturnType<typeof vi.fn>>
      const confirm = vi.fn(async () => { if (ok instanceof Error) throw ok; return ok })
      const run = createRaw(() => sess('# Hi', { share, confirm }))
      return { share, confirm, run }
    }
    const shareReq = (days: number | null) => req('share_doc', { docId: 'd1', role: 'edit', expiresInDays: days })
    it('list_links not shared -> []', async () => {
      const { run, confirm } = mk({ bound: vi.fn(() => false) })
      expect(await run(req('list_links', { docId: 'd1' }), 'c')).toMatchObject({ ok: true, result: { links: [] } })
      expect(confirm).not.toHaveBeenCalled()
    })
    it('list_links maps without token', async () => {
      const { run, share } = mk({}, true, [link({ label: 'L', expiresAt: 5 })])
      const r = await run(req('list_links', { docId: 'd1' }), 'c')
      expect(share.refresh).toHaveBeenCalled()
      expect(r).toEqual({ type: 'res', id: 'r1', ok: true, result: { links: [{ tokenPrefix: 'abcd12', role: 'view', label: 'L', expiresAt: 5, revokedAt: null }] } })
      expect(JSON.stringify(r)).not.toContain('SECRET')
    })
    it('share allow -> enable + createLink with expiresIn', async () => {
      const { run, share, confirm } = mk()
      const r = await run(shareReq(7), 'Claude')
      expect(confirm).toHaveBeenCalledWith({ kind: 'share', docTitle: 'T', role: 'edit', expiresInDays: 7 }, 'Claude')
      expect(share.enable).toHaveBeenCalled()
      expect(share.createLink).toHaveBeenCalledWith({ role: 'edit', expiresIn: 7 * DAY_MS, label: 'AI · Claude' })
      expect(r).toEqual({ type: 'res', id: 'r1', ok: true, result: { url: buildShareUrl('https://s.example', 'TOK'), tokenPrefix: 'TOKPRE', expiresAt: 99 } })
      await run(shareReq(null), 'Claude')
      expect(share.createLink).toHaveBeenLastCalledWith(expect.objectContaining({ expiresIn: null }))
    })
    it('share deny -> DENIED, no createLink', async () => {
      const { run, share } = mk({}, false)
      expect(await run(shareReq(7), 'c')).toMatchObject({ ok: false, error: { code: 'DENIED', message: 'user declined' } })
      expect(share.createLink).not.toHaveBeenCalled()
    })
    it('createLink throws -> SHARE_FAILED', async () => {
      const { run } = mk({ createLink: vi.fn(async () => { throw new Error('429 slow down') }) })
      expect(await run(shareReq(7), 'c')).toMatchObject({ ok: false, error: { code: 'SHARE_FAILED', message: expect.stringContaining('429') } })
    })
    it('confirm timeout -> TIMEOUT', async () => {
      const { run } = mk({}, new Error('timeout'))
      expect(await run(shareReq(7), 'c')).toMatchObject({ ok: false, error: { code: 'TIMEOUT', message: 'no answer from user' } })
    })
    it('revoke unknown prefix -> NOT_FOUND, no confirm', async () => {
      const { run, confirm } = mk({}, true, [link()])
      expect(await run(req('revoke_link', { docId: 'd1', tokenPrefix: 'zzzzzz' }), 'c')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
      expect(confirm).not.toHaveBeenCalled()
    })
    it('revoke allow -> revoke called; deny -> DENIED', async () => {
      const a = mk({}, true, [link()])
      expect(await a.run(req('revoke_link', { docId: 'd1', tokenPrefix: 'abcd12' }), 'c')).toMatchObject({ ok: true, result: { revoked: true } })
      expect(a.share.revoke).toHaveBeenCalledWith('abcd12')
      const d = mk({}, false, [link()])
      expect(await d.run(req('revoke_link', { docId: 'd1', tokenPrefix: 'abcd12' }), 'c')).toMatchObject({ ok: false, error: { code: 'DENIED' } })
      expect(d.share.revoke).not.toHaveBeenCalled()
    })
  })
})
