import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { textHash, type BridgeRequest } from '@md-reader/core/bridge'
import { createBridgeExecutor, type ExecSession } from './bridge-executor'

const req = (tool: BridgeRequest['tool'], args: unknown): BridgeRequest => ({ type: 'req', id: 'r1', tool, args })
function sess(md = '# Hi', over: Partial<ExecSession> = {}): ExecSession {
  const yText = new Y.Doc().getText('source')
  yText.insert(0, md)
  return { docId: 'd1', title: 'T', yText, shared: true, synced: true, ...over }
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
  it('update_doc -> INTERNAL', async () => {
    const r = await createBridgeExecutor(() => sess())(req('update_doc', { docId: 'd1', markdown: 'x', baseHash: 'a'.repeat(64) }))
    expect(r).toMatchObject({ ok: false, error: { code: 'INTERNAL', message: 'not implemented yet' } })
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
})
