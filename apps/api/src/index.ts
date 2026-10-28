import { routePartykitRequest } from 'partyserver'
import type { Env } from './env.js'
import { D1LimitStore, dayOf, ROOM_TTL_MS, CLEANUP_MAX_ROOMS, type LimitStore } from './limits.js'
import { authorizeWs, deleteRoomEverywhere, handleApi, safeDecode } from './api.js'
import { D1ModerationStore } from './moderation.js'
import { D1AssetStore, type AssetStore } from './assets.js'
import { D1TokenStore } from './tokens-d1.js'
import type { TokenStore } from './tokens.js'

export { DocRoom } from './room.js'

interface Deps {
  routeParty: (req: Request, env: Env) => Promise<Response | null>
  store?: TokenStore
}

function purgeVia(deps: Deps, env: Env) {
  return (roomId: string): Promise<void> =>
    deps
      .routeParty(
        new Request(`https://do/parties/doc-room/${encodeURIComponent(roomId)}/purge`, {
          method: 'POST',
          headers: { 'x-mdr-internal': '1' },
        }),
        env,
      )
      .then((res) => {
        if (!res || !res.ok) throw new Error('purge ' + (res ? res.status : 'null'))
      })
}

const defaultDeps: Deps = {
  routeParty: (req, env) => routePartykitRequest(req, env as unknown as Record<string, unknown>),
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  headers.set('access-control-allow-origin', '*')
  headers.set('access-control-expose-headers', 'content-type, retry-after')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

export async function handleRequest(
  req: Request,
  env: Env,
  deps: Deps = defaultDeps,
  ctx?: { waitUntil(p: Promise<unknown>): void },
): Promise<Response> {
  const url = new URL(req.url)
  const store = deps.store ?? new D1TokenStore(env.DB)

  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type, x-mdr-install',
          'access-control-max-age': '86400',
        },
      })
    }
    try {
      return withCors((await handleApi(req, store, {
        assets: new D1AssetStore(env.DB),
        limits: new D1LimitStore(env.DB),
        moderation: new D1ModerationStore(env.DB),
        ...(env.ADMIN_SECRET ? { adminSecret: env.ADMIN_SECRET } : {}),
        purge: (roomId) =>
          deps
            .routeParty(
              new Request(`https://do/parties/doc-room/${encodeURIComponent(roomId)}/purge`, {
                method: 'POST',
                headers: { 'x-mdr-internal': '1' },
              }),
              env,
            )
            .then((res) => {
              if (!res || !res.ok) throw new Error('purge ' + (res ? res.status : 'null'))
            }),
        revokeLive: (roomId, prefix) =>
          deps
            .routeParty(
              new Request(`https://do/parties/doc-room/${encodeURIComponent(roomId)}/revoke`, {
                method: 'POST',
                headers: { 'x-mdr-internal': '1', 'content-type': 'application/json' },
                body: JSON.stringify({ prefix }),
              }),
              env,
            )
            .then((res) => {
              if (!res || !res.ok) throw new Error('revoke ' + (res ? res.status : 'null'))
            }),
        snapshot: (roomId) =>
          deps.routeParty(
            new Request(`https://do/parties/doc-room/${encodeURIComponent(roomId)}/snapshot`, {
              headers: { 'x-mdr-internal': '1' },
            }),
            env,
          ).then((r) => r ?? json({ error: 'not found' }, 404)),
      })) ?? json({ error: 'not found' }, 404))
    } catch {
      return withCors(json({ error: 'internal' }, 500))
    }
  }

  if (url.pathname.startsWith('/parties/')) {
    const [, , party, roomId, ...rest] = url.pathname.split('/')
    if (party !== 'doc-room' || rest.some((s) => s !== '')) return json({ error: 'not found' }, 404)
    const wantedRoom = safeDecode(roomId ?? '')
    if (wantedRoom === null) return json({ error: 'bad path' }, 400)
    const auth = await authorizeWs(req, store)
    if (auth instanceof Response) return auth
    if (wantedRoom !== auth.roomId) return json({ error: 'forbidden' }, 403)
    const touch = store.touchRoom(auth.roomId).catch(() => {})
    if (ctx) ctx.waitUntil(touch)
    const req2 = new Request(req)
    req2.headers.delete('x-mdr-internal')
    req2.headers.delete('x-mdr-prefix')
    req2.headers.delete('x-mdr-expires')
    req2.headers.set('x-mdr-role', auth.role)
    req2.headers.set('x-mdr-prefix', auth.prefix ?? '')
    req2.headers.set('x-mdr-expires', auth.expiresAt == null ? '' : String(auth.expiresAt))
    const res = await deps.routeParty(req2, env)
    return res ?? json({ error: 'not found' }, 404)
  }

  return json({ error: 'not found' }, 404)
}


export interface CleanupDeps {
  store: TokenStore
  assets?: AssetStore
  limits?: LimitStore
  purge?: (roomId: string) => Promise<void>
}

export async function runCleanup(
  d: CleanupDeps,
  now: number = Date.now(),
): Promise<{ rooms: number; failed: number; usage: number }> {
  let rooms = 0
  let failed = 0
  const tried = new Set<string>()
  while (rooms + failed < CLEANUP_MAX_ROOMS) {
    const batch = (await d.store.idleRooms(now - ROOM_TTL_MS, 25 + tried.size)).filter((id) => !tried.has(id))
    if (batch.length === 0) break
    for (const id of batch.slice(0, 25)) {
      if (rooms + failed >= CLEANUP_MAX_ROOMS) break
      tried.add(id)
      const outcome = await deleteRoomEverywhere(id, d)
      if (outcome === 'purge_failed') failed++
      else rooms++
    }
  }
  const usage = d.limits ? await d.limits.pruneUsage(dayOf(now) - 2) : 0
  console.log('cleanup', { rooms, failed, usage })
  return { rooms, failed, usage }
}

export default {
  fetch: (req: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }) =>
    handleRequest(req, env, defaultDeps, ctx),
  scheduled: (_e: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) =>
    ctx.waitUntil(
      runCleanup({
        store: new D1TokenStore(env.DB),
        assets: new D1AssetStore(env.DB),
        limits: new D1LimitStore(env.DB),
        purge: purgeVia(defaultDeps, env),
      }),
    ),
}
