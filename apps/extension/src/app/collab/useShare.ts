import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@md-reader/ui'
import type { TFunction } from '@md-reader/ui'
import { API_PATHS, INSTALL_HEADER, SHARE_EXPIRY_PRESETS } from '@md-reader/core'
import type { CreateLinkRequest, CreateRoomResponse, RoomBinding, ShareLink } from '@md-reader/core'
import { saveLinkToken, getLinkTokens, forgetLinkToken, forgetRoomTokens } from './link-cache'
import { getInstallKey, InstallKeyStorageError, limitMessage } from './tenancy'
import { getRecord, touchRecord } from '../doc-registry'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

async function call<T>(t: TFunction, url: string, init: RequestInit): Promise<T> {
  const INVALID = t('ext.share.invalid')
  let res: Response
  try {
    res = await globalThis.fetch(url, init)
  } catch {
    throw new Error(t('ext.share.unreachable'))
  }
  if (res.status === 401) throw Object.assign(new Error(t('ext.share.forbidden')), { status: 401 })
  if (res.status === 429) {
    let body: unknown = null
    try { body = await res.json() } catch { /* ignore */ }
    const m = limitMessage(t, 429, body)
    throw Object.assign(new Error(m ?? t('ext.share.serverError', { status: 429 })), { status: 429 })
  }
  if (!res.ok) throw Object.assign(new Error(t('ext.share.serverError', { status: res.status })), { status: res.status })
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
  const t = useT()
  const INVALID = t('ext.share.invalid')
  const [binding, setBinding] = useState<RoomBinding | null>(null)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const bindingRef = useRef<RoomBinding | null>(null)
  const tokens = useRef(new Map<string, string>())
  const session = useRef(new Map<string, ShareLink>())
  const gen = useRef(0)
  const linksRef = useRef<ShareLink[]>([])
  const put = (next: ShareLink[] | ((cur: ShareLink[]) => ShareLink[])) => {
    linksRef.current = typeof next === 'function' ? next(linksRef.current) : next
    setLinks(linksRef.current)
  }
  const enabling = useRef<Promise<RoomBinding> | null>(null)
  // Doc the current binding belongs to, and the doc of the latest render. Between a
  // docId change (render) and its effect, bindingRef still holds the OLD doc's room.
  const boundDoc = useRef<string | null>(null)
  const docRef = useRef<string | null>(docId)
  docRef.current = docId
  const live = () => (boundDoc.current === docRef.current ? bindingRef.current : null)

  useEffect(() => {
    let cancelled = false
    gen.current++
    enabling.current = null
    bindingRef.current = null
    boundDoc.current = docId
    tokens.current.clear()
    session.current.clear()
    setBinding(null)
    put([])
    if (docId) {
      getRecord(docId).then((r) => {
        if (cancelled || !r?.room) return
        bindingRef.current = r.room
        boundDoc.current = docId
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
    const b = live()
    if (!b) throw new Error(t('ext.share.notEnabled'))
    return b
  }

  const installKey = async (): Promise<string> => {
    try { return await getInstallKey() } catch (e) {
      if (e instanceof InstallKeyStorageError) throw new Error(t('ext.share.storageError'))
      throw e
    }
  }

  const enable = useCallback(async (): Promise<RoomBinding> => {
    const have = live()
    if (have) return have
    if (!docId) throw new Error(t('ext.share.noDoc'))
    if (enabling.current) return enabling.current
    const p: Promise<RoomBinding> = run(async (stale) => {
      const r = await call<CreateRoomResponse>(t, `${serverUrl}${API_PATHS.rooms}`, { method: 'POST', headers: { [INSTALL_HEADER]: await installKey() } })
      if (!isObj(r) || typeof r.roomId !== 'string' || typeof r.ownerToken !== 'string') throw new Error(INVALID)
      const b: RoomBinding = { serverUrl, roomId: r.roomId, ownerToken: r.ownerToken }
      // Always attach to the doc the user clicked Share on (docId captured above), even if
      // they switched away meanwhile; only the live hook state is skipped when stale.
      await touchRecord(docId, { room: b })
      if (!stale()) {
        bindingRef.current = b
        boundDoc.current = docId
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
    const list = await call<ShareLink[]>(t, `${b.serverUrl}${API_PATHS.links(b.roomId)}`, { headers: auth(b) })
    if (!Array.isArray(list)) throw new Error(INVALID)
    const cached = await getLinkTokens(b.roomId)
    if (stale()) return
    const server = list.map((l) => ({ ...l, token: l.token || tokens.current.get(l.tokenPrefix) || cached[l.tokenPrefix] || '' }))
    const seen = new Set(server.map((l) => l.tokenPrefix))
    const kept = [...session.current.values()].filter((l) => !seen.has(l.tokenPrefix))
    put([...kept.reverse(), ...server])
  }), [run])

  const createLink = useCallback((req: CreateLinkRequest) => run(async (stale) => {
    const b = need()
    const l = await call<ShareLink>(t, `${b.serverUrl}${API_PATHS.links(b.roomId)}`, {
      method: 'POST',
      headers: { ...auth(b), 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!isObj(l) || typeof l.tokenPrefix !== 'string') throw new Error(INVALID)
    if (l.token) await saveLinkToken(b.roomId, l.tokenPrefix, l.token)
    if (stale()) return l
    tokens.current.set(l.tokenPrefix, l.token)
    if (l.token !== '') session.current.set(l.tokenPrefix, l)
    put((cur) => [l, ...cur])
    return l
  }), [run])

  const revoke = useCallback((prefix: string) => run(async (stale) => {
    const b = need()
    await call<unknown>(t, `${b.serverUrl}${API_PATHS.revoke(b.roomId, prefix)}`, { method: 'DELETE', headers: auth(b) })
    await forgetLinkToken(b.roomId, prefix)
    if (stale()) return
    tokens.current.delete(prefix)
    session.current.delete(prefix)
    put((cur) => cur.filter((l) => l.tokenPrefix !== prefix))
  }), [run])

  const recreate = useCallback(async (link: ShareLink): Promise<void> => {
    let expiresIn: number | null = null
    if (link.expiresAt !== null) {
      const left = link.expiresAt - Date.now()
      const opts = [SHARE_EXPIRY_PRESETS['7d'], SHARE_EXPIRY_PRESETS['30d']].filter((v): v is number => typeof v === 'number')
      expiresIn = opts.reduce((best, v) => (Math.abs(v - left) < Math.abs(best - left) ? v : best), opts[0] as number)
    }
    await createLink({ role: link.role, label: link.label || undefined, expiresIn })
    await revoke(link.tokenPrefix)
    await refresh()
  }, [createLink, revoke, refresh])

  const revokeAll = useCallback(() => run(async (stale) => {
    const b = need()
    const active = linksRef.current.filter((l) => l.revokedAt === null).map((l) => l.tokenPrefix)
    const url = `${b.serverUrl}${API_PATHS.links(b.roomId)}/revoke-all`
    let outcome: 'ok' | 'legacy' = 'legacy'
    for (let attempt = 0; attempt < 2; attempt++) {
      if (stale()) return
      try {
        await call<unknown>(t, url, { method: 'POST', headers: auth(b) })
        outcome = 'ok'
        break
      } catch (e) {
        const st = (e as { status?: number }).status
        if (st === 404) break
        if (st === 502 && attempt === 0) continue
        if (st === 502) throw new Error(t('ext.share.revokeFailed', { count: active.length }))
        throw e
      }
    }
    if (outcome === 'ok') {
      for (const prefix of active) await forgetLinkToken(b.roomId, prefix)
      if (stale()) return
      const now = Date.now()
      for (const prefix of active) { tokens.current.delete(prefix); session.current.delete(prefix) }
      put((cur) => cur.map((l) => (l.revokedAt === null ? { ...l, revokedAt: now } : l)))
      try { await refresh() } catch { /* local marks stand */ }
      return
    }
    let failed = 0
    const causes = new Set<string>()
    for (const prefix of active) {
      if (stale()) return
      try {
        await call<unknown>(t, `${b.serverUrl}${API_PATHS.revoke(b.roomId, prefix)}`, { method: 'DELETE', headers: auth(b) })
      } catch (e) {
        if ((e as { status?: number }).status !== 404) {
          failed++
          const m = (e as Error).message
          causes.add(m === t('ext.share.forbidden') || m === t('ext.share.unreachable') ? m : '')
          continue
        }
      }
      await forgetLinkToken(b.roomId, prefix)
      if (stale()) return
      tokens.current.delete(prefix)
      session.current.delete(prefix)
      const now = Date.now()
      put((cur) => cur.map((l) => (l.tokenPrefix === prefix ? { ...l, revokedAt: now } : l)))
    }
    if (stale()) return
    try { await refresh() } catch { /* local marks stand */ }
    if (failed > 0) {
      const only = causes.size === 1 ? [...causes][0] : ''
      throw new Error(only || t('ext.share.revokeFailed', { count: failed }))
    }
  }), [run, refresh])

  const deleteRemote = useCallback(() => run(async (stale) => {
    const b = need()
    try {
      await call<unknown>(t, `${b.serverUrl}${API_PATHS.room(b.roomId)}`, { method: 'DELETE', headers: auth(b) })
    } catch (e) {
      const st = (e as { status?: number }).status
      if (st === 401) {
        let gone = false
        try {
          const r = await fetch(`${b.serverUrl}${API_PATHS.resolve(b.ownerToken)}`)
          gone = r.status === 410 || r.status === 404
        } catch { /* mạng lỗi: coi như chưa rõ */ }
        if (!gone) throw e
      } else if (st !== 404) throw e
    }
    await forgetRoomTokens(b.roomId)
    await touchRecord(docId as string, { room: undefined })
    if (!stale()) {
      bindingRef.current = null
      tokens.current.clear()
      session.current.clear()
      setBinding(null)
      put([])
    }
  }), [run, docId])

  return { binding, links, enable, deleteRemote, createLink, revoke, recreate, revokeAll, refresh, busy: pending > 0, error,
    currentLinks: (): ShareLink[] => linksRef.current,
    currentBinding: (): RoomBinding | null => live() }
}
