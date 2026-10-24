import { useCallback, useEffect, useRef, useState } from 'react'
import { API_PATHS } from '@md-reader/core'
import type { CreateLinkRequest, CreateRoomResponse, RoomBinding, ShareLink } from '@md-reader/core'
import { getRecord, touchRecord } from '../doc-registry'

const INVALID = 'Máy chủ trả dữ liệu không hợp lệ'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await globalThis.fetch(url, init)
  } catch {
    throw new Error('Không kết nối được máy chủ')
  }
  if (res.status === 401) throw new Error('Không có quyền với phòng này')
  if (!res.ok) throw Object.assign(new Error(`Máy chủ trả lỗi ${res.status}`), { status: res.status })
  if (res.status === 204) return undefined as T
  let text: string
  try {
    // Test doubles elsewhere only implement json(); real Responses always have text().
    if (typeof res.text !== 'function') return (await res.json()) as T
    text = await res.text()
  } catch {
    throw new Error(INVALID)
  }
  if (text.trim() === '') return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(INVALID)
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
  const session = useRef(new Map<string, ShareLink>())
  const gen = useRef(0)
  const linksRef = useRef<ShareLink[]>([])
  linksRef.current = links
  const enabling = useRef<Promise<RoomBinding> | null>(null)

  useEffect(() => {
    let cancelled = false
    gen.current++
    enabling.current = null
    bindingRef.current = null
    tokens.current.clear()
    session.current.clear()
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

  const run = useCallback(async <T,>(fn: (stale: () => boolean) => Promise<T>): Promise<T> => {
    const g = gen.current
    const stale = () => gen.current !== g
    setPending((n) => n + 1)
    try {
      const out = await fn(stale)
      if (!stale()) setError(null)
      return out
    } catch (e) {
      if (!stale()) setError((e as Error).message)
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
    if (enabling.current) return enabling.current
    const p: Promise<RoomBinding> = run(async (stale) => {
      const r = await call<CreateRoomResponse>(`${serverUrl}${API_PATHS.rooms}`, { method: 'POST' })
      if (!isObj(r) || typeof r.roomId !== 'string' || typeof r.ownerToken !== 'string') throw new Error(INVALID)
      const b: RoomBinding = { serverUrl, roomId: r.roomId, ownerToken: r.ownerToken }
      await touchRecord(docId, { room: b })
      if (!stale()) {
        bindingRef.current = b
        setBinding(b)
      }
      return b
    })
    enabling.current = p
    const clear = () => { if (enabling.current === p) enabling.current = null }
    p.then(clear, clear)
    return p
  }, [docId, serverUrl, run])

  const refresh = useCallback(() => run(async (stale) => {
    const b = need()
    const list = await call<ShareLink[]>(`${b.serverUrl}${API_PATHS.links(b.roomId)}`, { headers: auth(b) })
    if (!Array.isArray(list)) throw new Error(INVALID)
    if (stale()) return
    const server = list.map((l) => ({ ...l, token: l.token || tokens.current.get(l.tokenPrefix) || '' }))
    const seen = new Set(server.map((l) => l.tokenPrefix))
    const kept = [...session.current.values()].filter((l) => !seen.has(l.tokenPrefix))
    setLinks([...kept.reverse(), ...server])
  }), [run])

  const createLink = useCallback((req: CreateLinkRequest) => run(async (stale) => {
    const b = need()
    const l = await call<ShareLink>(`${b.serverUrl}${API_PATHS.links(b.roomId)}`, {
      method: 'POST',
      headers: { ...auth(b), 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!isObj(l) || typeof l.tokenPrefix !== 'string') throw new Error(INVALID)
    if (stale()) return l
    tokens.current.set(l.tokenPrefix, l.token)
    if (l.token !== '') session.current.set(l.tokenPrefix, l)
    setLinks((cur) => [l, ...cur])
    return l
  }), [run])

  const revoke = useCallback((prefix: string) => run(async (stale) => {
    const b = need()
    await call<unknown>(`${b.serverUrl}${API_PATHS.revoke(b.roomId, prefix)}`, { method: 'DELETE', headers: auth(b) })
    if (stale()) return
    tokens.current.delete(prefix)
    session.current.delete(prefix)
    setLinks((cur) => cur.filter((l) => l.tokenPrefix !== prefix))
  }), [run])

  const revokeAll = useCallback(() => run(async (stale) => {
    const b = need()
    const active = linksRef.current.filter((l) => l.revokedAt === null).map((l) => l.tokenPrefix)
    let failed = 0
    const causes = new Set<string>()
    for (const prefix of active) {
      if (stale()) return
      try {
        await call<unknown>(`${b.serverUrl}${API_PATHS.revoke(b.roomId, prefix)}`, { method: 'DELETE', headers: auth(b) })
      } catch (e) {
        if ((e as { status?: number }).status !== 404) {
          failed++
          const m = (e as Error).message
          causes.add(m === 'Không có quyền với phòng này' || m === 'Không kết nối được máy chủ' ? m : '')
          continue
        }
      }
      if (stale()) return
      tokens.current.delete(prefix)
      session.current.delete(prefix)
      const now = Date.now()
      setLinks((cur) => cur.map((l) => (l.tokenPrefix === prefix ? { ...l, revokedAt: now } : l)))
    }
    if (stale()) return
    try { await refresh() } catch { /* local marks stand */ }
    if (failed > 0) {
      const only = causes.size === 1 ? [...causes][0] : ''
      throw new Error(only || `Còn ${failed} link chưa thu hồi được`)
    }
  }), [run, refresh])

  return { binding, links, enable, createLink, revoke, revokeAll, refresh, busy: pending > 0, error }
}
