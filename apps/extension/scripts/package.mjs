import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const { version } = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'))
const outDir = resolve(root, '../../docs/store')
const out = resolve(outDir, `md-reader-${version}.zip`)

if (spawnSync('zip', ['-v'], { stdio: 'ignore' }).error) {
  console.error('package: system `zip` not found; install it and retry')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })
rmSync(out, { force: true })
// Store builds must not carry `key` (dev/e2e only); stage a copy and strip it.
const stage = mkdtempSync(resolve(tmpdir(), 'md-reader-pkg-'))
cpSync(dist, stage, { recursive: true })
const m = JSON.parse(readFileSync(resolve(stage, 'manifest.json'), 'utf8'))
delete m.key
writeFileSync(resolve(stage, 'manifest.json'), JSON.stringify(m, null, 2) + '\n')
execFileSync('zip', ['-r', '-q', '-X', out, '.'], { cwd: stage, stdio: 'inherit' })
rmSync(stage, { recursive: true, force: true })
console.log('package: wrote ' + out)
