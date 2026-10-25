export interface AssetStore {
  put(roomId: string, mime: string, bytes: Uint8Array): Promise<{ id: string; size: number }>
  get(id: string): Promise<{ mime: string; bytes: Uint8Array } | null>
  roomUsage(roomId: string): Promise<number>
}

export const CHUNK_BYTES = 1024 * 1024

function newAssetId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export class MemoryAssetStore implements AssetStore {
  private items = new Map<string, { roomId: string; mime: string; bytes: Uint8Array }>()

  async put(roomId: string, mime: string, bytes: Uint8Array) {
    const id = newAssetId()
    this.items.set(id, { roomId, mime, bytes: bytes.slice() })
    return { id, size: bytes.byteLength }
  }

  async get(id: string) {
    const a = this.items.get(id)
    return a ? { mime: a.mime, bytes: a.bytes } : null
  }

  async roomUsage(roomId: string) {
    let n = 0
    for (const a of this.items.values()) if (a.roomId === roomId) n += a.bytes.byteLength
    return n
  }
}

export class D1AssetStore implements AssetStore {
  constructor(
    private db: D1Database,
    private now: () => number = Date.now,
  ) {}

  async put(roomId: string, mime: string, bytes: Uint8Array) {
    const id = newAssetId()
    const stmts = [
      this.db
        .prepare('INSERT INTO assets (id, room_id, mime, size, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, roomId, mime, bytes.byteLength, this.now()),
    ]
    for (let i = 0, idx = 0; i < bytes.byteLength; i += CHUNK_BYTES, idx++) {
      stmts.push(
        this.db
          .prepare('INSERT INTO asset_chunks (asset_id, idx, bytes) VALUES (?, ?, ?)')
          .bind(id, idx, bytes.slice(i, i + CHUNK_BYTES)),
      )
    }
    await this.db.batch(stmts)
    return { id, size: bytes.byteLength }
  }

  async get(id: string) {
    const a = await this.db
      .prepare('SELECT mime, size FROM assets WHERE id = ?')
      .bind(id)
      .first<{ mime: string; size: number }>()
    if (!a) return null
    const res = await this.db
      .prepare('SELECT bytes FROM asset_chunks WHERE asset_id = ? ORDER BY idx')
      .bind(id)
      .all<{ bytes: ArrayBuffer | number[] | Uint8Array }>()
    const out = new Uint8Array(a.size)
    let off = 0
    for (const r of res.results) {
      const c = r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes)
      out.set(c, off)
      off += c.byteLength
    }
    return { mime: a.mime, bytes: out }
  }

  async roomUsage(roomId: string) {
    const r = await this.db
      .prepare('SELECT COALESCE(SUM(size), 0) AS n FROM assets WHERE room_id = ?')
      .bind(roomId)
      .first<{ n: number }>()
    return r?.n ?? 0
  }
}
