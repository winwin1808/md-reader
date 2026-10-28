import type { CreateLinkRequest, ResolveTokenResponse, ShareRole } from '@md-reader/core'
import { API_PATHS, ASSET_MIME, MAX_ASSET_BYTES, ROOM_ASSET_QUOTA, type UploadAssetResponse } from '@md-reader/core'
import type { AssetStore } from './assets.js'
import { MAX_REASON, adminAuthorized, type ModerationStore } from './moderation.js'
import { subjectFrom, type LimitStore, type LimitVerdict } from './limits.js'
import { RoomNotFoundError, hashToken, type ResolvedToken, type TokenStore } from './tokens.js'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function bearer(req: Request): string | null {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')
  return m ? m[1]! : null
}

async function isOwner(req: Request, store: TokenStore, roomId: string): Promise<boolean> {
  const b = bearer(req)
  return b !== null && (await store.verifyOwner(roomId, b))
}

const MAX_BODY = 4096
const utf8Len = (s: string): number => new TextEncoder().encode(s).byteLength
const MAX_EXPIRES = 10 * 365 * 86_400_000
const MAX_LABEL = 120

export function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s)
  } catch {
    return null
  }
}

function parseLinkRequest(body: unknown): CreateLinkRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (b.role !== 'view' && b.role !== 'edit') return null
  if (b.expiresIn !== null) {
    if (typeof b.expiresIn !== 'number' || !Number.isInteger(b.expiresIn)) return null
    if (b.expiresIn < 1 || b.expiresIn > MAX_EXPIRES) return null
  }
  if (b.label !== undefined && (typeof b.label !== 'string' || b.label.length > MAX_LABEL)) return null
  return { role: b.role, expiresIn: b.expiresIn, ...(b.label !== undefined ? { label: b.label } : {}) } as CreateLinkRequest
}

export interface ApiDeps {
  snapshot?: (roomId: string) => Promise<Response>
  assets?: AssetStore
  limits?: LimitStore
  purge?: (roomId: string) => Promise<void>
  revokeLive?: (roomId: string, prefix: string) => Promise<void>
  moderation?: ModerationStore
  adminSecret?: string
}

function limited(v: NonNullable<LimitVerdict>): Response {
  const res = json(v, 429)
  if (v.retryAfter !== undefined) res.headers.set('retry-after', String(v.retryAfter))
  return res
}

function sniffOk(mime: string, b: Uint8Array): boolean {
  const at = (o: number, ...v: number[]) => v.every((x, i) => b[o + i] === x)
  switch (mime) {
    case 'image/png': return at(0, 0x89, 0x50, 0x4e, 0x47)
    case 'image/jpeg': return at(0, 0xff, 0xd8, 0xff)
    case 'image/gif': return at(0, 0x47, 0x49, 0x46, 0x38)
    case 'image/webp': return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)
    default: return false
  }
}

export async function handleApi(req: Request, store: TokenStore, deps: ApiDeps = {}): Promise<Response | null> {
  const url = new URL(req.url)
  const path = url.pathname
  if (!path.startsWith('/api/')) return null
  const method = req.method

  if (path === '/api/health' && method === 'GET') return json({ ok: true })

  if (path === '/api/rooms' && method === 'POST') {
    if (!deps.limits) return json(await store.createRoom(), 201)
    const subj = await subjectFrom(req)
    const v = await deps.limits.check('room', subj)
    if (v) return limited(v)
    const room = await store.createRoom()
    await deps.limits.record('room', subj, { roomId: room.roomId })
    return json(room, 201)
  }

  if (path === '/api/report' && method === 'POST') {
    let body: unknown
    try {
      const text = await req.text()
      if (utf8Len(text) > MAX_BODY) return json({ error: 'invalid body' }, 400)
      body = JSON.parse(text)
    } catch {
      return json({ error: 'invalid body' }, 400)
    }
    const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
    const reason = typeof b.reason === 'string' ? b.reason.trim() : ''
    if (typeof b.token !== 'string' || b.token.length < 1 || b.token.length > 200 || reason.length < 1 || reason.length > MAX_REASON)
      return json({ error: 'invalid body' }, 400)
    const r = await store.resolve(b.token)
    if (!r) return json({ error: 'not found' }, 404)
    if (!deps.moderation) return json({ error: 'not available' }, 501)
    const subj = await subjectFrom(req)
    if (deps.limits) {
      const v = await deps.limits.check('report', subj)
      if (v) return limited(v)
    }
    await deps.moderation.addReport({ roomId: r.roomId, reason, ipHash: subj.ipHash })
    if (deps.limits) await deps.limits.record('report', subj, { roomId: r.roomId })
    return json({ ok: true }, 202)
  }

  if (path.startsWith('/api/admin/')) {
    if (!deps.adminSecret) return json({ error: 'not found' }, 404)
    const m = /^\/api\/admin\/rooms\/([^/]+)\/takedown$/.exec(path)
    if (m && method === 'POST') {
      if (!(await adminAuthorized(req, deps.adminSecret))) return json({ error: 'unauthorized' }, 401)
      const roomId = safeDecode(m[1]!)
      if (roomId === null) return json({ error: 'bad path' }, 400)
      const outcome = await deleteRoomEverywhere(roomId, {
        store,
        ...(deps.assets ? { assets: deps.assets } : {}),
        ...(deps.limits ? { limits: deps.limits } : {}),
        ...(deps.purge ? { purge: deps.purge } : {}),
      })
      if (outcome === 'purge_failed') return json({ error: 'PURGE_FAILED' }, 502)
      if (outcome === 'not_found') return json({ error: 'not found' }, 404)
      await deps.moderation?.addTakedown(roomId)
      return new Response(null, { status: 204 })
    }
    return json({ error: 'not found' }, 404)
  }

  const badPath = () => json({ error: 'bad path' }, 400)
  const del = /^\/api\/rooms\/([^/]+)$/.exec(path)
  if (del && method === 'DELETE') {
    const roomId = safeDecode(del[1]!)
    if (roomId === null) return badPath()
    if (!(await isOwner(req, store, roomId))) return json({ error: 'unauthorized' }, 401)
    const outcome = await deleteRoomEverywhere(roomId, {
      store,
      ...(deps.assets ? { assets: deps.assets } : {}),
      ...(deps.limits ? { limits: deps.limits } : {}),
      ...(deps.purge ? { purge: deps.purge } : {}),
    })
    if (outcome === 'purge_failed') return json({ error: 'PURGE_FAILED' }, 502)
    return outcome === 'deleted' ? new Response(null, { status: 204 }) : json({ error: 'not found' }, 404)
  }

  const links = /^\/api\/rooms\/([^/]+)\/links$/.exec(path)
  if (links) {
    const roomId = safeDecode(links[1]!)
    if (roomId === null) return badPath()
    if (method === 'GET') {
      if (!(await isOwner(req, store, roomId))) return json({ error: 'unauthorized' }, 401)
      return json(await store.listLinks(roomId))
    }
    if (method === 'POST') {
      if (!(await isOwner(req, store, roomId))) return json({ error: 'unauthorized' }, 401)
      let body: unknown
      try {
        const text = await req.text()
        if (utf8Len(text) > MAX_BODY) return json({ error: 'body too large' }, 413)
        body = JSON.parse(text)
      } catch {
        return json({ error: 'invalid body' }, 400)
      }
      const parsed = parseLinkRequest(body)
      if (!parsed) return json({ error: 'invalid body' }, 400)
      try {
        return json(await store.createLink(roomId, parsed), 201)
      } catch (e) {
        if (e instanceof RoomNotFoundError) return json({ error: 'room not found' }, 404)
        throw e
      }
    }
  }

  const all = /^\/api\/rooms\/([^/]+)\/links\/revoke-all$/.exec(path)
  if (all && method === 'POST') {
    const roomId = safeDecode(all[1]!)
    if (roomId === null) return badPath()
    if (!(await isOwner(req, store, roomId))) return json({ error: 'unauthorized' }, 401)
    const revoked = await store.revokeAll(roomId)
    forgetRoomAuth(roomId)
    try {
      const cutoff = Date.now() - 24 * 3_600_000
      const recent = (await store.listLinks(roomId)).filter((l) => l.revokedAt !== null && l.revokedAt >= cutoff)
      let failed = false
      for (let i = 0; i < recent.length; i += 10) {
        const res = await Promise.allSettled(recent.slice(i, i + 10).map((l) => deps.revokeLive?.(roomId, l.tokenPrefix)))
        if (res.some((x) => x.status === 'rejected')) failed = true
      }
      if (failed) throw new Error('revokeLive failed for some links')
    } catch (e) {
      console.error('revokeLive failed', roomId, e)
      return json({ error: 'REVOKE_LIVE_FAILED' }, 502)
    }
    return json({ revoked })
  }

  const one = /^\/api\/rooms\/([^/]+)\/links\/([^/]+)$/.exec(path)
  if (one && method === 'DELETE') {
    const roomId = safeDecode(one[1]!)
    const prefix = safeDecode(one[2]!)
    if (roomId === null || prefix === null) return badPath()
    if (!(await isOwner(req, store, roomId))) return json({ error: 'unauthorized' }, 401)
    const ok = await store.revoke(roomId, prefix)
    if (!ok) {
      // Already revoked earlier? Then treat as idempotent so a failed revokeLive can be retried.
      const known = (await store.listLinks(roomId)).some((l) => l.tokenPrefix === prefix)
      if (!known) return json({ error: 'not found' }, 404)
    }
    forgetRoomAuth(roomId)
    try {
      await deps.revokeLive?.(roomId, prefix)
    } catch (e) {
      console.error('revokeLive failed', roomId, e)
      return json({ error: 'REVOKE_LIVE_FAILED' }, 502)
    }
    return new Response(null, { status: 204 })
  }

  const up = /^\/api\/rooms\/([^/]+)\/assets$/.exec(path)
  if (up && method === 'POST') {
    const roomId = safeDecode(up[1]!)
    if (roomId === null) return badPath()
    const tok = bearer(req)
    let allowed = false
    if (tok !== null) {
      if (await store.verifyOwner(roomId, tok)) allowed = true
      else {
        const r = await store.resolve(tok)
        allowed = r !== null && r.roomId === roomId && r.role === 'edit'
      }
    }
    if (!allowed) return json({ error: 'forbidden' }, 403)
    if (!deps.assets) return json({ error: 'assets not available' }, 501)
    const mime = (req.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    if (!(ASSET_MIME as readonly string[]).includes(mime)) return json({ error: 'unsupported_type' }, 415)
    const declared = Number(req.headers.get('content-length') ?? '0')
    if (declared > MAX_ASSET_BYTES) return json({ error: 'too_large' }, 413)
    const bytes = new Uint8Array(await req.arrayBuffer())
    if (bytes.byteLength > MAX_ASSET_BYTES) return json({ error: 'too_large' }, 413)
    if (!sniffOk(mime, bytes)) return json({ error: 'unsupported_type' }, 415)
    if ((await deps.assets.roomUsage(roomId)) + bytes.byteLength > ROOM_ASSET_QUOTA) return json({ error: 'quota' }, 413)
    const subj = deps.limits ? await subjectFrom(req) : null
    if (deps.limits && subj) {
      const v = await deps.limits.check('asset', subj, { roomId, bytes: bytes.byteLength })
      if (v) return limited(v)
    }
    const { id, size } = await deps.assets.put(roomId, mime, bytes)
    if (deps.limits && subj) await deps.limits.record('asset', subj, { roomId, bytes: size })
    const out: UploadAssetResponse = { id, url: url.origin + API_PATHS.asset(id), size, mime }
    return json(out, 201)
  }

  const asset = /^\/api\/a\/([^/]+)$/.exec(path)
  if (asset && method === 'GET') {
    const id = safeDecode(asset[1]!)
    if (id === null) return badPath()
    const a = deps.assets ? await deps.assets.get(id) : null
    if (!a) return json({ error: 'not found' }, 404)
    return new Response(a.bytes, {
      status: 200,
      headers: {
        'content-type': a.mime,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'",
      },
    })
  }

  const snap = /^\/api\/s\/([^/]+)\/snapshot$/.exec(path)
  if (snap && method === 'GET') {
    const tok = safeDecode(snap[1]!)
    if (tok === null) return badPath()
    const r = await store.resolve(tok)
    if (!r) return json({ error: 'link expired or revoked' }, 410)
    if (!deps.snapshot) return json({ error: 'snapshot not available' }, 501)
    return deps.snapshot(r.roomId)
  }

  const s = /^\/api\/s\/([^/]+)$/.exec(path)
  if (s && method === 'GET') {
    const tok = safeDecode(s[1]!)
    if (tok === null) return badPath()
    const r = await store.resolve(tok)
    if (!r) return json({ error: 'link expired or revoked' }, 410)
    const body: ResolveTokenResponse = { roomId: r.roomId, role: r.role, title: null }
    return json(body)
  }

  return json({ error: 'not found' }, 404)
}

const AUTH_TTL_MS = 60_000
const authCache = new Map<string, { value: ResolvedToken | null; until: number }>()

const AUTH_CACHE_MAX = 5000

export function forgetRoomAuth(roomId: string): void {
  for (const [k, e] of authCache) if (e.value?.roomId === roomId) authCache.delete(k)
}

export function _resetAuthCache(): void {
  authCache.clear()
}

export function _authCacheSize(): number {
  return authCache.size
}

function makeRoom(t: number): void {
  if (authCache.size < AUTH_CACHE_MAX) return
  for (const [k, e] of authCache) if (e.until <= t) authCache.delete(k)
  while (authCache.size >= AUTH_CACHE_MAX) {
    const oldest = authCache.keys().next().value
    if (oldest === undefined) break
    authCache.delete(oldest)
  }
}

export async function authorizeWs(
  req: Request,
  store: TokenStore,
  now: () => number = Date.now,
): Promise<ResolvedToken | Response> {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return json({ error: 'token required' }, 401)
  const key = await hashToken(token)
  const t = now()
  let entry = authCache.get(key)
  if (!entry || entry.until <= t) {
    const value = await store.resolve(token)
    entry = { value, until: Math.min(t + AUTH_TTL_MS, value?.expiresAt ?? Infinity) }
    authCache.delete(key)
    makeRoom(t)
    authCache.set(key, entry)
  }
  return entry.value ?? json({ error: 'link expired or revoked' }, 410)
}

export type DeleteOutcome = 'deleted' | 'not_found' | 'purge_failed'

export async function deleteRoomEverywhere(
  roomId: string,
  d: { store: TokenStore; assets?: AssetStore; limits?: LimitStore; purge?: (roomId: string) => Promise<void> },
): Promise<DeleteOutcome> {
  try {
    await d.purge?.(roomId)
  } catch (e) {
    console.error('purge failed', roomId, e)
    return 'purge_failed'
  }
  try {
    await d.assets?.deleteRoom(roomId)
  } catch (e) {
    console.error('assets.deleteRoom failed', roomId, e)
    return 'purge_failed'
  }
  try {
    await d.limits?.forgetRoom(roomId)
  } catch (e) {
    console.error('limits.forgetRoom failed', roomId, e)
  }
  const ok = await d.store.deleteRoom(roomId)
  forgetRoomAuth(roomId)
  return ok ? 'deleted' : 'not_found'
}
