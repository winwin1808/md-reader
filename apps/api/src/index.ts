import { routePartykitRequest } from 'partyserver'
import type { Env } from './env.js'
import { D1LimitStore } from './limits.js'
import { authorizeWs, handleApi, safeDecode } from './api.js'
import { D1ModerationStore } from './moderation.js'
import { D1AssetStore } from './assets.js'
import { D1TokenStore } from './tokens-d1.js'
import type { TokenStore } from './tokens.js'

export { DocRoom } from './room.js'

interface Deps {
  routeParty: (req: Request, env: Env) => Promise<Response | null>
  store?: TokenStore
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

export async function handleRequest(req: Request, env: Env, deps: Deps = defaultDeps): Promise<Response> {
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
            .then(() => undefined),
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
            .then(() => undefined),
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

export default { fetch: (req: Request, env: Env) => handleRequest(req, env) }
