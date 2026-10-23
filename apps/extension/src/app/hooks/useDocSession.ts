import { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { hashText, applyTextChange, ensureDoc, readMeta, getMeta, ORIGIN_LOAD, ORIGIN_FORMAT, ORIGIN_REVERT } from '@md-reader/core'
import { findByOrigin, getRecord, createRecord, touchRecord, migrateLegacyRegistry } from '../doc-registry'
import type { DocRecord } from '../doc-registry'

let migrationOnce: Promise<unknown> | null = null

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
  externalChange: { remoteText: string; remoteHash: string } | null
  acceptExternal(): void
  dismissExternal(): void
}

export function useDocSession(opts: { docId: string | null; fileUrl: string | null }): DocSession {
  const { docId: docIdParam, fileUrl: fileUrlParam } = opts
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [docTitle, setDocTitle] = useState<string>('')
  const [hasContent, setHasContent] = useState(false)
  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [synced, setSynced] = useState<boolean>(false)
  const [record, setRecord] = useState<DocRecord | null>(null)
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
          rec = await getRecord(docIdParam)
          if (!rec) {
            if (!cancelled) setError('Không tìm thấy tài liệu này.')
            return
          }
        } else if (fileUrlParam) {
          rec =
            (await findByOrigin(fileUrlParam)) ??
            (await createRecord({
              title: decodeURIComponent(fileUrlParam.split('/').pop() || 'Untitled.md'),
              originKind: 'url',
              originPath: fileUrlParam,
            }))
          try {
            window.history.replaceState(null, '', '?doc=' + rec.docId)
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

  const persistenceName = record ? record.persistenceName : (!docIdParam && !fileUrlParam ? 'md-reader' : null)

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
    const rec = record
    const whenSynced = persistence ? persistence.whenSynced : Promise.resolve()
    syncedPromiseRef.current = (async () => {
      await whenSynced
      if (rec && !cancelled) {
        ensureDoc(doc, { title: rec.title })
        touchRecord(rec.docId).catch(console.error)
      }
    })()

    const text = doc.getText('source')
    const meta = getMeta(doc)
    const updateTitle = () => {
      // legacy 'name' is still written by FileDrop until 6e4 moves it to 'title'
      const legacy = meta.get('name')
      const t = typeof legacy === 'string' && legacy ? legacy : meta.get('title') !== undefined ? readMeta(doc).title : ''
      if (t) setDocTitle(t.replace(/\.[^/.]+$/, ''))
    }
    const observer = (event: Y.YTextEvent) => {
      setHasContent(text.length > 0)
      if (event.transaction.origin !== ORIGIN_LOAD && event.transaction.origin !== ORIGIN_FORMAT && event.transaction.origin !== ORIGIN_REVERT) {
        setIsDirty(true)
      }
      setContent(text.toString())
      updateTitle()
    }
    text.observe(observer)
    meta.observe(updateTitle)
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
      text.unobserve(observer)
      meta.unobserve(updateTitle)
      if (persistence) {
        persistence.destroy()
      }
    }
  }, [doc, persistenceName, record])

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
        const name = decodeURIComponent(fileUrl.split('/').pop() || 'Untitled.md')
        const local = ytext.toString()
        const applyRemote = (h: string) => {
          doc.transact(() => {
            applyTextChange(ytext, remote, ORIGIN_LOAD)
            meta.set('title', name)
            meta.set('originHash', h)
          }, ORIGIN_LOAD)
          setContent(remote)
          setHasContent(remote.length > 0)
          setIsDirty(false)
        }
        isFileContentSetRef.current = true
        const origin0 = meta.get('originHash') as string | undefined
        if (origin0 == null && local === '') {
          doc.transact(() => {
            applyTextChange(ytext, remote, ORIGIN_LOAD)
            meta.set('title', name)
          }, ORIGIN_LOAD)
          setContent(remote)
          setHasContent(remote.length > 0)
          setIsDirty(false)
          const h0 = await hashText(remote)
          if (!cancelled) meta.set('originHash', h0)
        } else {
          const [h, lh] = await Promise.all([hashText(remote), hashText(local)])
          if (cancelled) return
          const origin = meta.get('originHash') as string | undefined
          if (lh === h) {
            if (origin !== h) meta.set('originHash', h)
            setContent(local)
            setHasContent(local.length > 0)
            setIsDirty(false)
          } else if (origin === h) {
            setContent(local)
            setHasContent(local.length > 0)
            setIsDirty(lh !== origin)
          } else if (lh === origin) {
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
          if (cached && typeof cached[cacheKey] === 'string' && cached[cacheKey].length > 0) {
            loadContent(cached[cacheKey])
            chrome.storage.local.remove(cacheKey).catch(() => {})
          } else {
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
      doc.getMap('meta').set('originHash', ext.remoteHash)
    }, ORIGIN_LOAD)
    setContent(ext.remoteText)
    setHasContent(ext.remoteText.length > 0)
    setIsDirty(false)
    setExternalChange(null)
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
    externalChange,
    acceptExternal,
    dismissExternal,
  }
}
