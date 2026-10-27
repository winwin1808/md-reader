import type * as Y from 'yjs'
import YProvider from 'y-partyserver/provider'
import { API_PATHS, wsHost } from '@md-reader/core'
import { peerUser } from '@md-reader/ui'

export type SyncStatus = 'off' | 'connecting' | 'online' | 'offline'

const TERMINAL_CLOSE = new Set([1009, 4410, 4413])

type Awareness = YProvider['awareness']

export interface BindRoomOptions {
  serverUrl: string
  roomId: string
  token: string
  name: string
}

export interface RoomConnection {
  provider: YProvider
  awareness: Awareness
  status$(cb: (s: SyncStatus) => void): () => void
  destroy(): void
}

export function bindRoom(
  doc: Y.Doc,
  opts: BindRoomOptions,
  deps: { Provider?: typeof YProvider } = {},
): RoomConnection {
  const Provider = deps.Provider ?? YProvider
  const provider = new Provider(wsHost(opts.serverUrl), opts.roomId, doc, {
    party: API_PATHS.party,
    params: { token: opts.token },
    connect: false,
    ...(opts.serverUrl.startsWith('http://') ? { protocol: 'ws' as const } : {}),
  })
  provider.awareness.setLocalStateField('user', peerUser(provider.awareness.clientID, opts.name))

  let status: SyncStatus = 'connecting'
  let destroyed = false
  const subs = new Set<(s: SyncStatus) => void>()
  const set = (s: SyncStatus) => {
    if (s === status) return
    status = s
    for (const cb of [...subs]) cb(s)
  }
  const onStatus = (e: { status: string }) => {
    if (e.status === 'disconnected') set('offline')
    else if (e.status === 'connected' || e.status === 'connecting') {
      if (status === 'offline') set('connecting')
    }
  }
  const onConnFail = () => {
    if (status === 'connecting') set('offline')
  }
  const onClose = (event?: { code?: number }) => {
    if (event?.code !== undefined && TERMINAL_CLOSE.has(event.code)) {
      provider.shouldConnect = false
      set('offline')
      return
    }
    onConnFail()
  }
  const onSynced = (synced: boolean) => {
    if (synced) set('online')
  }
  provider.on('status', onStatus)
  provider.on('synced', onSynced)
  provider.on('connection-close', onClose)
  provider.on('connection-error', onConnFail)

  void provider.connect().then(
      () => {
        if (destroyed) provider.disconnect()
      },
      () => {
        if (destroyed) provider.disconnect()
      },
    )

  return {
    provider,
    awareness: provider.awareness,
    status$(cb) {
      subs.add(cb)
      cb(status)
      return () => {
        subs.delete(cb)
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      provider.off('status', onStatus)
      provider.off('synced', onSynced)
      provider.off('connection-close', onClose)
      provider.off('connection-error', onConnFail)
      provider.destroy()
      set('off')
      subs.clear()
    },
  }
}
