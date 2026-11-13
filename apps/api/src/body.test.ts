import { describe, expect, it } from 'vitest'
import { readCapped } from './body.js'

function counting(chunk: number, count: number) {
  const s = { pulls: 0, cancelled: false }
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        s.pulls++
        if (s.pulls > count) return c.close()
        c.enqueue(new Uint8Array(chunk).fill(1))
      },
      cancel() {
        s.cancelled = true
      },
    },
    { highWaterMark: 0 },
  )
  return { s, stream }
}
const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('http://x/', { method: 'POST', body, headers, duplex: 'half' } as RequestInit)

describe('readCapped', () => {
  it('cancels a streamed over-cap body early', async () => {
    const { s, stream } = counting(100, 10_000)
    expect(await readCapped(post(stream), 250)).toBeNull()
    expect(s.cancelled).toBe(true)
    expect(s.pulls).toBeLessThan(20)
  })
  it('rejects declared content-length > max without reading', async () => {
    const { s, stream } = counting(10, 5)
    expect(await readCapped(post(stream, { 'content-length': '999' }), 100)).toBeNull()
    expect(s.pulls).toBe(0)
  })
  it('returns exact bytes when within cap', async () => {
    const out = await readCapped(post(new Uint8Array([1, 2, 3, 4])), 4)
    expect(Array.from(out!)).toEqual([1, 2, 3, 4])
  })
  it('returns empty for no body', async () => {
    const out = await readCapped(new Request('http://x/', { method: 'POST' }), 10)
    expect(out!.byteLength).toBe(0)
  })
})
