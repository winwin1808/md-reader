import { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { hashText, applyTextChange, ensureDoc, readMeta, getMeta, ORIGIN_LOAD, ORIGIN_FORMAT, ORIGIN_REVERT, createCheckpointTracker, registerActor, trackLocalActor } from '@md-reader/core'
import type { CheckpointTracker } from '@md-reader/core'
import { findOrCreateByOrigin, getRecord, touchRecord, migrateLegacyRegistry, storeBase, resolveDocParam, docQuery } from '../doc-registry'
import type { DocRecord } from '../doc-registry'
import { readCacheEntry } from '../../shared/md-url'
import type { SyncStatus } from '../../shared/collab'
import { bindRoom } from '../collab/bindRoom'
import type { RoomConnection } from '../collab/bindRoom'
import type { RoomBinding } from '@md-reader/core'
import { peerUser } from '@md-reader/ui'

let migrationOnce: Promise<unknown> | null = null

function safeName(url: string): string {
  const seg = url.split('/').pop() || 'Untitled.md'
  try { return decodeURIComponent(seg) } catch { return seg }
}

export interface DocSession {
  docId: string | null
  record: DocRecord | null
  doc: Y.Doc; yText: Y.Text; undoManager: Y.UndoManager
  content: string
  title: string
  hasContent: boolean
  isDirty: boolean
  setDirty(dirty: boolean): void
  error: string | null
  setError(message: string | null): void
  synced: boolean
  checkpoints: CheckpointTracker | null
  externalChange: { remoteText: string; remoteHash: string } | null
  acceptExternal(): void
  dismissExternal(): void
  syncStatus: SyncStatus
  awareness: RoomConnection['awareness'] | null
}

export function useDocSession(opts: { docId: string | null; fileUrl: string | null; shortParam?: string | null; room?: RoomBinding | null; displayName?: string }): DocSession {
  const { docId: legacyDocId, fileUrl: fileUrlParam, shortParam, room, displayName = 'Bạn' } = opts
  const docIdParam = legacyDocId || shortParam || null
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [docTitle, setDocTitle] = useState<string>('')
  const [hasContent, setHasContent] = useState(false)
  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [synced, setSynced] = useState<boolean>(false)
  const [record, setRecord] = useState<DocRecord | null>(null)
  const [checkpoints, setCheckpoints] = useState<CheckpointTracker | null>(null)
  const checkpointsRef = useRef<CheckpointTracker | null>(null)
  const isFileContentSetRef = useRef<boolean>(false)
  const syncedPromiseRef = useRef<Promise<unknown>>(Promise.resolve())
  const [externalChange, setExternalChange] = useState<{ remoteText: string; remoteHash: string } | null>(null)

  // Resolve the registry record (async, once per opts change)
  useEffect(() => {
    let cancelled = false
    setRecord(null)
    if (!docIdParam && !fileUrlParam) return
    ;(async () => {
      try {
        if (!migrationOnce) migrationOnce = migrateLegacyRegistry().catch(() => 0)
        await migrationOnce
        let rec: DocRecord | null = null
        if (docIdParam) {
          const id = shortParam
            ? await resolveDocParam(new URLSearchParams({ d: shortParam }))
            : await resolveDocParam(new URLSearchParams({ doc: docIdParam }))
          rec = id ? await getRecord(id) : null
          if (rec && !shortParam) {
            try { window.history.replaceState(null, '', await docQuery(rec.docId)) } catch { /* ignore */ }
          }
          if (!rec) {
            if (!cancelled) setError('Không tìm thấy tài liệu này.')
            return
          }
        } else if (fileUrlParam) {
          rec = await findOrCreateByOrigin({
            title: safeName(fileUrlParam),
            originKind: 'url',
            originPath: fileUrlParam,
          })
          try {
            window.history.replaceState(null, '', await docQuery(rec.docId))
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setRecord(rec)
      } catch (err) {
        console.warn('Failed to resolve document record:', err)
        if (!cancelled) setError('Không thể mở tài liệu này.')
      }
    })()
    return () => { cancelled = true }
  }, [docIdParam, fileUrlParam])

  const persistenceName = record ? record.persistenceName : null

  const doc = useMemo(() => new Y.Doc({ gc: false }), [record?.docId])
  const yText = useMemo(() => doc.getText('source'), [doc])
  const undoManager = useMemo(() => new Y.UndoManager(yText), [yText])

  useEffect(() => {
    setSynced(false)
    let cancelled = false
    let persistence: IndexeddbPersistence | null = null
    if (persistenceName) {
      try {
        persistence = new IndexeddbPersistence(persistenceName, doc)
      } catch (err) {
        console.warn('Failed to initialize IndexeddbPersistence:', err)
      }
    }
    let tracker: CheckpointTracker | null = null
    setCheckpoints(null)
    checkpointsRef.current = null
    const rec = record
    const whenSynced = persistence ? persistence.whenSynced : Promise.resolve()
    syncedPromiseRef.current = (async () => {
      await whenSynced
      if (rec && !cancelled) {
        ensureDoc(doc, { title: rec.title })
        registerActor(doc, 'Bạn')
        tracker = createCheckpointTracker(doc, { actor: 'Bạn' })
        checkpointsRef.current = tracker
        setCheckpoints(tracker)
        touchRecord(rec.docId).catch(console.error)
      }
    })()

    const text = doc.getText('source')
    const meta = getMeta(doc)
    const updateTitle = () => {
      const t = meta.get('title') !== undefined ? readMeta(doc).title : ''
      if (t) setDocTitle(t.replace(/\.[^/.]+$/, ''))
    }
    let contentTimer: ReturnType<typeof setTimeout> | null = null
    const clearContentTimer = () => {
      if (contentTimer !== null) {
        clearTimeout(contentTimer)
        contentTimer = null
      }
    }
    const observer = (event: Y.YTextEvent) => {
      setHasContent(text.length > 0)
      const origin = event.transaction.origin
      if (origin !== ORIGIN_LOAD && origin !== ORIGIN_FORMAT && origin !== ORIGIN_REVERT) {
        setIsDirty(true)
      }
      clearContentTimer()
      if (origin === ORIGIN_LOAD || origin === ORIGIN_REVERT) {
        setContent(text.toString())
      } else {
        contentTimer = setTimeout(() => {
          contentTimer = null
          setContent(text.toString())
        }, 120)
      }
      updateTitle()
    }
    text.observe(observer)
    meta.observe(updateTitle)
    const onPageHide = () => { tracker?.flush('auto', 'Bạn') }
    window.addEventListener('pagehide', onPageHide)
    // Wait for initial sync from IDB
    if (persistence) {
      persistence.once('synced', () => {
        setSynced(true)
        if (!isFileContentSetRef.current) {
          setHasContent(text.length > 0)
          setContent(text.toString())
          updateTitle()
          setIsDirty(false)
        }
      })
    }

    return () => {
      cancelled = true
      window.removeEventListener('pagehide', onPageHide)
      tracker?.flush('auto', 'Bạn')
      tracker?.dispose()
      if (checkpointsRef.current === tracker) checkpointsRef.current = null
      clearContentTimer()
      text.unobserve(observer)
      meta.unobserve(updateTitle)
      if (persistence) {
        persistence.destroy()
      }
    }
  }, [doc, persistenceName, record])

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('off')
  const [awareness, setAwareness] = useState<RoomConnection['awareness'] | null>(null)
  const nameRef = useRef(displayName)
  const awarenessRef = useRef<RoomConnection['awareness'] | null>(null)
  useEffect(() => {
    nameRef.current = displayName
    const a = awarenessRef.current
    if (a) a.setLocalStateField('user', peerUser(a.clientID, displayName))
  }, [displayName])

  const roomServerUrl = room?.serverUrl
  const roomId = room?.roomId
  const roomToken = room?.ownerToken
  useEffect(() => {
    if (!record || !roomServerUrl || !roomId || !roomToken) return
    let cancelled = false
    let conn: RoomConnection | null = null
    let unsub: (() => void) | null = null
    let untrack: (() => void) | null = null
    ;(async () => {
      await syncedPromiseRef.current
      if (cancelled) return
      conn = bindRoom(doc, { serverUrl: roomServerUrl, roomId, token: roomToken, name: nameRef.current })
      awarenessRef.current = conn.awareness
      setAwareness(conn.awareness)
      unsub = conn.status$(setSyncStatus)
      untrack = trackLocalActor(doc, () => nameRef.current)
    })()
    return () => {
      cancelled = true
      unsub?.()
      untrack?.()
      conn?.destroy()
      awarenessRef.current = null
      setSyncStatus('off')
      setAwareness(null)
    }
  }, [doc, record, roomServerUrl, roomId, roomToken])

  // Handle URL file param
  useEffect(() => {
    isFileContentSetRef.current = false
    setExternalChange(null)
    const fileUrl = record && record.originKind === 'url' ? record.originPath : null
    if (fileUrl) {
      let cancelled = false
      const loadContent = async (remote: string) => {
        await syncedPromiseRef.current
        if (cancelled) return
        const ytext = doc.getText('source')
        const meta = doc.getMap('meta')
        const name = safeName(fileUrl)
        const local = ytext.toString()
        const rec0Id = record!.docId
        const rememberBase = () => {
          void Promise.resolve(storeBase(rec0Id, remote)).catch((err) => console.warn('storeBase failed:', err))
        }
        const hasHandle = !!record!.hasHandle
        const applyRemote = (h: string) => {
          doc.transact(() => {
            applyTextChange(ytext, remote, ORIGIN_LOAD)
            meta.set('title', name)
            meta.set('remoteHash', h)
            if (!hasHandle) meta.set('originHash', h)
          }, ORIGIN_LOAD)
          setContent(remote)
          setHasContent(remote.length > 0)
          const diskBase = meta.get('originHash') as string | undefined
          setIsDirty(hasHandle && diskBase != null ? h !== diskBase : false)
          rememberBase()
          checkpointsRef.current?.flush('import', 'Bạn')
        }
        const keepLocal = (dirty: boolean) => {
          setContent(local)
          setHasContent(local.length > 0)
          setIsDirty(dirty)
          rememberBase()
        }
        isFileContentSetRef.current = true
        const origin0 = meta.get('originHash') as string | undefined
        const base0 = (meta.get('remoteHash') as string | undefined) ?? origin0
        if (base0 == null && local === '') {
          doc.transact(() => {
            applyTextChange(ytext, remote, ORIGIN_LOAD)
            meta.set('title', name)
          }, ORIGIN_LOAD)
          setContent(remote)
          setHasContent(remote.length > 0)
          setIsDirty(false)
          rememberBase()
          checkpointsRef.current?.flush('import', 'Bạn')
          const h0 = await hashText(remote)
          if (!cancelled) {
            meta.set('remoteHash', h0)
            meta.set('originHash', h0)
          }
        } else {
          const [h, lh] = await Promise.all([hashText(remote), hashText(local)])
          if (cancelled) return
          const origin = meta.get('originHash') as string | undefined
          const remoteBase = meta.get('remoteHash') as string | undefined
          const base = remoteBase ?? origin
          if (lh === h) {
            meta.set('remoteHash', h)
            if (!hasHandle && origin !== h) meta.set('originHash', h)
            keepLocal(hasHandle && origin != null ? lh !== origin : false)
          } else if (base === h) {
            if (remoteBase == null) meta.set('remoteHash', h)
            keepLocal(lh !== origin)
          } else if (lh === base && !(remoteBase == null && record!.hasHandle)) {
            applyRemote(h)
          } else {
            setContent(local)
            setHasContent(local.length > 0)
            setIsDirty(true)
            setExternalChange({ remoteText: remote, remoteHash: h })
          }
        }
      }

      const cacheKey = 'file_content_' + fileUrl
      const tryFetch = () => {
        if (fileUrl.startsWith('file:')) {
          try {
            const xhr = new XMLHttpRequest()
            xhr.open('GET', fileUrl, true)
            xhr.onload = () => {
              if ((xhr.status === 200 || xhr.status === 0) && xhr.responseText) {
                loadContent(xhr.responseText)
              } else {
                setError(`Cannot read file: ${fileUrl}. Make sure "Allow access to file URLs" is enabled in extension settings.`)
              }
            }
            xhr.onerror = () => {
              setError(`Cannot read file: ${fileUrl}. Make sure "Allow access to file URLs" is enabled in extension settings.`)
            }
            xhr.send()
          } catch (err) {
            console.error('XHR file read error:', err)
            setError(`Cannot read file: ${fileUrl}. Make sure "Allow access to file URLs" is enabled in extension settings.`)
          }
          return
        }

        const fetchUrl =
          fileUrl.includes('github.com/') && fileUrl.includes('/blob/')
            ? fileUrl.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/')
            : fileUrl
        fetch(fetchUrl)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.text()
          })
          .then(loadContent)
          .catch(err => {
            console.error('Failed to load file from URL:', err)
            setError(`Cannot read file: ${fileUrl}. Make sure "Allow access to file URLs" is enabled in extension settings.`)
          })
      }

      if (chrome.storage?.local?.get) {
        chrome.storage.local.get(cacheKey).then((cached) => {
          const text = cached ? readCacheEntry(cached[cacheKey]) : null
          if (text) {
            loadContent(text)
              .then(() => {
                if (!cancelled) chrome.storage.local.remove(cacheKey).catch(() => {})
              })
              .catch((err) => console.warn('Cached load failed:', err))
          } else {
            if (cached && cached[cacheKey] !== undefined) chrome.storage.local.remove(cacheKey).catch(() => {})
            tryFetch()
          }
        }).catch(() => {
          tryFetch()
        })
      } else {
        tryFetch()
      }
      return () => { cancelled = true }
    }
  }, [doc, record])

  const acceptExternal = () => {
    const ext = externalChange
    if (!ext) return
    doc.transact(() => {
      applyTextChange(doc.getText('source'), ext.remoteText, ORIGIN_LOAD)
      doc.getMap('meta').set('remoteHash', ext.remoteHash)
      if (!record?.hasHandle) doc.getMap('meta').set('originHash', ext.remoteHash)
    }, ORIGIN_LOAD)
    setContent(ext.remoteText)
    setHasContent(ext.remoteText.length > 0)
    const diskBase = doc.getMap('meta').get('originHash') as string | undefined
    setIsDirty(!!record?.hasHandle && diskBase != null ? ext.remoteHash !== diskBase : false)
    setExternalChange(null)
    checkpointsRef.current?.flush('import', 'Bạn')
    if (record) void Promise.resolve(storeBase(record.docId, ext.remoteText)).catch((err) => console.warn('storeBase failed:', err))
  }
  const dismissExternal = () => setExternalChange(null)

  return {
    docId: record ? record.docId : null,
    record,
    doc, yText, undoManager,
    content,
    title: docTitle,
    hasContent,
    isDirty,
    setDirty: setIsDirty,
    error,
    setError,
    synced,
    checkpoints,
    externalChange,
    acceptExternal,
    dismissExternal,
    syncStatus,
    awareness,
  }
}
