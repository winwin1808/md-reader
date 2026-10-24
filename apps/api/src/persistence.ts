import * as Y from 'yjs'

export interface KVLike {
  get(key: string): Promise<Uint8Array | string | undefined>
  put(key: string, value: Uint8Array | string): Promise<void>
  delete(key: string): Promise<boolean>
  list(opts: { prefix: string }): Promise<Map<string, Uint8Array | string>>
}

export const CHUNK_BYTES = 1_048_576
export const COMPACT_UPDATES = 200
export const COMPACT_BYTES = 262_144

export interface LogStats {
  updates: number
  bytes: number
}

function asBinary(key: string, v: Uint8Array | string): Uint8Array {
  if (v instanceof Uint8Array) return v
  throw new Error(`persistence: value at "${key}" is not a Uint8Array`)
}

async function readSnapshot(kv: KVLike): Promise<Uint8Array | null> {
  const metaRaw = await kv.get('snap:meta')
  if (metaRaw === undefined) return null
  let chunks: number
  try {
    const text = typeof metaRaw === 'string' ? metaRaw : new TextDecoder().decode(metaRaw)
    chunks = (JSON.parse(text) as { chunks: number }).chunks
  } catch {
    return null
  }
  if (!Number.isInteger(chunks) || chunks <= 0) return null
  const parts: Uint8Array[] = []
  for (let i = 0; i < chunks; i++) {
    const c = await kv.get(`snap:${i}`)
    if (c === undefined) return null // torn write: bỏ snapshot
    parts.push(asBinary(`snap:${i}`, c))
  }
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

async function listUpdates(kv: KVLike): Promise<[string, Uint8Array][]> {
  const m = await kv.list({ prefix: 'u:' })
  return [...m.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => [k, asBinary(k, v)] as [string, Uint8Array])
}

export async function loadState(kv: KVLike): Promise<Uint8Array | null> {
  const parts: Uint8Array[] = []
  const snap = await readSnapshot(kv)
  if (snap) parts.push(snap)
  for (const [, v] of await listUpdates(kv)) parts.push(v)
  if (parts.length === 0) return null
  return parts.length === 1 ? parts[0]! : Y.mergeUpdates(parts)
}

export async function appendUpdate(
  kv: KVLike,
  update: Uint8Array,
  stats: LogStats,
): Promise<LogStats> {
  const key = 'u:' + String(stats.updates).padStart(12, '0')
  await kv.put(key, update)
  return { updates: stats.updates + 1, bytes: stats.bytes + update.length }
}

export function shouldCompact(stats: LogStats, roomEmpty: boolean): boolean {
  return (
    stats.updates >= COMPACT_UPDATES ||
    stats.bytes >= COMPACT_BYTES ||
    (roomEmpty && stats.updates > 0)
  )
}

export async function compact(kv: KVLike, doc: Y.Doc): Promise<LogStats> {
  const state = Y.encodeStateAsUpdate(doc)
  const chunks = Math.max(1, Math.ceil(state.length / CHUNK_BYTES))
  let oldChunks = 0
  const oldMeta = await kv.get('snap:meta')
  if (oldMeta !== undefined) {
    try {
      const t = typeof oldMeta === 'string' ? oldMeta : new TextDecoder().decode(oldMeta)
      oldChunks = (JSON.parse(t) as { chunks: number }).chunks || 0
    } catch {
      oldChunks = 0
    }
  }
  for (let i = 0; i < chunks; i++) {
    await kv.put(`snap:${i}`, state.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES))
  }
  // meta SAU các khúc
  await kv.put('snap:meta', JSON.stringify({ chunks, bytes: state.length }))
  for (const [k] of await listUpdates(kv)) await kv.delete(k)
  for (let i = chunks; i < oldChunks; i++) await kv.delete(`snap:${i}`)
  return { updates: 0, bytes: 0 }
}

export async function readStats(kv: KVLike): Promise<LogStats> {
  const ups = await listUpdates(kv)
  return { updates: ups.length, bytes: ups.reduce((n, [, v]) => n + v.length, 0) }
}
