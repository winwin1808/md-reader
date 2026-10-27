import { useEffect, useRef, useState } from 'react'
import { useT } from '@md-reader/ui'
import {
  formatMarkdown, detectConflict, hashText,
  applyTextChange, ORIGIN_FORMAT, ORIGIN_REVERT,
} from '@md-reader/core'
import { saveToHandle, saveFileAs } from '../fs/file-system'
import { storeHandle, getHandle, storeBase, getBase } from '../doc-registry'
import type { DocSession } from './useDocSession'

export type SaveState =
  | { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string; canSaveAs: boolean }
  | { kind: 'conflict' } | { kind: 'needs-permission'; fileName: string }

export interface FileSave {
  activeHandle: FileSystemFileHandle | null
  saveState: SaveState
  save(opts?: { explicit?: boolean }): Promise<void>
  saveAs(): Promise<void>
  conflict: { open: boolean; localContent: string; diskContent: string; baseContent?: string }
  keepLocal(): Promise<void>
  revertToDisk(): Promise<void>
  closeConflict(): void
  grantPermission(): Promise<void>
}

export function useFileSave(session: DocSession, settings: { formatOnSave: boolean }): FileSave {
  const t = useT()
  const { doc, yText, content, isDirty } = session
  const docTitle = session.title
  const setIsDirty = session.setDirty
  const [activeHandle, setActiveHandle] = useState<FileSystemFileHandle | null>(null)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [conflictData, setConflictData] = useState<{ localContent: string; diskContent: string; baseContent?: string }>({
    localContent: '',
    diskContent: '',
  })
  const isSavingRef = useRef<boolean>(false)
  const savedContentRef = useRef<string | null>(null)
  const pendingHandleRef = useRef<FileSystemFileHandle | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const record = session.record
  const sessionDocId = session.docId
  useEffect(() => {
    setActiveHandle(null)
    pendingHandleRef.current = null
    setSaveState((s) => (s.kind === 'needs-permission' ? { kind: 'idle' } : s))
    if (!record || !record.hasHandle || !sessionDocId) return
    let cancelled = false
    void (async () => {
      try {
        const h = await getHandle(sessionDocId)
        if (!h || cancelled) return
        const p = await (h as any).queryPermission({ mode: 'readwrite' })
        if (cancelled) return
        if (p === 'granted') {
          pendingHandleRef.current = null
          setActiveHandle(h)
        } else {
          pendingHandleRef.current = h
          setSaveState({ kind: 'needs-permission', fileName: h.name })
        }
      } catch (err) {
        console.warn('Could not restore file handle:', err)
      }
    })()
    return () => { cancelled = true }
  }, [record, sessionDocId])

  const requestGrant = async (): Promise<FileSystemFileHandle | null> => {
    const h = pendingHandleRef.current
    if (!h) return null
    let r: string
    try {
      r = await (h as any).requestPermission({ mode: 'readwrite' })
    } catch (err) {
      console.warn('requestPermission failed:', err)
      return null
    }
    if (r === 'granted') {
      pendingHandleRef.current = null
      setActiveHandle(h)
      setSaveState({ kind: 'idle' })
      return h
    }
    return null
  }
  const grantPermission = async () => { await requestGrant() }

  const rememberBase = (text: string) => {
    if (!session.docId) return
    void Promise.resolve(storeBase(session.docId, text)).catch((err) => console.warn('storeBase failed:', err))
  }

  const executeSave = async (handle: FileSystemFileHandle, explicit = false) => {
    const textBeforeFormat = yText.toString()
    const formattedText = explicit && settings.formatOnSave ? formatMarkdown(textBeforeFormat) : textBeforeFormat
    let savedContent = textBeforeFormat
    if (formattedText !== textBeforeFormat) {
      if (yText.toString() === textBeforeFormat) {
        applyTextChange(yText, formattedText, ORIGIN_FORMAT)
        savedContent = formattedText
      }
    }
    await saveToHandle(handle, savedContent)
    savedContentRef.current = savedContent
    setIsDirty(yText.toString() !== savedContent)
    const newHash = await hashText(savedContent)
    doc.getMap('meta').set('originHash', newHash)
    rememberBase(savedContent)
    session.ackAi(savedContent)
    // Accepted: the snapshot may include keystrokes typed during the disk write.
    // Autosave stays quiet: the 30 s quiet 'auto' checkpoint covers typing sessions.
    if (explicit) session.checkpoints?.flush('save', 'Bạn', { force: true })
  }

  const runSave = async (opts: { explicit?: boolean } | undefined, forcePicker: boolean) => {
    const explicit = opts?.explicit === true
    if (isSavingRef.current) return
    let handleNow = activeHandle
    if (!handleNow && !forcePicker && pendingHandleRef.current) {
      handleNow = await requestGrant()
      if (!handleNow) return
    }
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    isSavingRef.current = true
    setSaveState({ kind: 'saving' })
    let next: SaveState = { kind: 'idle' }
    try {
      const currentText = yText.toString()
      if (!handleNow || forcePicker) {
        const suggestedName = docTitle ? (docTitle.endsWith('.md') ? docTitle : `${docTitle}.md`) : 'Untitled.md'
        const res = await saveFileAs(suggestedName, currentText)
        if (res) {
          const handle = res.handle
          await executeSave(handle, explicit)
          setActiveHandle(handle)
          if (session.docId) await storeHandle(session.docId, handle).catch(() => {})
          doc.getMap('meta').set('title', handle.name)
          next = { kind: 'saved', at: Date.now() }
        }
        return
      }

      let diskText: string
      try {
        const file = await handleNow.getFile()
        diskText = await file.text()
      } catch (err) {
        console.warn('Could not read disk file:', err)
        next = { kind: 'error', message: t('ext.save.readFailed'), canSaveAs: true }
        return
      }

      const currentOriginHash = (doc.getMap('meta').get('originHash') as string) || ''
      const hasConflict = await detectConflict(currentOriginHash, diskText)
      if (hasConflict) {
        let baseContent: string | undefined
        try {
          baseContent = (session.docId ? await getBase(session.docId) : null) ?? undefined
        } catch (err) {
          console.warn('getBase failed:', err)
        }
        setConflictData({ localContent: yText.toString(), diskContent: diskText, baseContent })
        setIsConflictModalOpen(true)
        next = { kind: 'conflict' }
        return
      }

      await executeSave(handleNow, explicit)
      next = { kind: 'saved', at: Date.now() }
    } catch (err) {
      console.error('Error saving file:', err)
      next = { kind: 'error', message: (err as Error)?.message || t('ext.save.writeFailed'), canSaveAs: true }
    } finally {
      isSavingRef.current = false
      setSaveState(next)
    }
  }

  const save = (opts?: { explicit?: boolean }) => runSave(opts, false)
  const saveAs = () => runSave({ explicit: true }, true)

  const saveRef = useRef(save)
  saveRef.current = save

  const keepLocal = async () => {
    if (isSavingRef.current) return
    setIsConflictModalOpen(false)
    if (!activeHandle) return
    isSavingRef.current = true
    setSaveState({ kind: 'saving' })
    let next: SaveState = { kind: 'idle' }
    try {
      await executeSave(activeHandle, true)
      next = { kind: 'saved', at: Date.now() }
    } catch (err) {
      next = { kind: 'error', message: (err as Error)?.message || t('ext.save.writeFailed'), canSaveAs: true }
    } finally {
      isSavingRef.current = false
      setSaveState(next)
    }
  }

  const revertToDisk = async () => {
    setIsConflictModalOpen(false)
    session.checkpoints?.flush('auto', 'Bạn')
    applyTextChange(yText, conflictData.diskContent, ORIGIN_REVERT)
    session.checkpoints?.flush('import', 'Bạn', { force: true })
    const diskHash = await hashText(conflictData.diskContent)
    doc.getMap('meta').set('originHash', diskHash)
    rememberBase(conflictData.diskContent)
    setIsDirty(false)
    setSaveState({ kind: 'idle' })
  }

  const closeConflict = () => setIsConflictModalOpen(false)

  // Debounced auto-save (2000ms after last edit if activeHandle exists)
  useEffect(() => {
    if (!isDirty || session.aiUnsaved || !activeHandle || saveState.kind === 'conflict' || saveState.kind === 'error' || saveState.kind === 'needs-permission') return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      saveRef.current({ explicit: false })
    }, 2000)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [isDirty, session.aiUnsaved, content, activeHandle, saveState.kind])

  // Saved -> idle once the user edits again
  useEffect(() => {
    if (saveState.kind === 'saved' && isDirty && content !== savedContentRef.current) {
      setSaveState({ kind: 'idle' })
    }
  }, [isDirty, content, saveState.kind])

  // Global keyboard shortcut for Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        saveRef.current({ explicit: true })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    activeHandle,
    saveState,
    save,
    saveAs,
    conflict: { open: isConflictModalOpen, ...conflictData },
    keepLocal,
    revertToDisk,
    closeConflict,
    grantPermission,
  }
}
