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
    approved.push({ keyHash: r.keyHash, client: r.client, at: r.at })
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
