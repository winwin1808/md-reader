import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { YServer } from 'y-partyserver'
import { DocRoom, MAX_MESSAGE_BYTES, MAX_ROOM_BYTES } from './room'

function spyOnSuper(stub: boolean) {
  const spy = vi.spyOn(YServer.prototype as unknown as { handleMessage: (c: unknown, m: unknown) => void }, 'handleMessage')
  return stub ? spy.mockImplementation(() => undefined) : spy
}

function makeRoom(): DocRoom {
  const room = Object.create(DocRoom.prototype) as DocRoom
  room.droppedWrites = 0
  ;(room as unknown as { revoked: Set<string> }).revoked = new Set()
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

describe('DocRoom size caps (11f1)', () => {
  const closable = (state: unknown) => ({ id: 'c', state, close: vi.fn(), send: () => undefined })
  it('closes 1009 on an oversized binary message from an edit conn', () => {
    const room = makeRoom()
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, new Uint8Array(MAX_MESSAGE_BYTES + 1))
    expect(c.close).toHaveBeenCalledWith(1009, 'too large')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('closes 1009 on an oversized string message', () => {
    const room = makeRoom()
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, 'x'.repeat(MAX_MESSAGE_BYTES + 1))
    expect(c.close).toHaveBeenCalledWith(1009, 'too large')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('closes 4413 when the room is already full', () => {
    const room = makeRoom()
    ;(room as unknown as { roomBytes: number }).roomBytes = MAX_ROOM_BYTES
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, updateMsg())
    expect(c.close).toHaveBeenCalledWith(4413, 'room full')
    expect(room.droppedWrites).toBe(1)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('applies an update that merely crosses the cap when not yet full', () => {
    const room = makeRoom()
    ;(room as unknown as { roomBytes: number }).roomBytes = MAX_ROOM_BYTES - 10
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, updateMsg('x'.repeat(20)))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(c.close).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('roomBytes resets to the real state size after compact', async () => {
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    await room.onLoad()
    room.document.getText('t').insert(0, 'hello')
    ;(room as unknown as { roomBytes: number }).roomBytes = 50_000_000
    await room.onSave() // phòng rỗng + updates > 0 → compact
    const rb = (room as unknown as { roomBytes: number }).roomBytes
    expect(rb).toBe(Y.encodeStateAsUpdate(room.document).length)
  })
  it('accepts small updates while there is room', () => {
    const room = makeRoom()
    ;(room as unknown as { roomBytes: number }).roomBytes = 100
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, updateMsg())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(c.close).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('still allows step1 when the room is full', () => {
    const room = makeRoom()
    ;(room as unknown as { roomBytes: number }).roomBytes = MAX_ROOM_BYTES
    const spy = spyOnSuper(true)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, step1Msg())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(c.close).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('onLoad sets roomBytes from state and updates add to it', async () => {
    const d = new Y.Doc()
    d.getText('t').insert(0, 'hello')
    const st = fakeStorage({ snap: Y.encodeStateAsUpdate(d) })
    const room = makePurgeRoom(st)
    await room.onLoad()
    const before = (room as unknown as { roomBytes: number }).roomBytes
    room.document.getText('t').insert(0, 'more')
    expect((room as unknown as { roomBytes: number }).roomBytes).toBeGreaterThan(before)
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
    deleteAlarm: vi.fn(async function (this: { alarm: number | null }) {
      this.alarm = null
    }),
    alarm: null as number | null,
    getAlarm: async function (this: { alarm: number | null }) {
      return this.alarm
    },
    setAlarm: vi.fn(async function (this: { alarm: number | null }, t: number) {
      this.alarm = t
    }),
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
  it('purge after a queued persistUpdate leaves only the tombstone', async () => {
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    const r = room as unknown as { persistUpdate: (u: Uint8Array) => Promise<void> }
    const d = new Y.Doc()
    d.getText('t').insert(0, 'x')
    const p = r.persistUpdate(Y.encodeStateAsUpdate(d))
    await room.purge()
    await p
    expect([...st.m.keys()]).toEqual(['tombstone'])
  })
  it('onSave and last-connection close after purge keep only the tombstone', async () => {
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    ;(room as unknown as { stats: unknown }).stats = { updates: 5, bytes: 1e9 }
    await room.purge()
    await room.onSave()
    const closeSpy = vi.spyOn(YServer.prototype as unknown as { onClose: () => Promise<void> }, 'onClose').mockResolvedValue(undefined)
    await room.onClose(fakeConn() as never, 1000, '', true)
    await (room as unknown as { queue: Promise<unknown> }).queue
    closeSpy.mockRestore()
    expect([...st.m.keys()]).toEqual(['tombstone'])
  })
})

describe('DocRoom revoke (11c)', () => {
  const reqWith = (h: Record<string, string>) => ({ request: new Request('http://x/', { headers: h }) }) as never
  const revokeReq = (prefix: unknown, internal = true) =>
    new Request('http://x/parties/doc-room/r/revoke', {
      method: 'POST',
      headers: internal ? { 'x-mdr-internal': '1' } : {},
      body: JSON.stringify({ prefix }),
    })

  it('revoke closes conns with the same prefix only', async () => {
    const st = fakeStorage()
    const a = { ...fakeConn(), state: { role: 'edit', prefix: 'abc' } }
    const b = { ...fakeConn(), state: { role: 'edit', prefix: 'xyz' } }
    const room = makePurgeRoom(st, [a, b])
    const r = await room.onRequest(revokeReq('abc'))
    expect(r.status).toBe(204)
    expect(a.close).toHaveBeenCalledWith(4410, 'revoked')
    expect(b.close).not.toHaveBeenCalled()
    expect(st.m.has('revoked:abc')).toBe(true)
  })
  it('rejects bad prefix with 400', async () => {
    const room = makePurgeRoom()
    expect((await room.onRequest(revokeReq(''))).status).toBe(400)
    expect((await room.onRequest(revokeReq('x'.repeat(33)))).status).toBe(400)
    expect((await room.onRequest(revokeReq(5))).status).toBe(400)
  })
  it('onConnect with revoked prefix closes 4410', async () => {
    const room = makePurgeRoom()
    await room.onRequest(revokeReq('abc'))
    const c = fakeConn()
    room.onConnect(c as never, reqWith({ 'x-mdr-role': 'edit', 'x-mdr-prefix': 'abc' }))
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
    expect(c.setState).not.toHaveBeenCalled()
  })
  it('onConnect with past expiry closes 4410', () => {
    const room = makePurgeRoom()
    const c = fakeConn()
    room.onConnect(c as never, reqWith({ 'x-mdr-role': 'edit', 'x-mdr-expires': String(Date.now() - 1000) }))
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
  })
  it('handleMessage closes and drops when state expired', () => {
    const room = makePurgeRoom()
    const spy = spyOnSuper(false)
    const c = { ...fakeConn(), state: { role: 'edit', expiresAt: Date.now() - 1 } }
    room.handleMessage(c as never, updateMsg())
    expect(spy).not.toHaveBeenCalled()
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
    spy.mockRestore()
  })
  it('revoked set is reloaded in onLoad', async () => {
    const room = makePurgeRoom(fakeStorage({ 'revoked:abc': 1 }))
    await room.onLoad()
    const c = fakeConn()
    room.onConnect(c as never, reqWith({ 'x-mdr-role': 'edit', 'x-mdr-prefix': 'abc' }))
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
  })
  it('/revoke without x-mdr-internal does not revoke', async () => {
    const st = fakeStorage()
    const a = { ...fakeConn(), state: { role: 'edit', prefix: 'abc' } }
    const room = makePurgeRoom(st, [a])
    const r = await room.onRequest(revokeReq('abc', false))
    expect(r.status).toBe(404)
    expect(a.close).not.toHaveBeenCalled()
    expect(st.m.has('revoked:abc')).toBe(false)
  })
})

describe('DocRoom expiry alarm (11c T4)', () => {
  vi.spyOn(YServer.prototype as unknown as { onAlarm: () => Promise<void> }, 'onAlarm').mockResolvedValue(undefined)
  const reqWith = (h: Record<string, string>) => ({ request: new Request('http://x/', { headers: h }) }) as never
  const withState = (expiresAt?: number) => ({ ...fakeConn(), state: { role: 'view', expiresAt } })

  it('onAlarm closes only expired conns', async () => {
    const a = withState(Date.now() - 1)
    const b = withState(undefined)
    const room = makePurgeRoom(fakeStorage(), [a, b])
    await room.onAlarm()
    expect(a.close).toHaveBeenCalledWith(4410, 'expired')
    expect(b.close).not.toHaveBeenCalled()
  })
  it('onConnect with future expiry sets alarm; earlier existing alarm is kept', async () => {
    const sup = vi.spyOn(YServer.prototype as unknown as { onConnect: () => void }, 'onConnect').mockImplementation(() => undefined)
    const t = Date.now() + 60_000
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    room.onConnect(fakeConn() as never, reqWith({ 'x-mdr-expires': String(t) }))
    await new Promise((r) => setTimeout(r, 0))
    expect(st.setAlarm).toHaveBeenCalledWith(t)

    const st2 = fakeStorage()
    st2.alarm = t - 1000
    const room2 = makePurgeRoom(st2)
    room2.onConnect(fakeConn() as never, reqWith({ 'x-mdr-expires': String(t) }))
    await new Promise((r) => setTimeout(r, 0))
    expect(st2.setAlarm).not.toHaveBeenCalled()
    sup.mockRestore()
  })
  it('onAlarm re-arms for the earliest future expiry', async () => {
    const t1 = Date.now() + 90_000
    const t2 = Date.now() + 30_000
    const st = fakeStorage()
    const room = makePurgeRoom(st, [withState(Date.now() - 1), withState(t1), withState(t2)])
    await room.onAlarm()
    expect(st.setAlarm).toHaveBeenCalledWith(t2)
  })
  it('unparsable x-mdr-expires closes 4410', () => {
    const room = makePurgeRoom()
    const c = fakeConn()
    room.onConnect(c as never, reqWith({ 'x-mdr-expires': 'abc' }))
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
    expect(c.setState).not.toHaveBeenCalled()
  })
  it('purge deletes the alarm before deleteAll; onAlarm on a purged room does nothing', async () => {
    const a = withState(Date.now() - 1)
    const st = fakeStorage()
    const order: string[] = []
    st.deleteAlarm.mockImplementation(async () => void order.push('alarm'))
    const origDel = st.deleteAll
    st.deleteAll = async () => {
      order.push('all')
      await origDel()
    }
    const room = makePurgeRoom(st, [a])
    await room.purge()
    expect(order).toEqual(['alarm', 'all'])
    a.close.mockClear()
    await room.onAlarm()
    expect(a.close).not.toHaveBeenCalled()
    expect(st.setAlarm).not.toHaveBeenCalled()
  })
  it('purge still completes if deleteAlarm throws', async () => {
    const st = fakeStorage({ x: 1 })
    st.deleteAlarm.mockRejectedValue(new Error('boom'))
    const room = makePurgeRoom(st)
    await room.purge()
    expect(st.m.has('x')).toBe(false)
    expect(st.m.get('tombstone')).toBe(1)
  })
})
