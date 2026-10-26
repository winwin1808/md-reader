import { describe, it, expect } from 'vitest'
import { PassThrough } from 'node:stream'
import { createServer } from 'node:net'
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { main, VERSION, isDirectRun } from './cli'

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

describe('isDirectRun', () => {
  it('true for real file and symlink, false for other or undefined', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdr-dr-'))
    const real = join(dir, 'real.js')
    const other = join(dir, 'other.js')
    const link = join(dir, 'link.js')
    writeFileSync(real, '')
    writeFileSync(other, '')
    symlinkSync(real, link)
    const url = pathToFileURL(real).href
    expect(isDirectRun(url, real)).toBe(true)
    expect(isDirectRun(url, link)).toBe(true)
    expect(isDirectRun(url, other)).toBe(false)
    expect(isDirectRun(url, undefined)).toBe(false)
  })
})

const distCli = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js')
describe('cli via symlink', () => {
  it.skipIf(!existsSync(distCli))('starts through a bin symlink and exits 0 on stdin end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdr-link-'))
    const link = join(dir, 'md-reader-mcp')
    symlinkSync(distCli, link)
    const child = spawn(process.execPath, [link], {
      env: { ...process.env, MDR_PAIR_FILE: join(dir, 'mcp.json') },
    })
    let err = ''
    const listening = new Promise<void>((res) =>
      child.stderr.on('data', (d) => {
        err += d
        if (err.includes('listening on 127.0.0.1:')) res()
      }),
    )
    const exited = new Promise<number | null>((res) => child.on('exit', (c) => res(c)))
    await Promise.race([listening, new Promise((_, rej) => setTimeout(() => rej(new Error('no listen: ' + err)), 5000))])
    child.stdin.end()
    const code = await Promise.race([exited, new Promise<string>((res) => setTimeout(() => res('timeout'), 5000))])
    if (code === 'timeout') child.kill()
    expect(code).toBe(0)
  }, 15000)
})
