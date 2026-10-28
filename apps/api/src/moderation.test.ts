import { describe, it, expect, vi } from 'vitest'
import { MemoryModerationStore, D1ModerationStore, adminAuthorized } from './moderation.js'

describe('MemoryModerationStore', () => {
  it('ghi report đúng trường', async () => {
    const s = new MemoryModerationStore(() => 42)
    await s.addReport({ roomId: 'r1', reason: 'spam', ipHash: 'h' })
    expect(s.reports).toEqual([{ roomId: 'r1', reason: 'spam', ipHash: 'h', createdAt: 42 }])
  })
  it('takedown idempotent', async () => {
    const s = new MemoryModerationStore(() => 7)
    await s.addTakedown('r1')
    await s.addTakedown('r1')
    expect(s.takedowns.size).toBe(1)
    expect(s.takedowns.get('r1')).toBe(7)
  })
})

describe('D1ModerationStore', () => {
  it('đúng SQL và thứ tự tham số', async () => {
    const calls: Array<{ sql: string; args: unknown[] }> = []
    const db = {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return { run: async () => { calls.push({ sql, args }) }, sql, args }
          },
        }
      },
      async batch(stmts: Array<{ sql: string; args: unknown[] }>) {
        for (const st of stmts) calls.push({ sql: st.sql, args: st.args })
        return []
      },
    } as unknown as D1Database
    const s = new D1ModerationStore(db, () => 5)
    await s.addReport({ roomId: 'r', reason: 'x', ipHash: 'h' })
    await s.addTakedown('r')
    expect(calls[0]).toEqual({
      sql: 'INSERT INTO reports (room_id, reason, ip_hash, created_at) VALUES (?, ?, ?, ?)',
      args: ['r', 'x', 'h', 5],
    })
    expect(calls[1]).toEqual({
      sql: 'INSERT OR IGNORE INTO takedowns (room_id, created_at) VALUES (?, ?)',
      args: ['r', 5],
    })
  })
})

describe('D1ModerationStore atomic takedown (15a)', () => {
  it('addTakedown goes through db.batch, never a bare run()', async () => {
    const batch = vi.fn(async () => { throw new Error('mid-batch') })
    const run = vi.fn(async () => {})
    const db = {
      prepare: () => ({ bind: () => ({ run }) }),
      batch,
    } as unknown as D1Database
    const s = new D1ModerationStore(db, () => 5)
    await expect(s.addTakedown('r')).rejects.toThrow('mid-batch')
    expect(batch).toHaveBeenCalledTimes(1)
    expect(run).not.toHaveBeenCalled()
  })
})

describe('adminAuthorized', () => {
  const req = (h?: string) => new Request('http://x/', h ? { headers: { authorization: h } } : {})
  it('đúng secret', async () => expect(await adminAuthorized(req('Bearer s3'), 's3')).toBe(true))
  it('sai secret', async () => expect(await adminAuthorized(req('Bearer nope'), 's3')).toBe(false))
  it('thiếu header', async () => expect(await adminAuthorized(req(), 's3')).toBe(false))
  it('secret vắng/rỗng', async () => {
    expect(await adminAuthorized(req('Bearer '), undefined)).toBe(false)
    expect(await adminAuthorized(req('Bearer '), '')).toBe(false)
    expect(await adminAuthorized(req('Bearer x'), '')).toBe(false)
  })
})
