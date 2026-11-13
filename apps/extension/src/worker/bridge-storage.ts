import { BRIDGE_PORTS, type BridgePinState } from '@md-reader/core/bridge'
import { generateBridgeKeyPair, exportPublicKey, exportPrivateJwk, importPrivateJwk } from '@md-reader/core/bridge-auth'
import { IDLE_SCANS_BEFORE_BACKOFF, type ApprovedClient } from './bridge'

export const BRIDGE_STORAGE_KEY = 'mdr.bridge'
export const PAIR_DECISION_MSG = 'mdr-bridge-pair-decision'
export const BRIDGE_SCAN_MSG = 'mdr-bridge-scan'

export interface BridgeSettings { enabled: boolean; approved: ApprovedClient[] }
export interface StoreLike {
  get(k: string): Promise<Record<string, unknown>>
  set(v: Record<string, unknown>): Promise<void>
}

export function parseBridgeSettings(v: unknown): BridgeSettings {
  const none: BridgeSettings = { enabled: false, approved: [] }
  if (!v || typeof v !== 'object') return none
  const o = v as Record<string, unknown>
  if (typeof o.enabled !== 'boolean' || !Array.isArray(o.approved)) return none
  const approved: ApprovedClient[] = []
  for (const a of o.approved) {
    if (!a || typeof a !== 'object') return none
    const r = a as Record<string, unknown>
    if (typeof r.keyHash !== 'string' || typeof r.client !== 'string' || typeof r.at !== 'number') return none
    if (typeof r.serverKey !== 'string') continue
    approved.push({ keyHash: r.keyHash, client: r.client, at: r.at, serverKey: r.serverKey })
  }
  return { enabled: o.enabled, approved }
}

export async function readBridgeSettings(store: StoreLike): Promise<BridgeSettings> {
  const r = await store.get(BRIDGE_STORAGE_KEY)
  return parseBridgeSettings(r[BRIDGE_STORAGE_KEY])
}

async function write(store: StoreLike, s: BridgeSettings): Promise<void> {
  await store.set({ [BRIDGE_STORAGE_KEY]: s })
}

export async function addApproved(store: StoreLike, c: ApprovedClient): Promise<void> {
  const s = await readBridgeSettings(store)
  const i = s.approved.findIndex((a) => a.keyHash === c.keyHash)
  const approved = [...s.approved]
  if (i >= 0) approved[i] = c
  else approved.push(c)
  await write(store, { ...s, approved })
}

export async function removeApproved(store: StoreLike, keyHash: string): Promise<void> {
  const s = await readBridgeSettings(store)
  await write(store, { ...s, approved: s.approved.filter((a) => a.keyHash !== keyHash) })
}

export function nextScanDelayMin(idleScans: number): number {
  return idleScans < IDLE_SCANS_BEFORE_BACKOFF ? 0.5 : 5
}

export interface PairDecisionMsg { type: typeof PAIR_DECISION_MSG; port: number; allow: boolean; keyHash: string }

export function parsePairDecision(v: unknown): PairDecisionMsg | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (o.type !== PAIR_DECISION_MSG) return null
  if (typeof o.port !== 'number' || !Number.isInteger(o.port) || !BRIDGE_PORTS.includes(o.port)) return null
  if (typeof o.allow !== 'boolean') return null
  if (typeof o.keyHash !== 'string' || !/^[0-9a-f]{64}$/.test(o.keyHash)) return null
  return { type: PAIR_DECISION_MSG, port: o.port, allow: o.allow, keyHash: o.keyHash }
}

export const BRIDGE_KEY_STORAGE = 'mdr.bridgeKey'

export async function loadOrCreateExtKey(store: StoreLike): Promise<{ privateKey: CryptoKey; publicKey: string }> {
  const r = (await store.get(BRIDGE_KEY_STORAGE))[BRIDGE_KEY_STORAGE]
  if (r && typeof r === 'object') {
    const o = r as Record<string, unknown>
    if (o.jwk && typeof o.jwk === 'object' && typeof o.publicKey === 'string') {
      try {
        return { privateKey: await importPrivateJwk(o.jwk as JsonWebKey), publicKey: o.publicKey }
      } catch { /* corrupt: regenerate */ }
    }
  }
  const pair = await generateBridgeKeyPair()
  const publicKey = await exportPublicKey(pair.publicKey)
  await store.set({ [BRIDGE_KEY_STORAGE]: { jwk: await exportPrivateJwk(pair.privateKey), publicKey } })
  return { privateKey: pair.privateKey, publicKey }
}

export const BRIDGE_ASKED_KEY = 'mdr.bridgeAsked'
export const BRIDGE_SEEN_KEY = 'mdr.bridgeSeen'
export const BRIDGE_CONNECT_MSG = 'mdr-bridge-connect'
export const ASKED_MAX = 20
export const SEEN_TTL_MS = 11 * 60_000

export type AskedMap = Record<string, { at: number; rejected?: boolean }>
export interface SeenServer { keyHash: string; client: string; port: number; pinned: BridgePinState; rejected: boolean; at: number }

const HEX64 = /^[0-9a-f]{64}$/
const PIN_STATES: readonly string[] = ['unknown', 'none', 'self', 'other']

export function pairPolicy(i: { pinned: BridgePinState; asked: boolean; manual: boolean; recentlyRevoked: boolean }): 'ask' | 'silent' {
  if (i.pinned === 'other') return 'silent'
  if (i.manual) return 'ask'
  if (i.recentlyRevoked) return 'silent'
  if (i.asked) return 'silent'
  return 'ask'
}

export function parseAsked(v: unknown): AskedMap {
  const out: AskedMap = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, e] of Object.entries(v as Record<string, unknown>)) {
    if (!HEX64.test(k) || !e || typeof e !== 'object') continue
    const r = e as Record<string, unknown>
    if (typeof r.at !== 'number' || !Number.isFinite(r.at)) continue
    out[k] = r.rejected === true ? { at: r.at, rejected: true } : { at: r.at }
  }
  return out
}

export async function readAsked(store: StoreLike): Promise<AskedMap> {
  return parseAsked((await store.get(BRIDGE_ASKED_KEY))[BRIDGE_ASKED_KEY])
}

export async function markAsked(store: StoreLike, keyHash: string, now: number, rejected?: boolean): Promise<void> {
  const m = await readAsked(store)
  const rej = rejected ?? m[keyHash]?.rejected
  m[keyHash] = rej === true ? { at: now, rejected: true } : { at: now }
  const kept = Object.entries(m).sort((a, b) => b[1].at - a[1].at).slice(0, ASKED_MAX)
  await store.set({ [BRIDGE_ASKED_KEY]: Object.fromEntries(kept) })
}

export function parseSeen(v: unknown): SeenServer[] {
  if (!Array.isArray(v)) return []
  const out: SeenServer[] = []
  for (const e of v) {
    if (!e || typeof e !== 'object') continue
    const r = e as Record<string, unknown>
    if (typeof r.keyHash !== 'string' || !HEX64.test(r.keyHash)) continue
    if (typeof r.client !== 'string') continue
    if (typeof r.port !== 'number' || !Number.isInteger(r.port)) continue
    if (typeof r.pinned !== 'string' || !PIN_STATES.includes(r.pinned)) continue
    if (typeof r.rejected !== 'boolean') continue
    if (typeof r.at !== 'number' || !Number.isFinite(r.at)) continue
    out.push({ keyHash: r.keyHash, client: r.client, port: r.port, pinned: r.pinned as BridgePinState, rejected: r.rejected, at: r.at })
  }
  return out
}

export async function readSeen(store: StoreLike): Promise<SeenServer[]> {
  return parseSeen((await store.get(BRIDGE_SEEN_KEY))[BRIDGE_SEEN_KEY])
}

export async function upsertSeen(store: StoreLike, s: SeenServer): Promise<void> {
  const list = await readSeen(store)
  const i = list.findIndex((x) => x.keyHash === s.keyHash)
  if (i >= 0) list[i] = s
  else list.push(s)
  await store.set({ [BRIDGE_SEEN_KEY]: list })
}

export async function removeSeen(store: StoreLike, keyHash: string): Promise<void> {
  const list = await readSeen(store)
  await store.set({ [BRIDGE_SEEN_KEY]: list.filter((x) => x.keyHash !== keyHash) })
}

export async function pruneSeen(store: StoreLike, now: number): Promise<void> {
  const list = await readSeen(store)
  const kept = list.filter((x) => x.at >= now - SEEN_TTL_MS)
  if (kept.length !== list.length) await store.set({ [BRIDGE_SEEN_KEY]: kept })
}

export interface ConnectMsg { type: typeof BRIDGE_CONNECT_MSG; keyHash: string }

export function parseConnectMsg(v: unknown): ConnectMsg | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (o.type !== BRIDGE_CONNECT_MSG) return null
  if (typeof o.keyHash !== 'string' || !HEX64.test(o.keyHash)) return null
  return { type: BRIDGE_CONNECT_MSG, keyHash: o.keyHash }
}
