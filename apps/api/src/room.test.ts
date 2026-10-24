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
