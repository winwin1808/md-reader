import { describe, expect, it, vi } from 'vitest'
import { handleRequest } from './index.js'
import type { Env } from './env.js'

const env = {} as Env
const ok = () => Promise.resolve(new Response('party', { status: 200 }))

describe('handleRequest', () => {
  it('health returns 200 ok', async () => {
    const res = await handleRequest(new Request('http://x/api/health'), env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects room without token before touching the DO', async () => {
    const routeParty = vi.fn(ok)
    const res = await handleRequest(new Request('http://x/parties/doc-room/r1'), env, { routeParty })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'token required' })
    expect(routeParty).not.toHaveBeenCalled()
  })

  it.each([undefined, 'edit', 'view'])('overwrites x-mdr-role (client sent %s)', async (sent) => {
    const routeParty = vi.fn(ok)
    const headers: Record<string, string> = {}
    if (sent) headers['x-mdr-role'] = sent
    const res = await handleRequest(
      new Request('http://x/parties/doc-room/r1?token=t', { headers }),
      env,
      { routeParty },
    )
    expect(res.status).toBe(200)
    const forwarded = (routeParty.mock.calls as unknown as [Request, Env][])[0]![0]
    expect(forwarded.headers.get('x-mdr-role')).toBe('edit')
  })

  it('404 when routeParty returns null', async () => {
    const res = await handleRequest(new Request('http://x/parties/doc-room/r1?token=t'), env, {
      routeParty: () => Promise.resolve(null),
    })
    expect(res.status).toBe(404)
  })

  it('404 for other parties and unknown paths', async () => {
    const routeParty = vi.fn(ok)
    const a = await handleRequest(new Request('http://x/parties/other/r1?token=t'), env, { routeParty })
    expect(a.status).toBe(404)
    const b = await handleRequest(new Request('http://x/nope'), env)
    expect(b.status).toBe(404)
    expect(await b.json()).toEqual({ error: 'not found' })
    expect(routeParty).not.toHaveBeenCalled()
  })
})
