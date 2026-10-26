import { describe, it, expect, vi } from 'vitest'
import { createExecuteInApp, type RouteDeps } from './bridge-route'
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
    waitReady: vi.fn(async () => true),
    sendToTab: vi.fn(async () => ({ type: 'res', id: 'r1', ok: true, result: { hi: 1 } }) as never),
    ...over,
  } satisfies RouteDeps
  return { deps, run: createExecuteInApp(deps as RouteDeps) }
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
  it('existing tab: no open/close/wait, forwards response', async () => {
    const { deps, run } = mk({ findTab: vi.fn(async () => 3) })
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(deps.openTab).not.toHaveBeenCalled()
    expect(deps.closeTab).not.toHaveBeenCalled()
    expect(deps.waitReady).not.toHaveBeenCalled()
    expect(deps.sendToTab).toHaveBeenCalledWith(3, { type: 'mdr-bridge-exec', req: req('get_doc', { docId: 'd1' }) })
    expect(r.result).toEqual({ hi: 1 })
  })
  it('no tab: opens background, waits, sends, closes', async () => {
    const { deps, run } = mk()
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(deps.openTab).toHaveBeenCalledWith(expect.any(String), false)
    expect(deps.waitReady).toHaveBeenCalledWith('d1', 7, 10_000)
    expect(deps.closeTab).toHaveBeenCalledWith(7)
    expect(r.ok).toBe(true)
  })
  it('ready timeout -> TIMEOUT and still closes opened tab', async () => {
    const { deps, run } = mk({ waitReady: vi.fn(async () => false) })
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(r.error.code).toBe('TIMEOUT')
    expect(deps.sendToTab).not.toHaveBeenCalled()
    expect(deps.closeTab).toHaveBeenCalledWith(7)
  })
  it('sendToTab failure -> INTERNAL', async () => {
    const { run } = mk({ findTab: vi.fn(async () => 3), sendToTab: vi.fn(async () => { throw new Error('x') }) })
    const r = await run(req('get_doc', { docId: 'd1' })) as any
    expect(r.error.code).toBe('INTERNAL')
  })
  it('invalid args -> INVALID_ARGS', async () => {
    const { run } = mk()
    const r = await run(req('publish_doc', { title: '' })) as any
    expect(r.error.code).toBe('INVALID_ARGS')
  })
})
