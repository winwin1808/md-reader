import { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { hashText, applyTextChange, ORIGIN_LOAD, ORIGIN_FORMAT, ORIGIN_REVERT } from '@md-reader/core'
import { addRecentFile } from '../registry'

export interface DocSession {
  doc: Y.Doc; yText: Y.Text; undoManager: Y.UndoManager
  content: string
  title: string
  hasContent: boolean
  isDirty: boolean
  setDirty(dirty: boolean): void
  error: string | null
  setError(message: string | null): void
  synced: boolean
}

export function useDocSession(opts: { fileUrl: string | null }): DocSession {
  const fileUrlParam = opts.fileUrl
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [docTitle, setDocTitle] = useState<string>('')
  const [hasContent, setHasContent] = useState(false)
  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [synced, setSynced] = useState<boolean>(false)
  const isFileContentSetRef = useRef<boolean>(false)

  const persistenceName = useMemo(() => {
    if (!fileUrlParam) return 'md-reader'
    return `md-reader-${encodeURIComponent(fileUrlParam)}`
  }, [fileUrlParam])

  const doc = useMemo(() => new Y.Doc(), [fileUrlParam])
  const yText = useMemo(() => doc.getText('source'), [doc])
  const undoManager = useMemo(() => new Y.UndoManager(yText), [yText])

  useEffect(() => {
    setSynced(false)
    let persistence: IndexeddbPersistence | null = null
    try {
      persistence = new IndexeddbPersistence(persistenceName, doc)
    } catch (err) {
      console.warn('Failed to initialize IndexeddbPersistence:', err)
    }
    
    const text = doc.getText('source')
    const meta = doc.getMap('meta')
    const updateTitle = () => {
      const name = (meta.get('name') as string) || ''
      if (name) {
        setDocTitle(name.replace(/\.[^/.]+$/, ''))
      }
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
      text.unobserve(observer)
      meta.unobserve(updateTitle)
      if (persistence) {
        persistence.destroy()
      }
    }
  }, [doc, persistenceName])

  // Handle URL file param
  useEffect(() => {
    isFileContentSetRef.current = false
    const fileUrl = fileUrlParam
    if (fileUrl) {
      const loadContent = async (text: string) => {
        isFileContentSetRef.current = true
        const ytext = doc.getText('source')
        const name = decodeURIComponent(fileUrl.split('/').pop() || 'Untitled.md')
        doc.transact(() => {
          applyTextChange(ytext, text)
          doc.getMap('meta').set('name', name)
        }, ORIGIN_LOAD)
        setIsDirty(false)
        const originHash = await hashText(text)
        doc.getMap('meta').set('originHash', originHash)
        setDocTitle(name.replace(/\.[^/.]+$/, ''))
        setContent(text)
        setHasContent(text.length > 0)
        setIsDirty(false)
        
        addRecentFile({
          id: fileUrl,
          name,
          lastOpened: Date.now()
        }).catch(console.error)
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
    }
  }, [doc, fileUrlParam])

  return {
    doc, yText, undoManager,
    content,
    title: docTitle,
    hasContent,
    isDirty,
    setDirty: setIsDirty,
    error,
    setError,
    synced,
  }
}
