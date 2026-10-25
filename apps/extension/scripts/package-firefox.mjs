// Build a Firefox MV3 package from the Chrome build in dist/ -> dist-firefox/ + zip.
import { execFileSync } from 'node:child_process'
import { cpSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const out = resolve(root, 'dist-firefox')
const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'))

rmSync(out, { recursive: true, force: true })
cpSync(dist, out, { recursive: true })

// Firefox MV3 has no service_worker background; it uses an event page.
const sw = manifest.background?.service_worker
if (sw) manifest.background = { scripts: [sw], type: 'module' }
manifest.browser_specific_settings = {
  gecko: {
    id: 'md-reader@winwin1808',
    strict_min_version: '128.0',
    data_collection_permissions: { required: ['none'], optional: ['websiteContent'] },
  },
}
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

const outDir = resolve(root, '../../docs/store')
mkdirSync(outDir, { recursive: true })
const zip = resolve(outDir, `md-reader-${manifest.version}-firefox.zip`)
rmSync(zip, { force: true })
execFileSync('zip', ['-r', '-q', '-X', zip, '.'], { cwd: out, stdio: 'inherit' })
console.log('package:firefox wrote ' + zip)
