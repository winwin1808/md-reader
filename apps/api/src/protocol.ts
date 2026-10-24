import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'

export type MessageKind = 'step1' | 'step2' | 'update' | 'awareness' | 'other'

export function classifyMessage(buf: Uint8Array): MessageKind {
  try {
    const d = decoding.createDecoder(buf)
    const outer = decoding.readVarUint(d)
    if (outer === 1) return 'awareness'
    if (outer !== 0) return 'other'
    const inner = decoding.readVarUint(d)
    return inner === 0 ? 'step1' : inner === 1 ? 'step2' : inner === 2 ? 'update' : 'other'
  } catch {
    return 'other'
  }
}

export const PEER_COLOR_RE = /^var\(--peer-[1-6]\)$/

export function sanitizeUser(user: unknown): { name: string; color: string; colorLight: string } | null {
  if (typeof user !== 'object' || user === null || Array.isArray(user)) return null
  const u = user as Record<string, unknown>
  let name = typeof u.name === 'string' ? u.name.trim().slice(0, 40) : ''
  if (!name) name = 'Ẩn danh'
  const color = typeof u.color === 'string' && PEER_COLOR_RE.test(u.color) ? u.color : 'var(--peer-1)'
  return { name, color, colorLight: `color-mix(in srgb, ${color} 20%, transparent)` }
}

export const MAX_AWARENESS_BYTES = 16 * 1024
const MAX_CURSOR_CHARS = 1024

function cursorOk(c: unknown): boolean {
  if (c === null) return true
  if (typeof c !== 'object' || Array.isArray(c)) return false
  try {
    return JSON.stringify(c).length <= MAX_CURSOR_CHARS
  } catch {
    return false
  }
}

export function sanitizeAwarenessMessage(buf: Uint8Array): Uint8Array | null {
  if (buf.length > MAX_AWARENESS_BYTES) return null
  try {
    const d = decoding.createDecoder(buf)
    if (decoding.readVarUint(d) !== 1) return null
    const upd = decoding.createDecoder(decoding.readVarUint8Array(d))
    const len = decoding.readVarUint(upd)
    const entries: Array<[number, number, string]> = []
    for (let i = 0; i < len; i++) {
      const id = decoding.readVarUint(upd)
      const clock = decoding.readVarUint(upd)
      const raw = decoding.readVarString(upd)
      if (raw === 'null') {
        entries.push([id, clock, raw])
        continue
      }
      let state: unknown
      try {
        state = JSON.parse(raw)
      } catch {
        continue
      }
      if (typeof state !== 'object' || state === null || Array.isArray(state)) continue
      const s = state as Record<string, unknown>
      const out: Record<string, unknown> = {}
      const user = sanitizeUser(s.user)
      if (user) out.user = user
      if ('cursor' in s && cursorOk(s.cursor)) out.cursor = s.cursor
      entries.push([id, clock, JSON.stringify(out)])
    }
    const inner = encoding.createEncoder()
    encoding.writeVarUint(inner, entries.length)
    for (const [id, clock, st] of entries) {
      encoding.writeVarUint(inner, id)
      encoding.writeVarUint(inner, clock)
      encoding.writeVarString(inner, st)
    }
    const e = encoding.createEncoder()
    encoding.writeVarUint(e, 1)
    encoding.writeVarUint8Array(e, encoding.toUint8Array(inner))
    return encoding.toUint8Array(e)
  } catch {
    return null
  }
}
