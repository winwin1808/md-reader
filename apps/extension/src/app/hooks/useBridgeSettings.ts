import { useCallback, useEffect, useState } from 'react'
import {
  BRIDGE_STORAGE_KEY,
  parseBridgeSettings,
  readBridgeSettings,
  removeApproved,
  type BridgeSettings,
  type StoreLike,
} from '../../worker/bridge-storage'
import type { ApprovedClient } from '../../worker/bridge'

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
} {
  const [state, setState] = useState<BridgeSettings>({ enabled: false, approved: [] })

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

  return { enabled: state.enabled, clients: state.approved, setEnabled, revoke }
}
