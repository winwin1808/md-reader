import { useCallback, useEffect, useRef, useState } from 'react'
import { API_PATHS } from '@md-reader/core'
import type { CreateLinkRequest, CreateRoomResponse, RoomBinding, ShareLink } from '@md-reader/core'
import { getRecord, touchRecord } from '../doc-registry'

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await globalThis.fetch(url, init)
  } catch {
    throw new Error('Không kết nối được máy chủ')
  }
  if (res.status === 401) throw new Error('Không có quyền với phòng này')
  if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}`)
  try {
    return (await res.json()) as T
  } catch {
    return undefined as T
  }
}

export function useShare(opts: { docId: string | null; serverUrl: string }) {
  const { docId, serverUrl } = opts
  const [binding, setBinding] = useState<RoomBinding | null>(null)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const bindingRef = useRef<RoomBinding | null>(null)
  const tokens = useRef(new Map<string, string>())

  useEffect(() => {
    let cancelled = false
    bindingRef.current = null
    tokens.current.clear()
    setBinding(null)
    setLinks([])
    if (docId) {
      getRecord(docId).then((r) => {
        if (cancelled || !r?.room) return
        bindingRef.current = r.room
        setBinding(r.room)
      }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [docId])

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setPending((n) => n + 1)
    try {
      const out = await fn()
      setError(null)
      return out
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setPending((n) => n - 1)
    }
  }, [])

  const auth = (b: RoomBinding) => ({ Authorization: `Bearer ${b.ownerToken}` })
  const need = (): RoomBinding => {
    const b = bindingRef.current
    if (!b) throw new Error('Chưa bật chia sẻ')
    return b
  }

  const enable = useCallback(async (): Promise<RoomBinding> => {
    if (bindingRef.current) return bindingRef.current
    if (!docId) throw new Error('Chưa có tài liệu')
    return run(async () => {
      const r = await call<CreateRoomResponse>(`${serverUrl}${API_PATHS.rooms}`, { method: 'POST' })
      const b: RoomBinding = { serverUrl, roomId: r.roomId, ownerToken: r.ownerToken }
      await touchRecord(docId, { room: b })
      bindingRef.current = b
      setBinding(b)
      return b
    })
  }, [docId, serverUrl, run])

  const refresh = useCallback(() => run(async () => {
    const b = need()
    const list = await call<ShareLink[]>(`${b.serverUrl}${API_PATHS.links(b.roomId)}`, { headers: auth(b) })
    setLinks(list.map((l) => ({ ...l, token: l.token || tokens.current.get(l.tokenPrefix) || '' })))
  }), [run])

  const createLink = useCallback((req: CreateLinkRequest) => run(async () => {
    const b = need()
    const l = await call<ShareLink>(`${b.serverUrl}${API_PATHS.links(b.roomId)}`, {
      method: 'POST',
      headers: { ...auth(b), 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    tokens.current.set(l.tokenPrefix, l.token)
    setLinks((cur) => [l, ...cur])
    return l
  }), [run])

  const revoke = useCallback((prefix: string) => run(async () => {
    const b = need()
    await call<unknown>(`${b.serverUrl}${API_PATHS.revoke(b.roomId, prefix)}`, { method: 'DELETE', headers: auth(b) })
    tokens.current.delete(prefix)
    setLinks((cur) => cur.filter((l) => l.tokenPrefix !== prefix))
  }), [run])

  return { binding, links, enable, createLink, revoke, refresh, busy: pending > 0, error }
}
