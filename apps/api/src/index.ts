import { routePartykitRequest } from 'partyserver'
import type { Env } from './env.js'
import { authorizeWs, handleApi, safeDecode } from './api.js'
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

export async function handleRequest(req: Request, env: Env, deps: Deps = defaultDeps): Promise<Response> {
  const url = new URL(req.url)
  const store = deps.store ?? new D1TokenStore(env.DB)

  if (url.pathname.startsWith('/api/')) {
    return (await handleApi(req, store)) ?? json({ error: 'not found' }, 404)
  }

  if (url.pathname.startsWith('/parties/')) {
    const [, , party, roomId] = url.pathname.split('/')
    if (party !== 'doc-room') return json({ error: 'not found' }, 404)
    const wantedRoom = safeDecode(roomId ?? '')
    if (wantedRoom === null) return json({ error: 'bad path' }, 400)
    const auth = await authorizeWs(req, store)
    if (auth instanceof Response) return auth
    if (wantedRoom !== auth.roomId) return json({ error: 'forbidden' }, 403)
    const req2 = new Request(req)
    req2.headers.set('x-mdr-role', auth.role)
    const res = await deps.routeParty(req2, env)
    return res ?? json({ error: 'not found' }, 404)
  }

  return json({ error: 'not found' }, 404)
}

export default { fetch: (req: Request, env: Env) => handleRequest(req, env) }
