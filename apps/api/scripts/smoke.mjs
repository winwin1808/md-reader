import WebSocket from 'ws'
import * as Y from 'yjs'
import YProvider from 'y-partyserver/provider'

const HOST = process.env.HOST ?? process.argv[2]
if (!HOST) {
  console.error('usage: node scripts/smoke.mjs <https://your-worker.workers.dev>')
  process.exit(1)
}
const wsHost = HOST.replace(/^https?:\/\//, '')
const fail = (m) => { console.error('SMOKE FAIL: ' + m); process.exit(1) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const post = async (path, body, headers = {}) => {
  const r = await fetch(HOST + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  if (!r.ok) fail(`POST ${path} -> ${r.status}`)
  return r.json()
}
const connect = (roomId, token, doc) =>
  new Promise((resolve, reject) => {
    const p = new YProvider(wsHost, roomId, doc, { party: 'doc-room', params: { token }, WebSocketPolyfill: WebSocket })
    const t = setTimeout(() => reject(new Error('synced timeout')), 15000)
    p.on('synced', () => { clearTimeout(t); resolve(p) })
  })

try {
  const room = await post('/api/rooms', {})
  console.log('roomId', room.roomId)
  const link = await post(`/api/rooms/${room.roomId}/links`, { role: 'edit', expiresIn: null }, { authorization: `Bearer ${room.ownerToken}` })
  const token = link.token
  if (!token) fail('no link token')

  const marker = 'persist-' + Date.now()
  const d1 = new Y.Doc()
  const p1 = await connect(room.roomId, token, d1)
  d1.getText('source').insert(0, marker)
  await sleep(3000)
  p1.destroy()

  const r = await fetch(`${HOST}/api/s/${token}/snapshot`)
  if (r.status !== 200) fail(`snapshot status ${r.status}`)
  const d2 = new Y.Doc()
  Y.applyUpdate(d2, new Uint8Array(await r.arrayBuffer()))
  if (!d2.getText('source').toString().includes(marker)) fail('snapshot missing marker')

  const d3 = new Y.Doc()
  const p3 = await connect(room.roomId, token, d3)
  if (!d3.getText('source').toString().includes(marker)) fail('second client missing marker')
  p3.destroy()
  const pngBytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
  const up = await fetch(`${HOST}/api/rooms/${room.roomId}/assets`, { method: 'POST', headers: { 'content-type': 'image/png', authorization: `Bearer ${room.ownerToken}` }, body: pngBytes })
  if (up.status !== 201) fail(`asset upload ${up.status}`)
  const asset = await up.json()
  const got = await fetch(asset.url)
  if (got.status !== 200) fail(`asset get ${got.status}`)
  if (!(got.headers.get('content-type') ?? '').startsWith('image/png')) fail('asset content-type')
  const gb = new Uint8Array(await got.arrayBuffer())
  if (gb.length !== pngBytes.length || gb.some((b, i) => b !== pngBytes[i])) fail('asset bytes differ')
  console.log('ASSETS OK')
  console.log('SMOKE OK')
  process.exit(0)
} catch (e) {
  fail(String(e?.message ?? e))
}
