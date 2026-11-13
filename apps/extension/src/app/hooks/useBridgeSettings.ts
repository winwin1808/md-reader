import { useCallback, useEffect, useState } from 'react'
import {
  BRIDGE_CONNECT_MSG,
  BRIDGE_SEEN_KEY,
  BRIDGE_STORAGE_KEY,
  SEEN_TTL_MS,
  parseBridgeSettings,
  parseSeen,
  readBridgeSettings,
  removeApproved,
  type BridgeSettings,
  type StoreLike,
} from '../../worker/bridge-storage'
import type { ApprovedClient } from '../../worker/bridge'

export interface DiscoveredApp { keyHash: string; client: string; status: 'waiting' | 'other' }

async function readSeen(): Promise<ReturnType<typeof parseSeen>> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.session) return []
    const r = await chrome.storage.session.get(BRIDGE_SEEN_KEY)
    return parseSeen(r?.[BRIDGE_SEEN_KEY])
  } catch {
    return []
  }
}

type Changes = Record<string, { newValue?: unknown }>
export interface ChangeSource {
  addListener(fn: (changes: Changes, area: string) => void): void
  removeListener(fn: (changes: Changes, area: string) => void): void
}
type Store = StoreLike & { onChanged?: ChangeSource }

function defaultStore(): Store | undefined {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return undefined
  return {
    get: (k) => chrome.storage.local.get(k),
    set: (v) => chrome.storage.local.set(v),
    onChanged: chrome.storage.onChanged as unknown as ChangeSource,
  }
}

export function useBridgeSettings(store?: Store): {
  enabled: boolean
  clients: ApprovedClient[]
  setEnabled(v: boolean): Promise<void>
  revoke(keyHash: string): Promise<void>
  discovered: DiscoveredApp[]
  connect(keyHash: string): Promise<void>
} {
  const [state, setState] = useState<BridgeSettings>({ enabled: false, approved: [] })
  const [seen, setSeen] = useState<ReturnType<typeof parseSeen>>([])

  useEffect(() => {
    let alive = true
    let fresh = false
    void readSeen().then((v) => { if (alive && !fresh) setSeen(v) })
    const src = typeof chrome !== 'undefined' ? chrome.storage?.onChanged : undefined
    const fn = (changes: Changes, area: string) => {
      if (area !== 'session' || !(BRIDGE_SEEN_KEY in changes)) return
      fresh = true
      setSeen(parseSeen(changes[BRIDGE_SEEN_KEY].newValue))
    }
    ;(src as unknown as ChangeSource | undefined)?.addListener(fn)
    return () => { alive = false; (src as unknown as ChangeSource | undefined)?.removeListener(fn) }
  }, [])

  useEffect(() => {
    const s = store ?? defaultStore()
    if (!s) return
    let alive = true
    readBridgeSettings(s).then((v) => { if (alive) setState(v) }).catch(() => {})
    const fn = (changes: Changes, area: string) => {
      if (area !== 'local' || !(BRIDGE_STORAGE_KEY in changes)) return
      setState(parseBridgeSettings(changes[BRIDGE_STORAGE_KEY].newValue))
    }
    s.onChanged?.addListener(fn)
    return () => { alive = false; s.onChanged?.removeListener(fn) }
  }, [store])

  const setEnabled = useCallback(async (v: boolean) => {
    const s = store ?? defaultStore()
    if (!s) return
    const cur = await readBridgeSettings(s)
    await s.set({ [BRIDGE_STORAGE_KEY]: { ...cur, enabled: v } })
    setState({ ...cur, enabled: v })
  }, [store])

  const revoke = useCallback(async (keyHash: string) => {
    const s = store ?? defaultStore()
    if (!s) return
    await removeApproved(s, keyHash)
    setState(await readBridgeSettings(s))
  }, [store])

  const connect = useCallback(async (keyHash: string) => {
    try {
      await chrome.runtime.sendMessage({ type: BRIDGE_CONNECT_MSG, keyHash })
    } catch { /* worker may be asleep or gone; the list refreshes below */ }
    setSeen(await readSeen())
  }, [])

  const approved = new Set(state.approved.map((c) => c.keyHash))
  const cutoff = Date.now() - SEEN_TTL_MS
  const discovered: DiscoveredApp[] = seen
    .filter((x) => x.at >= cutoff && (!approved.has(x.keyHash) || x.pinned === 'other'))
    .map((x) => ({ keyHash: x.keyHash, client: x.client, status: (x.pinned === 'other' || x.rejected ? 'other' : 'waiting') as 'waiting' | 'other' }))
    .sort((a, b) => a.client.localeCompare(b.client) || a.keyHash.localeCompare(b.keyHash))

  return { enabled: state.enabled, clients: state.approved, setEnabled, revoke, discovered, connect }
}
