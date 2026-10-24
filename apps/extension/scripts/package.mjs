import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
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
execFileSync('zip', ['-r', '-q', '-X', out, '.'], { cwd: dist, stdio: 'inherit' })
console.log('package: wrote ' + out)
