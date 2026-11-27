#!/usr/bin/env node
// Compare a translated catalog area against the source catalog (en).
// Usage: node scripts/i18n-keys.mjs <locale> [area ...]
//   areas default to every file in packages/ui/src/i18n/catalog.
// Prints missing / extra keys and placeholder mismatches per area; exits 1 if any.
// Translations live in packages/ui/src/i18n/locales/<locale>/<area>.ts and export `const <locale>`.
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages/ui/src/i18n')
const [locale, ...areaArgs] = process.argv.slice(2)
if (!locale) {
  console.error('usage: node scripts/i18n-keys.mjs <locale> [area ...]')
  process.exit(2)
}
const areas = areaArgs.length
  ? areaArgs
  : readdirSync(join(root, 'catalog')).filter((f) => f.endsWith('.ts') && !f.includes('.test.')).map((f) => f.replace(/\.ts$/, ''))

/** Placeholder signature: sorted `{name}` names plus plural `{name|...}` names. */
function placeholders(s) {
  const names = []
  for (const m of String(s).matchAll(/\{(\w+)(\|[^}]*)?\}/g)) names.push(m[2] ? `${m[1]}|` : m[1])
  return names.sort().join(',')
}

let bad = 0
for (const area of areas) {
  const src = await import(pathToFileURL(join(root, 'catalog', `${area}.ts`)).href)
  const file = join(root, 'locales', locale, `${area}.ts`)
  if (!existsSync(file)) {
    console.log(`${area}: missing file locales/${locale}/${area}.ts (${Object.keys(src.en).length} keys)`)
    bad++
    continue
  }
  const tr = (await import(pathToFileURL(file).href))[locale] ?? {}
  const want = Object.keys(src.en)
  const missing = want.filter((k) => !(k in tr))
  const extra = Object.keys(tr).filter((k) => !(k in src.en))
  const empty = want.filter((k) => k in tr && String(tr[k]).trim() === '')
  const ph = want.filter((k) => k in tr && placeholders(tr[k]) !== placeholders(src.en[k]))
  const same = want.filter((k) => k in tr && tr[k] === src.en[k])
  console.log(`${area}: ${want.length} keys · missing ${missing.length} · extra ${extra.length} · empty ${empty.length} · placeholder ${ph.length} · identical-to-en ${same.length}`)
  for (const k of missing) console.log(`  missing     ${k}`)
  for (const k of extra) console.log(`  extra       ${k}`)
  for (const k of empty) console.log(`  empty       ${k}`)
  for (const k of ph) console.log(`  placeholder ${k}: en "${src.en[k]}" vs "${tr[k]}"`)
  if (missing.length || extra.length || empty.length || ph.length) bad++
}
process.exit(bad ? 1 : 0)
