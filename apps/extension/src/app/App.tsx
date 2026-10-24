import React, { Suspense, useEffect, useState, useMemo, useRef } from 'react'
import {
  ThemeProvider,
  SettingsModal,
  Viewer,
  Toc,
  ExportModal,
  ReadingProgress,
  TopToolbar,
  DocumentSearch,
  SpeakerView,
  WordCountBar,
  CelebrationConfetti,
  MindmapModal,
  ConflictModal,
  FormattingToolbar,
  applyFormat,
  Icon,
  Logo,
} from "@md-reader/ui"
const Editor = React.lazy(() => import('@md-reader/ui/editor').then(m => ({ default: m.Editor })))
const SplitViewContainer = React.lazy(() => import('@md-reader/ui/split-view').then(m => ({ default: m.SplitViewContainer })))
const Deck = React.lazy(() => import('@md-reader/ui/deck').then(m => ({ default: m.Deck })))
const LazyFallback = () => <div className="lazy-fallback" aria-busy="true" />
import { inlineMermaid } from '@md-reader/ui'
import type { ExportFormat } from '@md-reader/ui'
import { flushSync } from 'react-dom'
import type { ThemeMode, FontScale, FontFamily, ReaderSettings, ViewMode, FormatAction, EditorView, SaveStatus, ToolbarAction } from '@md-reader/ui'
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

const persistSettings = (patch: Record<string, any>) => {
  try {
    chrome.storage?.sync?.set?.(patch)
    chrome.storage?.local?.set?.(patch)
  } catch (err) {
    // ignore
  }
}

const DEFAULT_READER_SETTINGS: ReaderSettings = {
  mode: 'system',
  contrast: 'standard',
  settingsVersion: 2,
  fontFamily: 'serif',
  autoFormatMd: true,
  alwaysOpenApp: false,
  stripFrontmatter: true,
  displayMetadata: false,
  enableMath: true,
  enableMermaid: true,
  githubAlerts: true,
  localizeAlerts: false,
  typographer: false,
  externalLinks: false,
  showWordCount: true,
  autoHideWordCount: true,
  showReadingProgress: true,
  celebrationConfetti: false,
}

export function App(): React.JSX.Element {
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS)
  const [fontScale, setFontScale] = useState<FontScale>('md')
  const [tocRailOpen, setTocRailOpen] = useState<boolean>(true)
  const [tocDrawerOpen, setTocDrawerOpen] = useState<boolean>(false)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const [narrow, setNarrow] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1080px)').matches)
  const drawerRef = useRef<HTMLDivElement>(null)
  const tocWasOpenRef = useRef(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 1080px)')
    const onChange = () => { setNarrow(mq.matches); if (!mq.matches) setTocDrawerOpen(false) }
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const drawerOpen = narrow && tocDrawerOpen
  const tocOpen = narrow ? tocDrawerOpen : tocRailOpen
  useEffect(() => {
    if (drawerOpen) {
      tocWasOpenRef.current = true
      const d = drawerRef.current
      const target = d?.querySelector<HTMLElement>('a[aria-current="location"]') ?? d?.querySelector<HTMLElement>('a')
      target?.focus()
    } else if (tocWasOpenRef.current) {
      tocWasOpenRef.current = false
      document.querySelector<HTMLElement>('button[aria-label="Mục lục"][aria-pressed]')?.focus()
    }
  }, [drawerOpen])
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTocDrawerOpen(false)
      if (e.key === 'Tab') {
        const f = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [])
        if (f.length === 0) return
        const first = f[0]!, last = f[f.length - 1]!
        const act = document.activeElement
        if (!drawerRef.current?.contains(act)) { e.preventDefault(); first.focus() }
        else if (e.shiftKey && act === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

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
  const fileSave = useFileSave(session, { formatOnSave: readerSettings.formatOnSave ?? (readerSettings.autoFormatMd !== false) })
  const [viewMode, setViewMode] = useState<ViewMode>('reading')
  const [isPresenting, setIsPresenting] = useState<boolean>(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)
  const [isConfettiActive, setIsConfettiActive] = useState<boolean>(false)
  const hasCelebratedRef = useRef<boolean>(false)
  const editorViewRef = useRef<EditorView | null>(null)

  const isSpeakerMode = new URLSearchParams(window.location.search).get('speaker') === 'true'

  const docContainerRef = useRef<HTMLDivElement | null>(null)
  const [exportOpen, setExportOpen] = useState<boolean>(false)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)


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
        const stored: any = { ...syncRes, ...localRes }
        if ((stored.settingsVersion ?? 1) < 2) {
          if (!stored.fontFamily || stored.fontFamily === 'sans') stored.fontFamily = 'serif'
          stored.settingsVersion = 2
          persistSettings({ settingsVersion: 2, fontFamily: stored.fontFamily })
        }
        if (stored.contrast !== 'standard' && stored.contrast !== 'high') stored.contrast = 'standard'
        setReaderSettings({
          ...DEFAULT_READER_SETTINGS,
          ...stored,
          mode,
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
    persistSettings({ [key]: value })
  }

  const handleModeChange = (mode: ThemeMode) => {
    handleSettingChange('mode', mode)
  }

  const { html, toc, parseResult, parsedDoc } = useMemo(() => {
    if (!content) {
      const emptyTree = { type: 'root', children: [] } as any
      return {
        html: '',
        toc: [],
        parseResult: { tree: emptyTree, frontmatter: {}, raw: '' },
        parsedDoc: { tree: emptyTree },
      }
    }
    const parsed = parseMarkdown(content, { math: readerSettings?.enableMath !== false })
    const rendered = renderToHtml(parsed, {
      math: readerSettings?.enableMath !== false,
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
      parseResult: parsed,
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

  const { exportAs: baseExportAs, isPrintingSlides } = useExport({
    html,
    title: docTitle,
    parseResult,
  })

  const [printHtml, setPrintHtml] = useState<string[] | null>(null)
  const [preparingSlides, setPreparingSlides] = useState(false)
  const exportAs = async (format: ExportFormat): Promise<void> => {
    if (format === 'slides-pdf' && readerSettings.enableMermaid !== false) {
      setPreparingSlides(true)
      try {
        const list = splitIntoSlides(content, { math: readerSettings.enableMath !== false })
        const out = await Promise.all(list.map((sl) => inlineMermaid(sl.html, 'default')))
        flushSync(() => setPrintHtml(out))
      } catch {
        setPrintHtml(null)
      } finally {
        setPreparingSlides(false)
      }
    } else {
      setPrintHtml(null)
    }
    await baseExportAs(format)
  }
  useEffect(() => {
    if (!isPrintingSlides) setPrintHtml(null)
  }, [isPrintingSlides])

  const hasSlides = useMemo(
    () => (exportOpen ? splitIntoSlides(content, { math: readerSettings.enableMath !== false }).length > 1 : false),
    [exportOpen, content, readerSettings.enableMath],
  )

  const slides = useMemo(
    () => (isPresenting || isPrintingSlides || isSpeakerMode ? splitIntoSlides(content, { math: readerSettings.enableMath !== false }) : []),
    [content, isPresenting, isPrintingSlides, isSpeakerMode, readerSettings.enableMath],
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
        mermaid={readerSettings.enableMermaid !== false}
      />
    )
  }

  const themeMode = readerSettings.mode || 'system'

  const ss = fileSave.saveState
  const saveStatus: SaveStatus =
    ss.kind === 'saving'
      ? { kind: 'saving' }
      : ss.kind === 'error'
        ? { kind: 'error', message: ss.message, onRetry: () => { void fileSave.save({ explicit: true }) } }
        : ss.kind === 'needs-permission'
          ? { kind: 'needs-permission', onGrant: () => { void fileSave.grantPermission() } }
          : isDirty || ss.kind === 'conflict'
            ? { kind: 'dirty' }
            : ss.kind === 'saved'
              ? { kind: 'saved', at: ss.at }
              : { kind: 'none' }

  const toolbarActions: ToolbarAction[] = [
    { id: 'open', label: 'Mở file…', icon: 'open-file', onSelect: () => { void handleOpenFile() } },
    { id: 'export', label: 'Xuất file', icon: 'export', onSelect: () => setExportOpen(true) },
    { id: 'settings', label: 'Cài đặt', icon: 'settings', onSelect: () => setSettingsOpen(true) },
  ]

  return (
    <ThemeProvider mode={themeMode} contrast={readerSettings.contrast} onModeChange={handleModeChange}>
      {preparingSlides && <div role="status" className="deck-print-busy">Đang chuẩn bị sơ đồ…</div>}
      {isPrintingSlides && (
        <div className="deck-print-container" aria-hidden="true">
          {slides.map((slide, idx) => (
            <div key={slide.id || idx} className="deck-print-slide md-viewer">
              <div className="deck-slide-content" dangerouslySetInnerHTML={{ __html: printHtml?.[idx] ?? slide.html }} />
            </div>
          ))}
        </div>
      )}
      {isPresenting && (
        <Suspense fallback={<LazyFallback />}>
        <Deck
          slides={slides}
          mermaid={readerSettings.enableMermaid !== false}
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
        </Suspense>
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
          onToggleToc={() => (narrow ? setTocDrawerOpen(v => !v) : setTocRailOpen(v => !v))}
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
          saveStatus={saveStatus}
          onSave={() => fileSave.save({ explicit: true })}
          actions={toolbarActions}
        />
        <>
          <ExportModal open={exportOpen} onOpenChange={setExportOpen} onExport={exportAs} hasSlides={hasSlides} />
          <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} settings={readerSettings} onSettingChange={handleSettingChange} />
        </>
        {isReadingMode && (
          <button
            className="exit-reading-mode-btn md-no-print"
            onClick={() => setIsReadingMode(false)}
          >
            <Icon name="close" size={16} />
            Thoát chế độ đọc
          </button>
        )}
        <FileDrop>
          {session.externalChange && (
            <div className="error-banner notice" role="status">
              <span>Tài liệu gốc đã thay đổi từ lần mở trước. Bản của bạn vẫn được giữ.</span>
              <div className="notice__actions">
                <button type="button" onClick={session.acceptExternal}>Tải bản mới</button>
                <button type="button" onClick={session.dismissExternal}>Giữ bản của tôi</button>
              </div>
            </div>
          )}
          {keptNoticeOpen && (
            <div className="error-banner notice" role="status">
              <span>Tài liệu này đang có bản sửa chưa lưu nên chưa nạp lại từ đĩa. Khi lưu, bạn sẽ thấy phần khác nhau để chọn.</span>
              <div className="notice__actions">
                <button type="button" onClick={() => setKeptNoticeOpen(false)}>Đã hiểu</button>
              </div>
            </div>
          )}
          {fileSave.saveState.kind === 'error' && (
            <div className="error-banner notice notice--danger" role="alert">
              <span>Không lưu được: {fileSave.saveState.message}</span>
              <div className="notice__actions">
                <button type="button" onClick={() => { void fileSave.save({ explicit: true }) }}>Thử lại</button>
                {fileSave.saveState.canSaveAs && (
                  <button type="button" onClick={() => { void fileSave.saveAs() }}>Lưu thành file khác…</button>
                )}
              </div>
            </div>
          )}
          {error && (
            <div className="notice notice--danger" role="alert">
              <span>{error}</span>
              {fileUrlParam?.startsWith('file:') && (
                <div className="notice__actions">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        chrome.tabs?.create?.({ url: 'chrome://extensions/?id=' + (chrome.runtime?.id || '') })
                      } catch {
                        window.open('chrome://extensions')
                      }
                    }}
                  >
                    Mở Cài đặt Tiện ích để Bật "Cho phép truy cập vào các URL tệp"
                  </button>
                </div>
              )}
            </div>
          )}

          {viewMode === 'reading' && hasContent && (
            <div className={`app-layout ${(!(narrow ? false : tocRailOpen) || isReadingMode || !toc || toc.length === 0) ? 'single-column' : ''}`}>
              <div className="main-content" data-font-scale={fontScale}>
                <div ref={docContainerRef} className="a4-document-container">
                  <Viewer html={html} mermaid={readerSettings.enableMermaid !== false} onActiveHeadingChange={setActiveHeadingId} />
                </div>
              </div>
              {toc && toc.length > 0 && tocRailOpen && !isReadingMode && !narrow && (
                <div className="sidebar-toc">
                  <Toc entries={toc} activeId={activeHeadingId} />
                </div>
              )}
              {toc && toc.length > 0 && drawerOpen && !isReadingMode && (
                <>
                  <div className="toc-backdrop" data-testid="toc-backdrop" onClick={() => setTocDrawerOpen(false)} />
                  <div className="toc-drawer" role="dialog" aria-modal="true" aria-label="Mục lục" ref={drawerRef}>
                    <Toc entries={toc} activeId={activeHeadingId} onNavigate={() => setTocDrawerOpen(false)} />
                  </div>
                </>
              )}
            </div>
          )}

          {viewMode === 'editor' && (
            <div className="editor-mode-container">
              <FormattingToolbar onAction={handleFormatAction} />
              <div className="editor-mode-body">
                <Suspense fallback={<LazyFallback />}>
                  <Editor yText={yText} undoManager={undoManager} editorViewRef={editorViewRef} />
                </Suspense>
              </div>
            </div>
          )}

          {viewMode === 'split' && (
            <div className="split-mode-container">
              <FormattingToolbar onAction={handleFormatAction} />
              <div className="split-mode-body">
                <Suspense fallback={<LazyFallback />}>
                <SplitViewContainer
                  mode="split"
                  editor={<Suspense fallback={<div className="lazy-fallback" aria-busy="true" />}><Editor yText={yText} undoManager={undoManager} editorViewRef={editorViewRef} /></Suspense>}
                  preview={
                    <div ref={docContainerRef} className="a4-document-container">
                      <Viewer html={html} mermaid={readerSettings.enableMermaid !== false} />
                    </div>
                  }
                />
                </Suspense>
              </div>
            </div>
          )}

          {viewMode === 'reading' && !hasContent && !error && (
            <div data-testid="app-placeholder" className="first-screen">
              <Logo size={56} />
              <h1>Mở một tài liệu Markdown</h1>
              <p>Kéo file .md vào cửa sổ này, hoặc chọn từ máy.</p>
              <button type="button" className="first-screen__open" onClick={() => { void handleOpenFile() }}>
                <Icon name="open-file" size={16} /> Mở file…
              </button>
              <RecentFiles />
            </div>
          )}
        </FileDrop>
      </div>
    </ThemeProvider>
  )
}
