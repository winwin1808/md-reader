const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const

function subtle(): SubtleCrypto { return globalThis.crypto.subtle }

function toB64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(b64: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(b64)) throw new Error('bad base64url')
  const pad = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)
  const bin = atob(pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function generateBridgeKeyPair(): Promise<CryptoKeyPair> {
  return subtle().generateKey(ALG, true, ['sign', 'verify']) as Promise<CryptoKeyPair>
}
export async function exportPublicKey(k: CryptoKey): Promise<string> {
  return toB64Url(new Uint8Array(await subtle().exportKey('spki', k)))
}
export function importPublicKey(b64: string): Promise<CryptoKey> {
  return subtle().importKey('spki', fromB64Url(b64) as BufferSource, ALG, true, ['verify'])
}
export function exportPrivateJwk(k: CryptoKey): Promise<JsonWebKey> {
  return subtle().exportKey('jwk', k)
}
export function importPrivateJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle().importKey('jwk', jwk, ALG, true, ['sign'])
}
export async function keyId(spkiB64: string): Promise<string> {
  const d = new Uint8Array(await subtle().digest('SHA-256', fromB64Url(spkiB64) as BufferSource))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}
export function fingerprint(keyIdHex: string): string {
  const h = keyIdHex.slice(0, 8).toUpperCase()
  return `${h.slice(0, 4)}-${h.slice(4, 8)}`
}
export function newNonce(): string {
  return toB64Url(globalThis.crypto.getRandomValues(new Uint8Array(32)))
}
export function authPayload(role: 'ext' | 'srv', nonce: string, peerKeyId: string, port: number): Uint8Array {
  return new TextEncoder().encode(`mdr-bridge-v2|${role}|${nonce}|${peerKeyId}|${port}`)
}
export async function signPayload(priv: CryptoKey, payload: Uint8Array): Promise<string> {
  return toB64Url(new Uint8Array(await subtle().sign(SIGN, priv, payload as BufferSource)))
}
export async function verifyPayload(pub: CryptoKey, payload: Uint8Array, sig: string): Promise<boolean> {
  try {
    return await subtle().verify(SIGN, pub, fromB64Url(sig) as BufferSource, payload as BufferSource)
  } catch { return false }
}
