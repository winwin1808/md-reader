// Tenancy smoke against a LOCAL `wrangler dev` (D1 --local). Never point at remote.
const HOST = process.env.HOST ?? process.argv[2]
if (!HOST) {
  console.error('usage: node scripts/smoke-tenancy.mjs <http://127.0.0.1:8787>')
  process.exit(1)
}
const INSTALL_HEADER = 'x-mdr-install'
const ROOMS_PER_INSTALL = 20 // mirrors LIMITS.roomsPerInstallPerDay in src/limits.ts
const fail = (m) => { console.error('SMOKE FAIL: ' + m); process.exit(1) }
const rand = () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
// Fresh fake client IP per run so earlier runs' per-IP counters (local D1 persists) don't interfere.
const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
const base = { 'cf-connecting-ip': ip }
const createRoom = (install) =>
  fetch(HOST + '/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', ...base, ...(install ? { [INSTALL_HEADER]: install } : {}) }, body: '{}' })
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
const upload = (room, install) =>
  fetch(`${HOST}/api/rooms/${room.roomId}/assets`, { method: 'POST', headers: { 'content-type': 'image/png', authorization: `Bearer ${room.ownerToken}`, ...base, ...(install ? { [INSTALL_HEADER]: install } : {}) }, body: PNG })

try {
  // 1) rooms with / without install header
  let r = await createRoom(null)
  if (r.status !== 201) fail(`room without install -> ${r.status}`)
  const roomA = await r.json()
  const inst = rand()
  r = await createRoom(inst)
  if (r.status !== 201) fail(`room with install -> ${r.status}`)
  const roomB = await r.json()
  console.log('1) create room: no-install 201, install 201')

  // 2) asset upload with / without install header
  r = await upload(roomA, null)
  if (r.status !== 201) fail(`asset (no install hdr) -> ${r.status}`)
  r = await upload(roomB, inst)
  if (r.status !== 201) fail(`asset (install hdr) -> ${r.status}`)
  r = await upload(roomB, null)
  if (r.status !== 201) fail(`asset (room of install, no hdr) -> ${r.status}`)
  console.log('2) asset upload: 201 with and without install header')

  // 3) hit per-install limit with a fresh key
  const key = rand()
  let made = 0, hit = null
  const ids = []
  for (let i = 0; i < ROOMS_PER_INSTALL + 1; i++) {
    const x = await createRoom(key)
    if (x.status === 429) { hit = x; break }
    if (x.status !== 201) fail(`loop create -> ${x.status}`)
    ids.push(await x.json())
    made++
  }
  if (!hit) fail(`no 429 after ${made} rooms for one install`)
  const body = await hit.json()
  if (!hit.headers.get('retry-after')) fail('429 missing retry-after')
  if (body.error !== 'RATE_LIMITED') fail('429 body error=' + JSON.stringify(body))
  console.log(`3) 429 after ${made} rooms (limit ${ROOMS_PER_INSTALL}/install/day; per-IP limit 50 not reached, fake IP ${ip}) retry-after=${hit.headers.get('retry-after')} body=${JSON.stringify(body)}`)

  // 4) delete, then resolve -> 404/410; recreate
  const link = await (await fetch(`${HOST}/api/rooms/${roomB.roomId}/links`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${roomB.ownerToken}` }, body: JSON.stringify({ role: 'view', expiresIn: null }) })).json()
  if (!link.token) fail('no link token')
  r = await fetch(`${HOST}/api/s/${link.token}`)
  if (r.status !== 200) fail(`resolve before delete -> ${r.status}`)
  r = await fetch(`${HOST}/api/rooms/${roomB.roomId}`, { method: 'DELETE', headers: { authorization: `Bearer ${roomB.ownerToken}` } })
  if (r.status < 200 || r.status > 299) fail(`delete -> ${r.status}`)
  r = await fetch(`${HOST}/api/s/${link.token}`)
  if (r.status !== 404 && r.status !== 410) fail(`resolve after delete -> ${r.status}`)
  console.log(`4) delete 2xx; resolve after delete -> ${r.status}`)
  // delete a room of the capped install, then recreate: counter is per-day creations, so still 429 is expected
  const d = await fetch(`${HOST}/api/rooms/${ids[0].roomId}`, { method: 'DELETE', headers: { authorization: `Bearer ${ids[0].ownerToken}` } })
  const again = await createRoom(key)
  console.log(`   capped install: delete ${d.status}, recreate -> ${again.status} (informational)`)
  console.log('SMOKE TENANCY OK')
  process.exit(0)
} catch (e) {
  fail(String(e?.message ?? e))
}
