import { describe, it, expect } from 'vitest'
import { PassThrough } from 'node:stream'
import { createServer } from 'node:net'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main, VERSION } from './cli'

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })
}

describe('cli main', () => {
  it('logs listening line without pairKey, keeps stdout silent, frees the port', async () => {
    const port = await freePort()
    const pairPath = join(mkdtempSync(join(tmpdir(), 'mdr-cli-')), 'pair.json')
    const stdin = new PassThrough()
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    let out = ''
    let err = ''
    stdout.on('data', (d) => (out += d))
    stderr.on('data', (d) => (err += d))
    const h = await main({ stdin, stdout, stderr, pairPath, ports: [port] })
    expect(err).toContain(`md-reader-mcp ${VERSION} listening on 127.0.0.1:${port}`)
    const raw = readFileSync(pairPath, 'utf8')
    const key = (JSON.parse(raw) as { pairKey?: string; key?: string }).pairKey ?? (JSON.parse(raw) as { key?: string }).key
    expect(typeof key).toBe('string')
    expect(err).not.toContain(key as string)
    expect(out).toBe('')
    await h.close()
    const s = createServer()
    await new Promise<void>((res, rej) => {
      s.once('error', rej)
      s.listen(port, '127.0.0.1', () => s.close(() => res()))
    })
  })
})
