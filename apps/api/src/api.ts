import type { CreateLinkRequest, ResolveTokenResponse, ShareRole } from '@md-reader/core'
import { RoomNotFoundError, hashToken, type TokenStore } from './tokens.js'

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

function parseLinkRequest(body: unknown): CreateLinkRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (b.role !== 'view' && b.role !== 'edit') return null
  if (b.expiresIn !== null && typeof b.expiresIn !== 'number') return null
  if (b.label !== undefined && typeof b.label !== 'string') return null
  return { role: b.role, expiresIn: b.expiresIn, ...(b.label !== undefined ? { label: b.label } : {}) } as CreateLinkRequest
}

export async function handleApi(req: Request, store: TokenStore): Promise<Response | null> {
  const url = new URL(req.url)
  const path = url.pathname
  if (!path.startsWith('/api/')) return null
  const method = req.method

  if (path === '/api/health' && method === 'GET') return json({ ok: true })

  if (path === '/api/rooms' && method === 'POST') return json(await store.createRoom(), 201)

  const links = /^\/api\/rooms\/([^/]+)\/links$/.exec(path)
  if (links) {
    const roomId = decodeURIComponent(links[1]!)
    if (method === 'GET') {
      if (!(await isOwner(req, store, roomId))) return json({ error: 'unauthorized' }, 401)
      return json(await store.listLinks(roomId))
    }
    if (method === 'POST') {
      if (!(await isOwner(req, store, roomId))) return json({ error: 'unauthorized' }, 401)
      let body: unknown
      try {
        body = await req.json()
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

  const one = /^\/api\/rooms\/([^/]+)\/links\/([^/]+)$/.exec(path)
  if (one && method === 'DELETE') {
    const roomId = decodeURIComponent(one[1]!)
    if (!(await isOwner(req, store, roomId))) return json({ error: 'unauthorized' }, 401)
    const ok = await store.revoke(roomId, decodeURIComponent(one[2]!))
    return ok ? new Response(null, { status: 204 }) : json({ error: 'not found' }, 404)
  }

  const s = /^\/api\/s\/([^/]+)$/.exec(path)
  if (s && method === 'GET') {
    const r = await store.resolve(decodeURIComponent(s[1]!))
    if (!r) return json({ error: 'link expired or revoked' }, 410)
    const body: ResolveTokenResponse = { roomId: r.roomId, role: r.role, title: null }
    return json(body)
  }

  return json({ error: 'not found' }, 404)
}

const AUTH_TTL_MS = 60_000
const authCache = new Map<string, { value: { roomId: string; role: ShareRole } | null; until: number }>()

export function _resetAuthCache(): void {
  authCache.clear()
}

export async function authorizeWs(
  req: Request,
  store: TokenStore,
  now: () => number = Date.now,
): Promise<{ roomId: string; role: ShareRole } | Response> {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return json({ error: 'token required' }, 401)
  const key = await hashToken(token)
  const t = now()
  let entry = authCache.get(key)
  if (!entry || entry.until <= t) {
    entry = { value: await store.resolve(token), until: t + AUTH_TTL_MS }
    authCache.set(key, entry)
  }
  return entry.value ?? json({ error: 'link expired or revoked' }, 410)
}
