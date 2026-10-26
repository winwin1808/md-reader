import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { textHash, type BridgeRequest } from '@md-reader/core/bridge'
import { createBridgeExecutor, type ExecSession } from './bridge-executor'

const req = (tool: BridgeRequest['tool'], args: unknown): BridgeRequest => ({ type: 'req', id: 'r1', tool, args })
function sess(md = '# Hi', over: Partial<ExecSession> = {}): ExecSession {
  const yText = new Y.Doc().getText('source')
  yText.insert(0, md)
  return { docId: 'd1', title: 'T', yText, shared: true, ...over }
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
})
