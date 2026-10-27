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

interface SnapMeta {
  gen: number
  chunks: number
  bytes: number
}

async function readMeta(kv: KVLike): Promise<SnapMeta | null> {
  const raw = await kv.get('snap:meta')
  if (raw === undefined) return null
  try {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
    const m = JSON.parse(text) as Partial<SnapMeta>
    if (!Number.isInteger(m.gen) || !Number.isInteger(m.chunks) || (m.gen as number) < 0 || (m.chunks as number) <= 0) return null
    return m as SnapMeta
  } catch {
    return null
  }
}

async function readSnapshot(kv: KVLike): Promise<Uint8Array | null> {
  const meta = await readMeta(kv)
  if (!meta) return null
  const parts: Uint8Array[] = []
  for (let i = 0; i < meta.chunks; i++) {
    const key = `snap:${meta.gen}:${i}`
    const c = await kv.get(key)
    if (c === undefined) return null // thiếu khúc: bỏ snapshot
    parts.push(asBinary(key, c))
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

export async function compact(kv: KVLike, doc: Y.Doc): Promise<LogStats & { stateBytes: number }> {
  const state = Y.encodeStateAsUpdate(doc)
  const chunks = Math.max(1, Math.ceil(state.length / CHUNK_BYTES))
  const old = await readMeta(kv)
  const gen = old ? old.gen + 1 : 0
  for (let i = 0; i < chunks; i++) {
    await kv.put(`snap:${gen}:${i}`, state.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES))
  }
  // meta SAU các khúc
  await kv.put('snap:meta', JSON.stringify({ gen, chunks, bytes: state.length }))
  for (const [k] of await listUpdates(kv)) await kv.delete(k)
  const prefix = `snap:${gen}:`
  for (const k of (await kv.list({ prefix: 'snap:' })).keys()) {
    if (k !== 'snap:meta' && !k.startsWith(prefix)) await kv.delete(k)
  }
  return { updates: 0, bytes: 0, stateBytes: state.length }
}

export async function readStats(kv: KVLike): Promise<LogStats> {
  const ups = await listUpdates(kv)
  let max = -1
  for (const [k] of ups) {
    const n = Number.parseInt(k.slice(2), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return { updates: max + 1, bytes: ups.reduce((n, [, v]) => n + v.length, 0) }
}
