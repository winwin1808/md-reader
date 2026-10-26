import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { YServer } from 'y-partyserver'
import { DocRoom } from './room'

function spyOnSuper(stub: boolean) {
  const spy = vi.spyOn(YServer.prototype as unknown as { handleMessage: (c: unknown, m: unknown) => void }, 'handleMessage')
  return stub ? spy.mockImplementation(() => undefined) : spy
}

function makeRoom(): DocRoom {
  const room = Object.create(DocRoom.prototype) as DocRoom
  room.droppedWrites = 0
  Object.defineProperty(room, 'document', { value: new Y.Doc() })
  ;(room as unknown as { getConnections: () => unknown[] }).getConnections = () => []
  return room
}
const conn = (state: unknown) => ({ id: 'c', state, readyState: 1, send: () => undefined }) as never
function updateMsg(text = 'hi'): Uint8Array {
  const d = new Y.Doc()
  d.getText('t').insert(0, text)
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 0)
  syncProtocol.writeUpdate(e, Y.encodeStateAsUpdate(d))
  return encoding.toUint8Array(e)
}
function step1Msg(): Uint8Array {
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 0)
  syncProtocol.writeSyncStep1(e, new Y.Doc())
  return encoding.toUint8Array(e)
}
function awMsg(color: string): Uint8Array {
  const aw = new Awareness(new Y.Doc())
  aw.setLocalState({ user: { name: 'A', color } })
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 1)
  encoding.writeVarUint8Array(e, encodeAwarenessUpdate(aw, [aw.clientID]))
  return encoding.toUint8Array(e)
}

describe('DocRoom.handleMessage', () => {
  it('drops updates from view connections', () => {
    const room = makeRoom()
    const spy = spyOnSuper(false)
    room.handleMessage(conn({ role: 'view' }), updateMsg())
    expect(room.droppedWrites).toBe(1)
    expect(spy).not.toHaveBeenCalled()
    expect(room.document.getText('t').toString()).toBe('')
    spy.mockRestore()
  })
  it('applies updates from edit connections', () => {
    const room = makeRoom()
    const spy = spyOnSuper(false)
    room.handleMessage(conn({ role: 'edit' }), updateMsg())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(room.droppedWrites).toBe(0)
    expect(room.document.getText('t').toString()).toBe('hi')
    spy.mockRestore()
  })
  it('lets view connections send step1', () => {
    const room = makeRoom()
    const spy = spyOnSuper(true)
    room.handleMessage(conn({ role: 'view' }), step1Msg())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(room.droppedWrites).toBe(0)
    spy.mockRestore()
  })
  it.each(['view', 'edit'])('sanitizes awareness for %s', (role) => {
    const room = makeRoom()
    const spy = spyOnSuper(true)
    room.handleMessage(conn({ role }), awMsg('red;background:url(x)'))
    expect(spy).toHaveBeenCalledTimes(1)
    const buf = spy.mock.calls[0]![1] as Uint8Array
    const d = decoding.createDecoder(buf)
    expect(decoding.readVarUint(d)).toBe(1)
    const u = decoding.createDecoder(decoding.readVarUint8Array(d))
    decoding.readVarUint(u)
    decoding.readVarUint(u)
    decoding.readVarUint(u)
    expect(JSON.parse(decoding.readVarString(u)).user.color).toBe('var(--peer-1)')
    spy.mockRestore()
  })
  it('drops garbage without throwing', () => {
    const room = makeRoom()
    const spy = spyOnSuper(true)
    expect(() => room.handleMessage(conn({ role: 'edit' }), new Uint8Array([1, 255, 255, 255]))).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('treats missing state or role as read-only', () => {
    const room = makeRoom()
    expect(room.isReadOnly(conn(null))).toBe(true)
    expect(room.isReadOnly(conn({}))).toBe(true)
    expect(room.isReadOnly(conn({ role: 'edit' }))).toBe(false)
    room.handleMessage(conn(null), updateMsg())
    expect(room.droppedWrites).toBe(1)
  })
})

function fakeStorage(init: Record<string, unknown> = {}) {
  const m = new Map<string, unknown>(Object.entries(init))
  return {
    m,
    get: async (k: string) => m.get(k),
    put: async (k: string, v: unknown) => void m.set(k, v),
    delete: async (k: string) => m.delete(k),
    list: async (o: { prefix?: string } = {}) =>
      new Map([...m].filter(([k]) => k.startsWith(o.prefix ?? ''))),
    deleteAll: async () => void m.clear(),
  }
}
function makePurgeRoom(storage = fakeStorage(), conns: Array<ReturnType<typeof fakeConn>> = []) {
  const room = makeRoom()
  Object.defineProperty(room, 'ctx', { value: { storage } })
  ;(room as unknown as { getConnections: () => unknown[] }).getConnections = () => conns
  ;(room as unknown as { queue: Promise<unknown> }).queue = Promise.resolve()
  ;(room as unknown as { stats: unknown }).stats = { updates: 0, bytes: 0 }
  return room
}
function fakeConn() {
  return { id: 'c', state: { role: 'edit' }, close: vi.fn(), setState: vi.fn(), send: () => undefined }
}
const ctxReq = () => ({ request: new Request('http://x/', { headers: { 'x-mdr-role': 'edit' } }) }) as never

describe('DocRoom.purge', () => {
  it('closes open connections with 4410 and leaves only the tombstone', async () => {
    const st = fakeStorage({ 'u:1': 'a', snap: 'b' })
    const c1 = fakeConn()
    const c2 = fakeConn()
    const room = makePurgeRoom(st, [c1, c2])
    await room.purge()
    expect(c1.close).toHaveBeenCalledWith(4410, 'deleted')
    expect(c2.close).toHaveBeenCalledWith(4410, 'deleted')
    expect([...st.m.keys()]).toEqual(['tombstone'])
  })
  it('closes new connections after purge', async () => {
    const room = makePurgeRoom()
    await room.purge()
    const c = fakeConn()
    room.onConnect(c as never, ctxReq())
    expect(c.close).toHaveBeenCalledWith(4410, 'deleted')
    expect(c.setState).not.toHaveBeenCalled()
  })
  it('ignores messages after purge', async () => {
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    await room.purge()
    const spy = spyOnSuper(false)
    room.handleMessage(conn({ role: 'edit' }), updateMsg())
    room.handleMessage(conn({ role: 'edit' }), 'str')
    expect(spy).not.toHaveBeenCalled()
    expect([...st.m.keys()]).toEqual(['tombstone'])
    spy.mockRestore()
  })
  it('returns 410 for snapshot after purge and 204 for internal purge request', async () => {
    const st = fakeStorage({ 'u:1': 'a' })
    const room = makePurgeRoom(st)
    const r = await room.onRequest(
      new Request('http://x/parties/doc-room/r/purge', { method: 'POST', headers: { 'x-mdr-internal': '1' } }),
    )
    expect(r.status).toBe(204)
    expect([...st.m.keys()]).toEqual(['tombstone'])
    const s = await room.onRequest(
      new Request('http://x/parties/doc-room/r/snapshot', { headers: { 'x-mdr-internal': '1' } }),
    )
    expect(s.status).toBe(410)
  })
  it('a new DocRoom on tombstoned storage is purged', async () => {
    const st = fakeStorage({ tombstone: 1 })
    const room = makePurgeRoom(st)
    await room.onLoad()
    expect(room.document.getText('t').toString()).toBe('')
    const c = fakeConn()
    room.onConnect(c as never, ctxReq())
    expect(c.close).toHaveBeenCalledWith(4410, 'deleted')
  })
})
