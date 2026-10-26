const base = process.env.MDR_API_URL
const secret = process.env.MDR_ADMIN_SECRET
const roomId = process.argv[2]
if (!base || !secret || !roomId) {
  console.error('usage: MDR_API_URL=<https://...> MDR_ADMIN_SECRET=<secret> node scripts/takedown.mjs <roomId>')
  process.exit(1)
}
const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/rooms/${encodeURIComponent(roomId)}/takedown`, {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}` },
})
console.log(`takedown ${roomId}: ${res.status}`)
process.exit(res.status === 204 ? 0 : 1)
