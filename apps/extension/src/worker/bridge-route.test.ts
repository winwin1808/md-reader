import { describe, it, expect, vi } from 'vitest'
import { createExecuteInApp, isNoReceiver, type RouteDeps } from './bridge-route'
import type { DocRecord } from '../app/doc-registry'
import type { BridgeRequest } from '@md-reader/core/bridge'

const rec = (o: Partial<DocRecord> = {}): DocRecord => ({
  docId: 'd1', title: 'T', originKind: 'drop', originPath: null, persistenceName: 'p', lastOpenedAt: 5, hasHandle: false, ...o,
})
const req = (tool: BridgeRequest['tool'], args: unknown): BridgeRequest => ({ type: 'req', id: 'r1', tool, args })

function mk(over: Partial<RouteDeps> = {}) {
  const deps = {
    createRecord: vi.fn(async () => rec()),
    writeDocText: vi.fn(async () => 'written' as const),
    listRecent: vi.fn(async () => [] as DocRecord[]),
    getRecord: vi.fn(async () => rec()),
    docUrl: vi.fn(async (id: string) => 'chrome-extension://x/app.html?d=t-' + id),
    findTab: vi.fn(async () => null as number | null),
    openTab: vi.fn(async () => 7),
    closeTab: vi.fn(async () => {}),
    deleteRecord: vi.fn(async () => {}),
    sleep: vi.fn(async () => {}),
    now: vi.fn(() => 0),
    sendToTab: vi.fn(async () => ({ type: 'res', id: 'r1', ok: true, result: { hi: 1 } }) as never),
    focusTab: vi.fn(async () => {}),
    ...over,
  } satisfies RouteDeps
  const exec = createExecuteInApp(deps as RouteDeps)
  return { deps, run: (r: BridgeRequest, client = 'Claude') => exec(r, client) }
}

describe('createExecuteInApp', () => {
  it('publish writes record+text and opens active tab', async () => {
    const { deps, run } = mk()
    const r = await run(req('publish_doc', { title: 'Hello', markdown: '# x' }))
    expect(deps.createRecord).toHaveBeenCalledWith({ title: 'Hello', originKind: 'drop', originPath: null })
    expect(deps.writeDocText).toHaveBeenCalledWith(expect.objectContaining({ docId: 'd1' }), '# x', 'replace')
    expect(deps.openTab).toHaveBeenCalledWith(expect.stringContaining('d1'), true)
    expect(r).toEqual({ type: 'res', id: 'r1', ok: true, result: { docId: 'd1' } })
  })
  it('open:false does not open', async () => {
    const { deps, run } = mk()
    await run(req('publish_doc', { title: 'H', markdown: 'x', open: false }))
    expect(deps.openTab).not.toHaveBeenCalled()
  })
  it('write failure -> INTERNAL', async () => {
    const { deps, run } = mk({ writeDocText: vi.fn(async () => { throw new Error('boom') }) })
    const r = await run(req('publish_doc', { title: 'H', markdown: 'x' })) as any
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('INTERNAL')
    expect(deps.openTab).not.toHaveBeenCalled()
  })
  it('list_docs maps shared by room', async () => {
    const { run } = mk({ listRecent: vi.fn(async () => [rec({ docId: 'a', room: {} as never }), rec({ docId: 'b', title: 'B', lastOpenedAt: 9 })]) })
    const r = await run(req('list_docs', {})) as any
    expect(r.result.docs).toEqual([
      { docId: 'a', title: 'T', lastOpenedAt: 5, shared: true },
      { docId: 'b', title: 'B', lastOpenedAt: 9, shared: false },
    ])
  })
  it('get_doc missing -> NOT_FOUND', async () => {
    const { run } = mk({ getRecord: vi.fn(async () => null) })
    const r = await run(req('get_doc', { docId: 'zz' })) as any
    expect(r.error.code).toBe('NOT_FOUND')
  })
  it('write failure deletes record', async () => {
    const { deps, run } = mk({ writeDocText: vi.fn(async () => { throw new Error('boom') }), deleteRecord: vi.fn(async () => { throw new Error('x') }) })
    const r = await run(req('publish_doc', { title: 'H', markdown: 'x' })) as any
    expect(deps.deleteRecord).toHaveBeenCalledWith('d1')
    expect(r.error.code).toBe('INTERNAL')
    expect(deps.openTab).not.toHaveBeenCalled()
  })
  it('existing tab: no open/close, forwards response', async () => {
    const { deps, run } = mk({ findTab: vi.fn(async () => 3) })
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(deps.openTab).not.toHaveBeenCalled()
    expect(deps.closeTab).not.toHaveBeenCalled()
    expect(deps.sendToTab).toHaveBeenCalledWith(3, { type: 'mdr-bridge-exec', req: req('get_doc', { docId: 'd1' }), client: 'Claude' })
    expect(r.result).toEqual({ hi: 1 })
  })
  it('no tab: opens background, sends, closes', async () => {
    const { deps, run } = mk()
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(deps.openTab).toHaveBeenCalledWith(expect.any(String), false)
    expect(deps.closeTab).toHaveBeenCalledWith(7)
    expect(r.ok).toBe(true)
  })
  it('retries sendToTab until it succeeds', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValueOnce({ type: 'res', id: 'r1', ok: true, result: { hi: 1 } })
    const { deps, run } = mk({ sendToTab: send as never })
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(r.result).toEqual({ hi: 1 })
    expect(deps.sleep).toHaveBeenCalledTimes(2)
    expect(deps.sleep).toHaveBeenCalledWith(250)
  })
  it('send keeps failing past deadline -> TIMEOUT and closes opened tab', async () => {
    let t = 0
    const { deps, run } = mk({ sendToTab: vi.fn(async () => { throw new Error('Could not establish connection. Receiving end does not exist.') }), now: vi.fn(() => (t += 6000)) })
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(r.error.code).toBe('TIMEOUT')
    expect(deps.closeTab).toHaveBeenCalledWith(7)
  })
  it('retries 2x on no-receiver then forwards; 3 calls', async () => {
    const e = new Error('Could not establish connection. Receiving end does not exist.')
    const send = vi.fn().mockRejectedValueOnce(e).mockRejectedValueOnce(e)
      .mockResolvedValueOnce({ type: 'res', id: 'r1', ok: true, result: { hi: 1 } })
    const { run } = mk({ sendToTab: send as never })
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(r.result).toEqual({ hi: 1 })
    expect(send).toHaveBeenCalledTimes(3)
  })
  it('other send error -> INTERNAL, single send, opened tab closed', async () => {
    const send = vi.fn(async () => { throw new Error('The message port closed before a response was received.') })
    const { deps, run } = mk({ sendToTab: send as never })
    const r = await run(req('update_doc', { docId: 'd1', markdown: 'x', baseHash: 'a'.repeat(64) })) as any
    expect(r.error.code).toBe('INTERNAL')
    expect(r.error.message).toContain('message port closed')
    expect(send).toHaveBeenCalledTimes(1)
    expect(deps.closeTab).toHaveBeenCalledWith(7)
  })
  it('isNoReceiver', () => {
    expect(isNoReceiver(new Error('Could not establish connection.'))).toBe(true)
    expect(isNoReceiver('Receiving end does not exist')).toBe(true)
    expect(isNoReceiver(new Error('other'))).toBe(false)
    expect(isNoReceiver(undefined)).toBe(false)
  })
  it('update_doc with opened tab still closes it', async () => {
    const { deps, run } = mk()
    await run(req('update_doc', { docId: 'd1', markdown: 'x', baseHash: 'a'.repeat(64) }))
    expect(deps.closeTab).toHaveBeenCalledWith(7)
  })
  it('share_doc existing tab: focuses it, message carries client', async () => {
    const { deps, run } = mk({ findTab: vi.fn(async () => 3) })
    await run(req('share_doc', { docId: 'd1' }), 'Cursor')
    expect(deps.focusTab).toHaveBeenCalledWith(3)
    expect(deps.sendToTab).toHaveBeenCalledWith(3, expect.objectContaining({ client: 'Cursor' }))
  })
  it('revoke_link with self-opened tab: focus then close after', async () => {
    const order: string[] = []
    const { deps, run } = mk({
      focusTab: vi.fn(async () => { order.push('focus') }),
      closeTab: vi.fn(async () => { order.push('close') }),
    })
    await run(req('revoke_link', { docId: 'd1', tokenPrefix: 'abcd12' }))
    expect(deps.focusTab).toHaveBeenCalledWith(7)
    expect(order).toEqual(['focus', 'close'])
  })
  it('get_doc does not focus', async () => {
    const { deps, run } = mk({ findTab: vi.fn(async () => 3) })
    await run(req('get_doc', { docId: 'd1' }))
    expect(deps.focusTab).not.toHaveBeenCalled()
  })
  it('focusTab throwing still sends', async () => {
    const { deps, run } = mk({ findTab: vi.fn(async () => 3), focusTab: vi.fn(async () => { throw new Error('no window') }) })
    const r = await run(req('share_doc', { docId: 'd1' })) as any
    expect(r.ok).toBe(true)
    expect(deps.sendToTab).toHaveBeenCalledTimes(1)
  })
  it('invalid args -> INVALID_ARGS', async () => {
    const { run } = mk()
    const r = await run(req('publish_doc', { title: '' })) as any
    expect(r.error.code).toBe('INVALID_ARGS')
  })
})
