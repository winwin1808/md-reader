import { useEffect, useState } from 'react'
import { peerColor, type Peer } from './PresenceBar'

export interface AwarenessLike {
  clientID: number
  getStates(): Map<number, Record<string, unknown>>
  on(ev: 'change', cb: () => void): void
  off(ev: 'change', cb: () => void): void
}

export function awarenessToPeers(states: Map<number, Record<string, unknown>>, selfId: number): Peer[] {
  const out: Peer[] = []
  states.forEach((s, clientId) => {
    const user = s?.user
    if (!user || typeof user !== 'object') return
    const name = String((user as { name?: unknown }).name ?? '').trim().slice(0, 40) || 'Ẩn danh'
    out.push({ clientId, name, color: peerColor(clientId), isSelf: clientId === selfId })
  })
  return out
}

export function peerUser(clientId: number, name: string): { name: string; color: string; colorLight: string } {
  const color = peerColor(clientId)
  return { name, color, colorLight: `color-mix(in srgb, ${color} 20%, transparent)` }
}

export function usePeers(awareness: AwarenessLike | null | undefined): Peer[] {
  const [peers, setPeers] = useState<Peer[]>(() =>
    awareness ? awarenessToPeers(awareness.getStates(), awareness.clientID) : [])
  useEffect(() => {
    if (!awareness) { setPeers([]); return }
    const update = () => setPeers(awarenessToPeers(awareness.getStates(), awareness.clientID))
    update()
    awareness.on('change', update)
    return () => awareness.off('change', update)
  }, [awareness])
  return awareness ? peers : []
}
