import React, { useEffect, useState, useMemo, useRef } from 'react'
import { flushSync } from 'react-dom'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import {
  ThemeProvider,
  SettingsModal,
  Viewer,
  Toc,
  ExportModal,
  printDocument,
  printSlides,
  getDefaultExportCss,
  ReadingProgress,
  TopToolbar,
  DocumentSearch,
  Deck,
  SpeakerView,
  WordCountBar,
  CelebrationConfetti,
  MindmapModal,
  Editor,
  SplitViewContainer,
  ConflictModal,
  FormattingToolbar,
  applyFormat,
} from "@md-reader/ui"
import type { ThemeMode, ColorTheme, ExportFormat, FontScale, FontFamily, ReaderSettings, ViewMode, FormatAction, EditorView } from '@md-reader/ui'
import {
  parseMarkdown,
  renderToHtml,
  exportToHtml,
  mdastToDocx,
  splitIntoSlides,
  extractMindmap,
  formatMarkdown,
  detectConflict,
  appendHistory,
  hashText,
} from '@md-reader/core'
import type { MindNode } from '@md-reader/core'
import { FileDrop } from './FileDrop'
import { RecentFiles } from './RecentFiles'
import { addRecentFile } from './registry'
import { saveToHandle, saveFileAs, storeFileHandle } from './fs/file-system'
import './app.css'

const DEFAULT_READER_SETTINGS: ReaderSettings = {
  mode: 'system',
  colorTheme: 'black',
  fontFamily: 'sans',
  autoFormatMd: true,
  alwaysOpenApp: false,
  stripFrontmatter: true,
  displayMetadata: false,
  advancedTables: true,
  taskLists: true,
  enableMath: true,
  enableMermaid: true,
  enablePlantUml: false,
  enableGraphviz: false,
  githubAlerts: true,
  localizeAlerts: false,
  typographer: false,
  externalLinks: false,
  showWordCount: true,
  autoHideWordCount: true,
  showReadingProgress: true,
  celebrationConfetti: true,
}

export function App(): React.JSX.Element {
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS)
  const [fontScale, setFontScale] = useState<FontScale>('md')
  const [tocOpen, setTocOpen] = useState<boolean>(true)
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false)
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [isMindmapOpen, setIsMindmapOpen] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [docTitle, setDocTitle] = useState<string>('')
  // Re-render when doc text changes to hide placeholder
  const [hasContent, setHasContent] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('reading')
  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [activeHandle, setActiveHandle] = useState<FileSystemFileHandle | null>(null)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false)
  const [conflictData, setConflictData] = useState<{ localContent: string; diskContent: string }>({
    localContent: '',
    diskContent: '',
  })
  const [isPresenting, setIsPresenting] = useState<boolean>(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)
  const [isPrintingSlides, setIsPrintingSlides] = useState<boolean>(false)
  const [isConfettiActive, setIsConfettiActive] = useState<boolean>(false)
  const hasCelebratedRef = useRef<boolean>(false)
  const isSavingRef = useRef<boolean>(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorViewRef = useRef<EditorView | null>(null)

  const isSpeakerMode = new URLSearchParams(window.location.search).get('speaker') === 'true'
  const fileUrlParam = new URLSearchParams(window.location.search).get('file')

  const slides = useMemo(() => splitIntoSlides(content), [content])

  const docContainerRef = useRef<HTMLDivElement | null>(null)
  const isFileContentSetRef = useRef<boolean>(false)

  const persistenceName = useMemo(() => {
    if (!fileUrlParam) return 'md-reader'
    return `md-reader-${encodeURIComponent(fileUrlParam)}`
  }, [fileUrlParam])

  const doc = useMemo(() => new Y.Doc(), [fileUrlParam])
  const yText = useMemo(() => doc.getText('source'), [doc])
  const undoManager = useMemo(() => new Y.UndoManager(yText), [yText])
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel('md-reader-slides-sync')
    channelRef.current = channel

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE' && typeof event.data.index === 'number') {
        setCurrentSlideIndex(event.data.index)
      }
    }

    channel.onmessage = handleMessage
    channel.addEventListener?.('message', handleMessage)

    return () => {
      channel.removeEventListener?.('message', handleMessage)
      channel.close()
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (
        (e.key === 'p' || e.key === 'P') &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isInput &&
        !isPresenting &&
        !isSpeakerMode
      ) {
        e.preventDefault()
        setIsPresenting(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPresenting, isSpeakerMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setIsSearchOpen(true)
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setIsMindmapOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
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
      if (event.transaction.origin !== 'save-format' && event.transaction.origin !== 'load-file') {
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

  useEffect(() => {
    hasCelebratedRef.current = false
    setIsConfettiActive(false)
  }, [content])

  useEffect(() => {
    if (!isConfettiActive) return
    const timer = setTimeout(() => {
      setIsConfettiActive(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [isConfettiActive])

  useEffect(() => {
    if (!content || readerSettings?.celebrationConfetti === false) return

    const handleScroll = () => {
      if (hasCelebratedRef.current) return
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        hasCelebratedRef.current = true
        setIsConfettiActive(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [content, readerSettings?.celebrationConfetti])

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        let localRes: any = {}
        let syncRes: any = {}
        if (typeof chrome.storage?.local?.get === 'function') {
          localRes = (await chrome.storage.local.get(null)) || {}
        }
        if (typeof chrome.storage?.sync?.get === 'function') {
          syncRes = (await chrome.storage.sync.get(null)) || {}
        }
        const mode =
          (localRes?.mode as ThemeMode) ||
          (localRes?.theme as ThemeMode) ||
          (syncRes?.mode as ThemeMode) ||
          (syncRes?.theme as ThemeMode) ||
          DEFAULT_READER_SETTINGS.mode
        const colorTheme =
          (localRes?.colorTheme as ColorTheme) ||
          (syncRes?.colorTheme as ColorTheme) ||
          DEFAULT_READER_SETTINGS.colorTheme
        setReaderSettings({
          ...DEFAULT_READER_SETTINGS,
          ...syncRes,
          ...localRes,
          mode,
          colorTheme,
        })
        setFontScale((localRes?.fontScale as FontScale) || (syncRes?.fontScale as FontScale) || 'md')
      } catch (err) {
        setReaderSettings(DEFAULT_READER_SETTINGS)
        setFontScale('md')
      }
    }
    fetchSettings()
  }, [])

  // Handle URL file param
  useEffect(() => {
    isFileContentSetRef.current = false
    const fileUrl = fileUrlParam
    if (fileUrl) {
      const loadContent = async (text: string) => {
        isFileContentSetRef.current = true
        const ytext = doc.getText('source')
        doc.transact(() => {
          ytext.delete(0, ytext.length)
          ytext.insert(0, text)
        }, 'load-file')
        setIsDirty(false)
        const name = decodeURIComponent(fileUrl.split('/').pop() || 'Untitled.md')
        doc.getMap('meta').set('name', name)
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

  const executeSave = async (handle: FileSystemFileHandle, _textToSave?: string) => {
    const textBeforeFormat = yText.toString()
    const formattedText =
      readerSettings?.autoFormatMd !== false ? formatMarkdown(textBeforeFormat) : textBeforeFormat
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

  const handleSave = async () => {
    if (isSavingRef.current) return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    isSavingRef.current = true
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
            setDocTitle(handle.name.replace(/\.[^/.]+$/, ''))
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
    }
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  const handleKeepLocal = async () => {
    setIsConflictModalOpen(false)
    if (activeHandle) {
      await executeSave(activeHandle)
    }
  }

  const handleRevertToDisk = async () => {
    setIsConflictModalOpen(false)
    doc.transact(() => {
      yText.delete(0, yText.length)
      yText.insert(0, conflictData.diskContent)
    }, 'load-file')
    const diskHash = await hashText(conflictData.diskContent)
    doc.getMap('meta').set('originHash', diskHash)
    setIsDirty(false)
  }

  const handleFormatAction = (action: FormatAction) => {
    const view = editorViewRef.current
    if (view) {
      const { from, to } = view.state.selection.main
      const current = yText.toString()
      const { newText, newSelectionStart, newSelectionEnd } = applyFormat(current, from, to, action)
      doc.transact(() => {
        yText.delete(0, yText.length)
        yText.insert(0, newText)
      })
      view.dispatch({
        selection: { anchor: newSelectionStart, head: newSelectionEnd },
        scrollIntoView: true,
      })
      view.focus()
      return
    }

    const activeEl = document.activeElement as HTMLTextAreaElement | null
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      const start = activeEl.selectionStart ?? 0
      const end = activeEl.selectionEnd ?? 0
      const current = yText.toString()
      const { newText, newSelectionStart, newSelectionEnd } = applyFormat(current, start, end, action)
      doc.transact(() => {
        yText.delete(0, yText.length)
        yText.insert(0, newText)
      })
      setTimeout(() => {
        activeEl.focus()
        activeEl.setSelectionRange?.(newSelectionStart, newSelectionEnd)
      }, 0)
    } else {
      const current = yText.toString()
      const { newText } = applyFormat(current, 0, 0, action)
      doc.transact(() => {
        yText.delete(0, yText.length)
        yText.insert(0, newText)
      })
    }
  }

  // Debounced auto-save (2000ms after last edit if activeHandle exists)
  useEffect(() => {
    if (!isDirty || !activeHandle) return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      handleSaveRef.current()
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
        handleSaveRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSettingChange = (key: string, value: any) => {
    setReaderSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    try {
      chrome.storage?.sync?.set?.({ [key]: value })
      chrome.storage?.local?.set?.({ [key]: value })
    } catch (err) {
      // ignore
    }
  }

  const handleModeChange = (mode: ThemeMode) => {
    handleSettingChange('mode', mode)
  }

  const handleColorThemeChange = (color: ColorTheme) => {
    handleSettingChange('colorTheme', color)
  }

  const { html, toc, parseResult, parsedDoc } = useMemo(() => {
    if (!content) {
      const emptyTree = { type: 'root', children: [] } as any
      return {
        html: '',
        toc: [],
        parseResult: { ast: emptyTree },
        parsedDoc: { tree: emptyTree },
      }
    }
    const parsed = parseMarkdown(content)
    const rendered = renderToHtml(parsed, {
      stripFrontmatter: readerSettings?.stripFrontmatter,
      displayMetadata: readerSettings?.displayMetadata,
      typographer: readerSettings?.typographer,
      externalLinks: readerSettings?.externalLinks,
      githubAlerts: readerSettings?.githubAlerts,
      localizeAlerts: readerSettings?.localizeAlerts ? 'vi' : 'en',
    })
    return {
      html: rendered.html,
      toc: rendered.toc,
      parseResult: { ast: parsed.tree, ...parsed },
      parsedDoc: parsed,
    }
  }, [content, readerSettings])

  const mindmapRoot = useMemo(() => {
    return extractMindmap(parsedDoc.tree, docTitle || 'Tài liệu không tên')
  }, [parsedDoc.tree, docTitle])

  const handleMindNodeClick = (node: MindNode) => {
    if (node.headingId) {
      const headingEl = document.getElementById(node.headingId)
      if (headingEl) {
        headingEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    setIsMindmapOpen(false)
  }

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true)
    try {
      const title = docTitle || 'document'
      if (format === 'pdf') {
        printDocument()
      } else if (format === 'slide-pdf') {
        flushSync(() => {
          setIsPrintingSlides(true)
        })
        printSlides()
        const cleanup = () => {
          setIsPrintingSlides(false)
          window.removeEventListener('afterprint', cleanup)
        }
        window.addEventListener('afterprint', cleanup)
        setTimeout(cleanup, 1000)
      } else if (format === 'html') {
        const exportHtml = await exportToHtml({ html, cssContent: getDefaultExportCss(), title })
        const blob = new Blob([exportHtml], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else if (format === 'docx') {
        const blob = await mdastToDocx({ mdast: parseResult.ast, title })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } finally {
      setIsExporting(false)
    }
  }

  if (isSpeakerMode) {
    return (
      <SpeakerView
        slides={slides}
        currentSlideIndex={currentSlideIndex}
        onSlideChange={(idx) => {
          setCurrentSlideIndex(idx)
          channelRef.current?.postMessage({ type: 'NAVIGATE', index: idx })
        }}
      />
    )
  }

  const themeMode = readerSettings.mode || 'system'
  const colorTheme = readerSettings.colorTheme

  return (
    <ThemeProvider mode={themeMode} colorTheme={colorTheme} onModeChange={handleModeChange} onColorThemeChange={handleColorThemeChange}>
      {isPrintingSlides && (
        <div className="deck-print-container" aria-hidden="true">
          {slides.map((slide, idx) => (
            <div key={slide.id || idx} className="deck-print-slide md-viewer">
              <div className="deck-slide-content" dangerouslySetInnerHTML={{ __html: slide.html }} />
            </div>
          ))}
        </div>
      )}
      {isPresenting && (
        <Deck
          slides={slides}
          initialSlide={currentSlideIndex}
          onClose={() => setIsPresenting(false)}
          onSlideChange={(idx) => {
            setCurrentSlideIndex(idx)
            channelRef.current?.postMessage({ type: 'NAVIGATE', index: idx })
          }}
          onOpenSpeakerView={() =>
            window.open(
              window.location.pathname +
                '?speaker=true' +
                (fileUrlParam ? '&file=' + encodeURIComponent(fileUrlParam) : ''),
              'md-speaker',
              'width=1080,height=680'
            )
          }
          colorTheme={colorTheme}
          mode={themeMode}
          presentationSettings={{
            slideBgColor: readerSettings.slideBgColor,
            slideTextColor: readerSettings.slideTextColor,
            slideHeadingColor: readerSettings.slideHeadingColor,
            slideAccentColor: readerSettings.slideAccentColor,
            slideFont: readerSettings.slideFont,
            slideBgImage: readerSettings.slideBgImage,
            slideImageOpacity: readerSettings.slideImageOpacity,
          }}
        />
      )}
      <DocumentSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} containerRef={docContainerRef} />
      <MindmapModal
        root={mindmapRoot}
        isOpen={isMindmapOpen}
        onClose={() => setIsMindmapOpen(false)}
        onNodeClick={handleMindNodeClick}
        title={docTitle}
      />
      <ConflictModal
        isOpen={isConflictModalOpen}
        fileName={activeHandle?.name || docTitle || 'document.md'}
        localContent={conflictData.localContent}
        diskContent={conflictData.diskContent}
        onKeepLocal={handleKeepLocal}
        onRevertToDisk={handleRevertToDisk}
        onClose={() => setIsConflictModalOpen(false)}
      />
      <div className={`app-container${isReadingMode ? ' reading-mode' : ''}`} data-font-scale={fontScale} data-font-family={readerSettings.fontFamily}>
        {readerSettings.showReadingProgress !== false && <ReadingProgress />}
        <WordCountBar
          text={content}
          visible={readerSettings.showWordCount !== false}
          autoHide={readerSettings.autoHideWordCount !== false}
        />
        <CelebrationConfetti
          active={isConfettiActive}
          onComplete={() => setIsConfettiActive(false)}
        />
        <TopToolbar
          title={docTitle || 'Tài liệu không tên'}
          tocOpen={tocOpen}
          onToggleToc={() => setTocOpen(!tocOpen)}
          fontScale={fontScale}
          onFontScaleChange={(scale) => {
            setFontScale(scale)
            chrome.storage?.sync?.set?.({ fontScale: scale })
          }}
          isReadingMode={isReadingMode}
          onToggleReadingMode={() => setIsReadingMode(!isReadingMode)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onPresent={() => setIsPresenting(true)}
          onOpenMindmap={() => setIsMindmapOpen(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isDirty={isDirty}
          onSave={handleSave}
          rightActions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <ExportModal onExport={handleExport} isExporting={isExporting} />
              <SettingsModal
                settings={readerSettings}
                onSettingChange={handleSettingChange}
              />
            </div>
          }
        />
        {isReadingMode && (
          <button
            className="exit-reading-mode-btn md-no-print"
            onClick={() => setIsReadingMode(false)}
          >
            Thoát đọc tập trung ✕
          </button>
        )}
        <FileDrop doc={doc}>
          {error && (
            <div style={{ color: '#dc2626', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '16px 20px', margin: '20px auto', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 600 }}>{error}</div>
              {fileUrlParam?.startsWith('file:') && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        chrome.tabs?.create?.({ url: 'chrome://extensions/?id=' + (chrome.runtime?.id || '') })
                      } catch {
                        window.open('chrome://extensions')
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#0070f3',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    Mở Cài đặt Tiện ích để Bật "Cho phép truy cập vào các URL tệp"
                  </button>
                </div>
              )}
            </div>
          )}
          
          {viewMode === 'reading' && hasContent && (
            <div className={`app-layout ${(!tocOpen || isReadingMode || !toc || toc.length === 0) ? 'single-column' : ''}`}>
              <div className="main-content" data-font-scale={fontScale}>
                <div ref={docContainerRef} className="a4-document-container">
                  <Viewer html={html} />
                </div>
              </div>
              {toc && toc.length > 0 && tocOpen && !isReadingMode && (
                <div className="sidebar-toc">
                  <Toc entries={toc} />
                </div>
              )}
            </div>
          )}

          {viewMode === 'editor' && (
            <div className="editor-mode-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 'calc(100vh - 48px)' }}>
              <FormattingToolbar onAction={handleFormatAction} />
              <div style={{ flex: 1, overflow: 'auto' }}>
                <Editor yText={yText} undoManager={undoManager} editorViewRef={editorViewRef} />
              </div>
            </div>
          )}

          {viewMode === 'split' && (
            <div className="split-mode-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 'calc(100vh - 48px)' }}>
              <FormattingToolbar onAction={handleFormatAction} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <SplitViewContainer
                  mode="split"
                  editor={<Editor yText={yText} undoManager={undoManager} editorViewRef={editorViewRef} />}
                  preview={
                    <div ref={docContainerRef} className="a4-document-container" style={{ height: '100%', overflow: 'auto' }}>
                      <Viewer html={html} />
                    </div>
                  }
                />
              </div>
            </div>
          )}

          {viewMode === 'reading' && !hasContent && !error && (
            <div data-testid="app-placeholder" style={{ padding: '40px', textAlign: 'center' }}>
              <h2>MD Reader</h2>
              <p>Drag and drop a Markdown file here, or click "Open in MD Reader" from any Markdown file in Chrome.</p>
              <RecentFiles />
            </div>
          )}
        </FileDrop>
      </div>
    </ThemeProvider>
  )
}
