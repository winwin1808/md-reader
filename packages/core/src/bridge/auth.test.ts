import { describe, it, expect } from 'vitest'
import { generateBridgeKeyPair, exportPublicKey, importPublicKey, exportPrivateJwk, importPrivateJwk, keyId, fingerprint, newNonce, authPayload, signPayload, verifyPayload } from './auth.js'

describe('bridge auth v2', () => {
  it('sign/verify roundtrip and tamper detection', async () => {
    const kp = await generateBridgeKeyPair()
    const other = await generateBridgeKeyPair()
    const pub = await importPublicKey(await exportPublicKey(kp.publicKey))
    const n = newNonce()
    const payload = authPayload('ext', n, 'ab'.repeat(32), 47821)
    const sig = await signPayload(kp.privateKey, payload)
    expect(await verifyPayload(pub, payload, sig)).toBe(true)
    const bad = payload.slice(); bad[0] = (bad[0] ?? 0) ^ 1
    expect(await verifyPayload(pub, bad, sig)).toBe(false)
    expect(await verifyPayload(other.publicKey, payload, sig)).toBe(false)
    expect(await verifyPayload(pub, authPayload('ext', n, 'ab'.repeat(32), 47822), sig)).toBe(false)
    expect(await verifyPayload(pub, payload, '!!notb64')).toBe(false)
    expect(await verifyPayload(pub, payload, '')).toBe(false)
  })
  it('keyId, fingerprint, nonce, payload', async () => {
    const kp = await generateBridgeKeyPair()
    const spki = await exportPublicKey(kp.publicKey)
    const id = await keyId(spki)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
    expect(await keyId(spki)).toBe(id)
    expect(fingerprint(id)).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/)
    expect(newNonce()).toHaveLength(43)
    expect(newNonce()).not.toBe(newNonce())
    expect(new TextDecoder().decode(authPayload('srv', 'N', 'K', 1))).toBe('mdr-bridge-v2|srv|N|K|1')
  })
  it('JWK export/import can sign', async () => {
    const kp = await generateBridgeKeyPair()
    const priv = await importPrivateJwk(await exportPrivateJwk(kp.privateKey))
    const payload = authPayload('srv', newNonce(), 'x', 1)
    expect(await verifyPayload(kp.publicKey, payload, await signPayload(priv, payload))).toBe(true)
  })
})
