import { useEffect, useRef, useState } from 'react'
import {
  formatMarkdown, detectConflict, appendHistory, hashText,
  applyTextChange, ORIGIN_FORMAT, ORIGIN_REVERT,
} from '@md-reader/core'
import { saveToHandle, saveFileAs, storeFileHandle } from '../fs/file-system'
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
}

export function useFileSave(session: DocSession, settings: { formatOnSave: boolean }): FileSave {
  const { doc, yText, content, isDirty } = session
  const docTitle = session.title
  const setIsDirty = session.setDirty
  const [activeHandle, setActiveHandle] = useState<FileSystemFileHandle | null>(null)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [conflictData, setConflictData] = useState<{ localContent: string; diskContent: string }>({
    localContent: '',
    diskContent: '',
  })
  const isSavingRef = useRef<boolean>(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setIsDirty(yText.toString() !== savedContent)
    const newHash = await hashText(savedContent)
    doc.getMap('meta').set('originHash', newHash)
    appendHistory(doc, {
      source: savedContent,
      timestamp: Date.now(),
      actor: 'user',
      label: 'save',
      clientIds: [],
    } as any)
  }

  const runSave = async (opts: { explicit?: boolean } | undefined, forcePicker: boolean) => {
    const explicit = opts?.explicit === true
    if (isSavingRef.current) return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    isSavingRef.current = true
    setSaveState({ kind: 'saving' })
    let next: SaveState = { kind: 'idle' }
    try {
      const currentText = yText.toString()
      if (!activeHandle || forcePicker) {
        const suggestedName = docTitle ? (docTitle.endsWith('.md') ? docTitle : `${docTitle}.md`) : 'Untitled.md'
        const res = await saveFileAs(suggestedName, currentText)
        if (res) {
          const handle = res.handle
          setActiveHandle(handle)
          await storeFileHandle(handle).catch(() => {})
          doc.getMap('meta').set('name', handle.name)
          await executeSave(handle, explicit)
          next = { kind: 'saved', at: Date.now() }
        }
        return
      }

      let diskText: string
      try {
        const file = await activeHandle.getFile()
        diskText = await file.text()
      } catch (err) {
        console.warn('Could not read disk file:', err)
        next = { kind: 'error', message: 'Không đọc được file trên đĩa (đã bị xoá hoặc di chuyển?).', canSaveAs: true }
        return
      }

      const currentOriginHash = (doc.getMap('meta').get('originHash') as string) || ''
      const hasConflict = await detectConflict(currentOriginHash, diskText)
      if (hasConflict) {
        setConflictData({ localContent: yText.toString(), diskContent: diskText })
        setIsConflictModalOpen(true)
        next = { kind: 'conflict' }
        return
      }

      await executeSave(activeHandle, explicit)
      next = { kind: 'saved', at: Date.now() }
    } catch (err) {
      console.error('Error saving file:', err)
      next = { kind: 'error', message: (err as Error)?.message || 'Không ghi được file.', canSaveAs: true }
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
      next = { kind: 'error', message: (err as Error)?.message || 'Không ghi được file.', canSaveAs: true }
    } finally {
      isSavingRef.current = false
      setSaveState(next)
    }
  }

  const revertToDisk = async () => {
    setIsConflictModalOpen(false)
    applyTextChange(yText, conflictData.diskContent, ORIGIN_REVERT)
    const diskHash = await hashText(conflictData.diskContent)
    doc.getMap('meta').set('originHash', diskHash)
    setIsDirty(false)
    setSaveState({ kind: 'idle' })
  }

  const closeConflict = () => setIsConflictModalOpen(false)

  // Debounced auto-save (2000ms after last edit if activeHandle exists)
  useEffect(() => {
    if (!isDirty || !activeHandle || saveState.kind === 'conflict') return
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
  }, [isDirty, content, activeHandle, saveState.kind])

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
  }
}
