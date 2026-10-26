import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { createDoc, ensureDoc, getHistory, getSource, createCheckpointTracker } from '@md-reader/core'
import { textHash, type BridgeRequest } from '@md-reader/core/bridge'
import { createBridgeExecutor, type ExecSession } from './bridge-executor'

const req = (tool: BridgeRequest['tool'], args: unknown): BridgeRequest => ({ type: 'req', id: 'r1', tool, args })
function sess(md = '# Hi', over: Partial<ExecSession> = {}): ExecSession {
  const yText = new Y.Doc().getText('source')
  yText.insert(0, md)
  return { docId: 'd1', title: 'T', yText, shared: true, synced: true, checkpoints: null, ...over }
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
  it('share_doc -> INTERNAL', async () => {
    const r = await createBridgeExecutor(() => sess())(req('share_doc', { docId: 'd1', role: 'view', expiresInDays: 7 }))
    expect(r).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
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
      const s: ExecSession = { docId: 'd1', title: 'T', yText, shared: false, synced: true, checkpoints }
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
})
