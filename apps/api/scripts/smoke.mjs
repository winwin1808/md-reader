import WebSocket from 'ws'
import * as Y from 'yjs'
import YProvider from 'y-partyserver/provider'

const HOST = process.env.HOST ?? 'https://md-reader-api.qhao-work.workers.dev'
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
  console.log('SMOKE OK')
  process.exit(0)
} catch (e) {
  fail(String(e?.message ?? e))
}
