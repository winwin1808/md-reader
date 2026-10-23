import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  ThemeProvider,
  SettingsModal,
  Viewer,
  Toc,
  ExportModal,
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
import type { ThemeMode, ColorTheme, FontScale, FontFamily, ReaderSettings, ViewMode, FormatAction, EditorView } from '@md-reader/ui'
import {
  parseMarkdown,
  renderToHtml,
  splitIntoSlides,
  extractMindmap,
  applyTextChange,
  computeTextChanges,
} from '@md-reader/core'
import type { MindNode } from '@md-reader/core'
import { FileDrop } from './FileDrop'
import { RecentFiles } from './RecentFiles'
import { openLocalFileAsDoc } from './fs/file-system'
import { useDocSession } from './hooks/useDocSession'
import { useFileSave } from './hooks/useFileSave'
import { useExport } from './hooks/useExport'
import { useShortcuts } from './hooks/useShortcuts'
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
  const [isMindmapOpen, setIsMindmapOpen] = useState<boolean>(false)
  const [urlParams] = useState(() => {
    const sp = new URLSearchParams(window.location.search)
    return { docId: sp.get('doc'), fileUrl: sp.get('file'), kept: sp.get('kept') === '1' }
  })
  const fileUrlParam = urlParams.fileUrl
  const [keptNoticeOpen, setKeptNoticeOpen] = useState<boolean>(urlParams.kept)
  const session = useDocSession({ docId: urlParams.docId, fileUrl: urlParams.fileUrl })
  const { doc, yText, undoManager, content, hasContent, isDirty, error, setError } = session
  const docTitle = session.title
  const fileSave = useFileSave(session, { formatOnSave: readerSettings.autoFormatMd !== false })
  const [viewMode, setViewMode] = useState<ViewMode>('reading')
  const [isPresenting, setIsPresenting] = useState<boolean>(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)
  const [isConfettiActive, setIsConfettiActive] = useState<boolean>(false)
  const hasCelebratedRef = useRef<boolean>(false)
  const editorViewRef = useRef<EditorView | null>(null)

  const isSpeakerMode = new URLSearchParams(window.location.search).get('speaker') === 'true'

  const docContainerRef = useRef<HTMLDivElement | null>(null)


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

  const handleOpenFile = async () => {
    try {
      const res = await openLocalFileAsDoc()
      if (res) window.location.assign('?doc=' + res.docId + (res.kept ? '&kept=1' : ''))
    } catch (err) {
      setError((err as Error)?.message || 'Không mở được file.')
    }
  }

  const handleFormatAction = (action: FormatAction) => {
    const view = editorViewRef.current
    if (view) {
      const { from, to } = view.state.selection.main
      const current = yText.toString()
      const r = applyFormat(current, from, to, action)
      view.dispatch({
        changes: computeTextChanges(current, r.newText).map((c) => ({
          from: c.index,
          to: c.index + c.deleteCount,
          insert: c.insert,
        })),
        selection: { anchor: r.newSelectionStart, head: r.newSelectionEnd },
        userEvent: 'input.format',
        scrollIntoView: true,
      })
      view.focus()
      return
    }

    const activeEl = document.activeElement as HTMLTextAreaElement | null
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      const start = activeEl.selectionStart ?? 0
      const end = activeEl.selectionEnd ?? 0
      const { newText, newSelectionStart, newSelectionEnd } = applyFormat(yText.toString(), start, end, action)
      applyTextChange(yText, newText)
      setTimeout(() => {
        activeEl.focus()
        activeEl.setSelectionRange?.(newSelectionStart, newSelectionEnd)
      }, 0)
    } else {
      const { newText } = applyFormat(yText.toString(), 0, 0, action)
      applyTextChange(yText, newText)
    }
  }

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
    if (!isMindmapOpen) return null
    return extractMindmap(parsedDoc.tree, docTitle || 'Tài liệu không tên')
  }, [parsedDoc.tree, docTitle, isMindmapOpen])

  const handleMindNodeClick = (node: MindNode) => {
    if (node.headingId) {
      const headingEl = document.getElementById(node.headingId)
      if (headingEl) {
        headingEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    setIsMindmapOpen(false)
  }

  const { exportAs, isExporting, isPrintingSlides } = useExport({
    html,
    title: docTitle,
    parseResult: parseResult as any,
  })

  const slides = useMemo(
    () => (isPresenting || isPrintingSlides || isSpeakerMode ? splitIntoSlides(content) : []),
    [content, isPresenting, isPrintingSlides, isSpeakerMode],
  )

  useShortcuts({
    onSearch: () => setIsSearchOpen(true),
    onCloseSearch: () => setIsSearchOpen(false),
    isSearchOpen,
    onToggleMindmap: () => setIsMindmapOpen((prev) => !prev),
    onPresent: () => setIsPresenting(true),
    presentEnabled: !isPresenting && !isSpeakerMode,
  })

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
                (session.docId
                  ? '?doc=' + encodeURIComponent(session.docId) + '&speaker=true'
                  : '?speaker=true' + (fileUrlParam ? '&file=' + encodeURIComponent(fileUrlParam) : '')),
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
      {mindmapRoot && (
        <MindmapModal
          root={mindmapRoot}
          isOpen={isMindmapOpen}
          onClose={() => setIsMindmapOpen(false)}
          onNodeClick={handleMindNodeClick}
          title={docTitle}
        />
      )}
      <ConflictModal
        isOpen={fileSave.conflict.open}
        fileName={fileSave.activeHandle?.name || docTitle || 'document.md'}
        localContent={fileSave.conflict.localContent}
        diskContent={fileSave.conflict.diskContent}
        baseContent={fileSave.conflict.baseContent}
        onKeepLocal={fileSave.keepLocal}
        onRevertToDisk={fileSave.revertToDisk}
        onClose={fileSave.closeConflict}
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
          onSave={() => fileSave.save({ explicit: true })}
          rightActions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => { void handleOpenFile() }}>Mở file…</button>
              <ExportModal onExport={exportAs} isExporting={isExporting} />
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
        <FileDrop>
          {session.externalChange && (
            <div className="error-banner" style={{ color: '#b45309', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '16px 20px', margin: '20px auto', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 600 }}>File gốc đã thay đổi kể từ lần mở trước.</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={session.acceptExternal}>Tải bản mới</button>
                <button type="button" onClick={session.dismissExternal}>Giữ bản đang sửa</button>
              </div>
            </div>
          )}
          {keptNoticeOpen && (
            <div className="error-banner" style={{ color: '#b45309', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '16px 20px', margin: '20px auto', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 600 }}>Tài liệu này đang có bản sửa chưa lưu nên chưa nạp lại từ đĩa. Khi lưu, bạn sẽ thấy phần khác nhau để chọn.</div>
              <div>
                <button type="button" onClick={() => setKeptNoticeOpen(false)}>Đã hiểu</button>
              </div>
            </div>
          )}
          {fileSave.saveState.kind === 'needs-permission' && (
            <div className="error-banner" style={{ color: '#b45309', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '16px 20px', margin: '20px auto', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 600 }}>Cần cấp lại quyền ghi cho {fileSave.saveState.fileName}.</div>
              <div>
                <button type="button" onClick={() => { void fileSave.grantPermission() }}>Cấp quyền</button>
              </div>
            </div>
          )}
          {fileSave.saveState.kind === 'error' && (
            <div className="error-banner" style={{ color: '#dc2626', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '16px 20px', margin: '20px auto', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 600 }}>{fileSave.saveState.message}</div>
              {fileSave.saveState.canSaveAs && (
                <div>
                  <button type="button" onClick={() => { void fileSave.saveAs() }}>Lưu thành…</button>
                </div>
              )}
            </div>
          )}
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
              <button type="button" onClick={() => { void handleOpenFile() }}>Mở file…</button>
              <RecentFiles />
            </div>
          )}
        </FileDrop>
      </div>
    </ThemeProvider>
  )
}
