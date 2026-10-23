import { useEffect, useRef, useState } from 'react'
import { formatMarkdown, detectConflict, appendHistory, hashText } from '@md-reader/core'
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
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [conflictData, setConflictData] = useState<{ localContent: string; diskContent: string }>({
    localContent: '',
    diskContent: '',
  })
  const isSavingRef = useRef<boolean>(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const executeSave = async (handle: FileSystemFileHandle, _textToSave?: string) => {
    const textBeforeFormat = yText.toString()
    const formattedText = settings.formatOnSave ? formatMarkdown(textBeforeFormat) : textBeforeFormat
    let savedContent = textBeforeFormat
    if (formattedText !== textBeforeFormat) {
      if (yText.toString() === textBeforeFormat) {
        doc.transact(() => {
          yText.delete(0, yText.length)
          yText.insert(0, formattedText)
        }, 'save-format')
        savedContent = formattedText
      }
    }
    await saveToHandle(handle, savedContent)
    const newHash = await hashText(savedContent)
    doc.getMap('meta').set('originHash', newHash)
    appendHistory(doc, {
      source: savedContent,
      timestamp: Date.now(),
      actor: 'user',
      label: 'save',
      clientIds: [],
    } as any)
    setIsDirty(yText.toString() !== savedContent)
  }

  const save = async (_opts?: { explicit?: boolean }) => {
    if (isSavingRef.current) return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    isSavingRef.current = true
    setIsSaving(true)
    try {
      const currentText = yText.toString()
      if (!activeHandle) {
        const suggestedName = docTitle ? (docTitle.endsWith('.md') ? docTitle : `${docTitle}.md`) : 'Untitled.md'
        try {
          const res = await saveFileAs(suggestedName, currentText)
          if (res) {
            const handle = res.handle
            setActiveHandle(handle)
            await storeFileHandle(handle).catch(() => {})
            doc.getMap('meta').set('name', handle.name)
            await executeSave(handle)
          }
        } catch (err) {
          console.error('Error saving file as:', err)
        }
        return
      }

      let diskText = ''
      try {
        const file = await activeHandle.getFile()
        diskText = await file.text()
      } catch (err) {
        console.warn('Could not read disk file for conflict check:', err)
      }

      const currentOriginHash = (doc.getMap('meta').get('originHash') as string) || ''
      const hasConflict = await detectConflict(currentOriginHash, diskText)
      if (hasConflict) {
        setConflictData({
          localContent: yText.toString(),
          diskContent: diskText,
        })
        setIsConflictModalOpen(true)
        return
      }

      await executeSave(activeHandle)
    } catch (err) {
      console.error('Error saving file:', err)
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  const saveRef = useRef(save)
  saveRef.current = save

  const keepLocal = async () => {
    setIsConflictModalOpen(false)
    if (activeHandle) {
      await executeSave(activeHandle)
    }
  }

  const revertToDisk = async () => {
    setIsConflictModalOpen(false)
    doc.transact(() => {
      yText.delete(0, yText.length)
      yText.insert(0, conflictData.diskContent)
    }, 'load-file')
    const diskHash = await hashText(conflictData.diskContent)
    doc.getMap('meta').set('originHash', diskHash)
    setIsDirty(false)
  }

  const closeConflict = () => setIsConflictModalOpen(false)

  // Debounced auto-save (2000ms after last edit if activeHandle exists)
  useEffect(() => {
    if (!isDirty || !activeHandle) return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      saveRef.current()
    }, 2000)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [isDirty, content, activeHandle])

  // Global keyboard shortcut for Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const saveState: SaveState = isSaving
    ? { kind: 'saving' }
    : isConflictModalOpen
      ? { kind: 'conflict' }
      : { kind: 'idle' }

  return {
    activeHandle,
    saveState,
    save,
    conflict: { open: isConflictModalOpen, ...conflictData },
    keepLocal,
    revertToDisk,
    closeConflict,
  }
}
