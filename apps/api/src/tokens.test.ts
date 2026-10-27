import { describe, it, expect } from 'vitest'
import { MemoryTokenStore, RoomNotFoundError, hashToken, newToken } from './tokens.js'

describe('tokens', () => {
  it('hashToken sha256 hex', async () => {
    expect(await hashToken('a')).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb')
  })
  it('newToken', () => {
    const t = newToken()
    expect(t).toHaveLength(43)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(newToken()).not.toBe(t)
  })
  it('owner token resolves to edit', async () => {
    const s = new MemoryTokenStore(() => 1000)
    const { roomId, ownerToken } = await s.createRoom()
    expect(await s.verifyOwner(roomId, ownerToken)).toBe(true)
    expect(await s.verifyOwner(roomId, 'x')).toBe(false)
    expect(await s.resolve(ownerToken)).toEqual({ roomId, role: 'edit', expiresAt: null })
    expect((await s.resolve(ownerToken))!.prefix).toBeUndefined()
  })
  it('link expiry and revoke', async () => {
    let now = 1000
    const s = new MemoryTokenStore(() => now)
    const { roomId } = await s.createRoom()
    const l = await s.createLink(roomId, { role: 'view', expiresIn: 30 * 86400000 })
    expect(l.expiresAt).toBe(1000 + 30 * 86400000)
    expect(await s.resolve(l.token)).toEqual({
      roomId,
      role: 'view',
      prefix: l.tokenPrefix,
      expiresAt: 1000 + 30 * 86400000,
    })
    now = l.expiresAt!
    expect(await s.resolve(l.token)).toBeNull()
    now = 2000
    const l2 = await s.createLink(roomId, { role: 'edit', expiresIn: null })
    expect(l2.expiresAt).toBeNull()
    expect(await s.revoke(roomId, l2.tokenPrefix)).toBe(true)
    expect(await s.resolve(l2.token)).toBeNull()
    expect(await s.revoke(roomId, l2.tokenPrefix)).toBe(false)
  })
  it('unknown room throws', async () => {
    const s = new MemoryTokenStore()
    await expect(s.createLink('nope', { role: 'view', expiresIn: null })).rejects.toBeInstanceOf(RoomNotFoundError)
  })
  it('listLinks hides token, newest first', async () => {
    let now = 1
    const s = new MemoryTokenStore(() => now)
    const { roomId } = await s.createRoom()
    const a = await s.createLink(roomId, { role: 'view', expiresIn: null, label: 'a' })
    now = 2
    const b = await s.createLink(roomId, { role: 'view', expiresIn: null, label: 'b' })
    const list = await s.listLinks(roomId)
    expect(list.map((x) => x.tokenPrefix)).toEqual([b.tokenPrefix, a.tokenPrefix])
    expect(list.every((x) => x.token === '')).toBe(true)
  })
  it('deleteRoom removes room and links only for that room', async () => {
    const s = new MemoryTokenStore()
    const { roomId, ownerToken } = await s.createRoom()
    const v = await s.createLink(roomId, { role: 'view', expiresIn: null })
    await s.createLink(roomId, { role: 'edit', expiresIn: null })
    const other = await s.createRoom()
    const ol = await s.createLink(other.roomId, { role: 'view', expiresIn: null })
    expect(await s.deleteRoom(roomId)).toBe(true)
    expect(await s.resolve(ownerToken)).toBeNull()
    expect(await s.resolve(v.token)).toBeNull()
    expect(await s.listLinks(roomId)).toEqual([])
    expect(await s.verifyOwner(roomId, ownerToken)).toBe(false)
    expect(await s.deleteRoom(roomId)).toBe(false)
    expect(await s.resolve(ol.token)).toEqual({
      roomId: other.roomId,
      role: 'view',
      prefix: ol.tokenPrefix,
      expiresAt: null,
    })
  })
})
