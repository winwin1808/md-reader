import { routePartykitRequest } from 'partyserver'
import type { Env } from './env.js'

export { DocRoom } from './room.js'

interface Deps {
  routeParty: (req: Request, env: Env) => Promise<Response | null>
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

  if (url.pathname === '/api/health') return json({ ok: true })

  if (url.pathname.startsWith('/parties/')) {
    const [, , party] = url.pathname.split('/')
    if (party !== 'doc-room') return json({ error: 'not found' }, 404)
    if (!url.searchParams.get('token')) return json({ error: 'token required' }, 401)
    // 8a2 sẽ resolve token → role thật; tạm thời forward với role 'edit'.
    const req2 = new Request(req)
    req2.headers.delete('x-mdr-role')
    req2.headers.set('x-mdr-role', 'edit')
    const res = await deps.routeParty(req2, env)
    return res ?? json({ error: 'not found' }, 404)
  }

  return json({ error: 'not found' }, 404)
}

export default { fetch: (req: Request, env: Env) => handleRequest(req, env) }
