/** Reads a request body through a byte cap. Returns null when it exceeds `max`. */
export async function readCapped(req: Request, max: number): Promise<Uint8Array | null> {
  const declared = req.headers.get('content-length')
  if (declared !== null) {
    const n = Number(declared)
    if (Number.isFinite(n) && n > max) return null
  }
  if (!req.body) return new Uint8Array(0)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.byteLength
  }
  return out
}
