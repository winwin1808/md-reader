import * as Y from 'yjs'

/** Reason a link-edit peer's transaction is not allowed, or null. Peers may only write `source` and their own `meta.actors` entry. */
export function peerTxViolation(tr: Y.Transaction, doc: Y.Doc): string | null {
  const source = doc.getText('source')
  const meta = doc.getMap('meta')
  const actorsRaw = meta.get('actors')
  const actors = actorsRaw instanceof Y.Map ? actorsRaw : null
  for (const [t, keys] of tr.changed) {
    const type = t as unknown
    if (type === source) continue
    if (actors && type === actors) {
      for (const k of keys) {
        if (k === null) return 'actors: unexpected change'
        const id = Number(k)
        const after = tr.afterState.get(id) ?? 0
        const before = tr.beforeState.get(id) ?? 0
        if (String(id) !== k || after <= before) return `actors: foreign key ${k}`
      }
      continue
    }
    if (type === meta) return 'meta: direct write'
    return 'forbidden type changed'
  }
  return null
}

export const MAX_CLIENT_IDS_PER_CONN = 4

type Struct = Y.Item | InstanceType<typeof Y.GC> | InstanceType<typeof Y.Skip>
type Res = { kind: 'source' | 'meta' | 'actors' | 'other'; sub: string | null } | null

export interface PeerOwnership {
  /** clientID -> link prefix that first introduced it. */
  owners: Map<number, string>
  /** clientIDs claimed by the current connection. */
  claimed: Set<number>
  prefix: string
}

const CONTENT_TYPE_REF = 7

/**
 * Pre-apply check of a Yjs update (v1) sent over a link-edit connection. Returns a reason when it must not be
 * applied, otherwise null (and records new clientID claims in `own`). Anything that cannot be resolved is a violation.
 */
export function peerUpdateViolation(update: Uint8Array, doc: Y.Doc, own: PeerOwnership): string | null {
  try {
    return check(update, doc, own)
  } catch {
    return 'undecodable update'
  }
}

function check(update: Uint8Array, doc: Y.Doc, own: PeerOwnership): string | null {
  const { structs, ds } = Y.decodeUpdate(update)
  const byClient = new Map<number, Struct[]>()
  for (const s of structs as Struct[]) {
    const a = byClient.get(s.id.client)
    if (a) a.push(s)
    else byClient.set(s.id.client, [s])
  }
  for (const a of byClient.values()) a.sort((x, y) => x.id.clock - y.id.clock)

  // --- clientID ownership
  const fresh: number[] = []
  for (const [c, a] of byClient) {
    if (own.owners.get(c) === own.prefix) continue
    if (own.owners.has(c) || Y.getState(doc.store, c) > 0) return `foreign clientID ${c}`
    if ((a[0] as Struct).id.clock !== 0) return `clientID ${c} does not start at clock 0`
    fresh.push(c)
  }
  if (own.claimed.size + fresh.length > MAX_CLIENT_IDS_PER_CONN) return 'too many clientIDs'
  const owns = (c: number) => own.owners.get(c) === own.prefix || fresh.includes(c)

  // --- struct lookup (update first, then server doc)
  const find = (client: number, clock: number): Struct | null => {
    const a = byClient.get(client)
    if (a) {
      let lo = 0
      let hi = a.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const s = a[mid] as Struct
        if (clock < s.id.clock) hi = mid - 1
        else if (clock >= s.id.clock + s.length) lo = mid + 1
        else return s
      }
    }
    if (clock < Y.getState(doc.store, client)) return Y.getItem(doc.store, Y.createID(client, clock)) as Struct
    return null
  }

  const memo = new Map<Struct, Res>()
  const rootKind = (name: string): 'source' | 'meta' | 'other' => (name === 'source' ? 'source' : name === 'meta' ? 'meta' : 'other')
  const containerOf = (s: Struct): 'source' | 'meta' | 'actors' | 'other' | null => {
    // kind of the type held by item s
    if (!(s instanceof Y.Item) || s.content.getRef() !== CONTENT_TYPE_REF) return null
    const r = resolve(s)
    if (!r) return null
    return r.kind === 'meta' && r.sub === 'actors' ? 'actors' : 'other'
  }
  const direct = (item: Y.Item): Res => {
    const p = item.parent as unknown
    let kind: 'source' | 'meta' | 'actors' | 'other' | null
    if (typeof p === 'string') kind = rootKind(p)
    else if (p instanceof Y.ID) {
      const ps = find(p.client, p.clock)
      kind = ps ? containerOf(ps) : null
    } else if (p instanceof Y.AbstractType) {
      const pi = (p as unknown as { _item: Y.Item | null })._item
      if (pi) kind = containerOf(pi)
      else {
        let name: string | null = null
        for (const [k, v] of doc.share) if (v === p) name = k
        kind = name === null ? null : rootKind(name)
      }
    } else kind = null
    return kind === null ? null : { kind, sub: item.parentSub }
  }
  const resolve = (start: Struct): Res => {
    const chain: Struct[] = []
    let cur: Struct | null = start
    let res: Res = null
    while (cur) {
      if (memo.has(cur)) {
        res = memo.get(cur) as Res
        break
      }
      if (!(cur instanceof Y.Item)) break
      chain.push(cur)
      if (cur.parent !== null) {
        res = direct(cur)
        break
      }
      const ref: { client: number; clock: number } | null = cur.origin ?? cur.rightOrigin
      cur = ref ? find(ref.client, ref.clock) : null
    }
    for (const c of chain) memo.set(c, res)
    return res
  }

  for (const s of structs as Struct[]) {
    if (!(s instanceof Y.Item)) continue
    const r = resolve(s)
    if (!r) return 'unresolved parent'
    if (s.content.getRef() === CONTENT_TYPE_REF) return 'nested type'
    if (r.kind === 'source') continue
    if (r.kind === 'actors' && r.sub === String(s.id.client) && owns(s.id.client)) continue
    return `forbidden ${r.kind}${r.sub !== null ? '.' + r.sub : ''}`
  }

  for (const [client, ranges] of ds.clients) {
    for (const { clock, len } of ranges) {
      const end = clock + len
      let at = clock
      while (at < end) {
        const s = find(client, at)
        if (!s) return 'delete of unknown struct'
        at = s.id.clock + s.length
        if (!(s instanceof Y.Item)) {
          if (s instanceof Y.Skip) return 'delete of unknown struct'
          continue // GC: already deleted
        }
        const r = resolve(s)
        if (!r) return 'unresolved parent'
        if (r.kind === 'source') continue
        if (r.kind === 'actors' && r.sub !== null && owns(Number(r.sub)) && String(Number(r.sub)) === r.sub) continue
        return 'forbidden delete'
      }
    }
  }

  for (const c of fresh) {
    own.owners.set(c, own.prefix)
    own.claimed.add(c)
  }
  return null
}
