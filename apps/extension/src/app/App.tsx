import { docQuery, getRecord, touchRecord } from './doc-registry'
import { nearestHeadingAtTop, lineOfHeading, headingIdAtLine } from './view-anchor'
import React, { Suspense, useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  ThemeProvider,
  SettingsModal,
  Viewer,
  Toc,
  ExportModal,
  ShareModal,
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
  HistoryTimeline,
  historyLabel,
} from "@md-reader/ui"
const Editor = React.lazy(() => import('@md-reader/ui/editor').then(m => ({ default: m.Editor })))
const Deck = React.lazy(() => import('@md-reader/ui/deck').then(m => ({ default: m.Deck })))
const LazyFallback = () => <div className="lazy-fallback" aria-busy="true" />
import { inlineMermaid, usePeers, lineAuthors, useT, useLocale } from '@md-reader/ui'
import type { LineAuthor } from '@md-reader/ui'
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
  buildShareUrl,
  normalizeServerUrl,
  computeBlame,
} from '@md-reader/core'
import type { MindNode, RoomBinding } from '@md-reader/core'
import { defaultRenderPlugins, parseYaml } from '@md-reader/core/plugins'
import { FileDrop } from './FileDrop'
import { RecentFiles } from './RecentFiles'
import { openLocalFileAsDoc } from './fs/file-system'
import { useDocSession } from './hooks/useDocSession'
import { useFileSave } from './hooks/useFileSave'
import { useHistory } from './hooks/useHistory'
import { useExport } from './hooks/useExport'
import { useShare } from './collab/useShare'
import { DEFAULT_SERVER_URL } from '../shared/collab'
import { useShortcuts } from './hooks/useShortcuts'
import { useBridgeSettings } from './hooks/useBridgeSettings'
import { BRIDGE_SCAN_MSG } from '../worker/bridge-storage'
import { BRIDGE_EXEC_MSG, type ExecMsg } from '../shared/bridge-msg'
import { createBridgeExecutor, type ExecSession } from './bridge-executor'
import { FileAccessHint } from './FileAccessHint'
import { createImageResolver } from './image-resolver'
import { createImageSaver } from './image-saver'
import { getHandle, getDirHandle, storeDirHandle } from './doc-registry'
import './app.css'

const PLUGINS = defaultRenderPlugins()

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
  pageWidth: 'medium',
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

const SELF_HOST_GUIDE_URL = 'https://github.com/winwin1808/md-reader/blob/main/docs/SELF_HOST.md'

export function App(): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const bridge = useBridgeSettings()
  useEffect(() => {
    try { void Promise.resolve(chrome.runtime.sendMessage({ type: BRIDGE_SCAN_MSG })).catch(() => {}) } catch { /* ignore */ }
  }, [])
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
      document.querySelector<HTMLElement>(`button[aria-label="${t('ext.app.toc')}"][aria-pressed]`)?.focus()
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
    return { docId: sp.get('doc'), shortParam: sp.get('d'), fileUrl: sp.get('file'), kept: sp.get('kept') === '1' }
  })
  const fileUrlParam = urlParams.fileUrl
  const [keptNoticeOpen, setKeptNoticeOpen] = useState<boolean>(urlParams.kept)
  const [room, setRoom] = useState<RoomBinding | null>(null)
  const serverUrl = normalizeServerUrl(readerSettings.serverUrl ?? '') ?? (DEFAULT_SERVER_URL || null)
  const [retryNonce, setRetryNonce] = useState(0)
  const displayName = readerSettings.displayName?.trim() || 'Bạn'
  const session = useDocSession({ docId: urlParams.docId, shortParam: urlParams.shortParam, fileUrl: urlParams.fileUrl, room, displayName })
  const { doc, yText, undoManager, content, hasContent, isDirty, error, setError } = session
  const docTitle = session.title
  const [historyOpen, setHistoryOpen] = useState(false)
  const imageOriginUrl = session.record?.originKind === 'url' ? session.record.originPath : fileUrlParam
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | undefined>(undefined)
  const [imageNotice, setImageNotice] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setDirHandle(undefined)
    if (session.docId) void getDirHandle(session.docId).then((d) => { if (!cancelled && d) setDirHandle(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [session.docId])
  const allowImageDir = useCallback(async () => {
    try {
      if (!session.docId) return null
      const fh = await getHandle(session.docId)
      const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
      if (!fh || !picker) { setImageNotice(t('ext.image.noPicker')); return null }
      const dir = await picker({ startIn: fh, mode: 'readwrite' })
      if (!(await dir.resolve(fh))) { setImageNotice(t('ext.image.dirMismatch')); return null }
      await storeDirHandle(session.docId, dir)
      setDirHandle(dir)
      setImageNotice(null)
      return dir
    } catch { return null /* cancelled */ }
  }, [session.docId])
  const resolveImage = useMemo(
    () => (dirHandle || imageOriginUrl ? createImageResolver({ url: imageOriginUrl ?? undefined, dirHandle }) : undefined),
    [imageOriginUrl, dirHandle],
  )
  const saveImage = useMemo(
    () => createImageSaver({ serverUrl: room?.serverUrl ?? serverUrl ?? '', room: room?.roomId, ownerToken: room?.ownerToken, dirHandle, docName: session.title || 'image', hasFileHandle: !!session.record?.hasHandle, requestDir: allowImageDir, t }),
    [room?.serverUrl, room?.roomId, room?.ownerToken, serverUrl, dirHandle, session.title, session.record?.hasHandle, allowImageDir],
  )
  useEffect(() => () => resolveImage?.dispose(), [resolveImage])
  const history = useHistory(doc, session.checkpoints, displayName)
  const fileSave = useFileSave(session, { formatOnSave: readerSettings.formatOnSave ?? (readerSettings.autoFormatMd !== false) })
  const [viewMode, setViewMode] = useState<ViewMode>('reading')
  const pendingAnchorRef = useRef<{ to: ViewMode; id: string | null } | null>(null)
  const userSwitchedRef = useRef(false)
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSystemDark(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  const resolvedDarkRef = useRef(false)
  const modeSetting = readerSettings.mode || 'system'
  resolvedDarkRef.current = modeSetting === 'system' ? systemDark : modeSetting === 'dark'
  const liveOpts = useMemo(() => ({ theme: () => (resolvedDarkRef.current ? 'dark' as const : 'default' as const) }), [])
  const [isPresenting, setIsPresenting] = useState<boolean>(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)
  const [isConfettiActive, setIsConfettiActive] = useState<boolean>(false)
  const hasCelebratedRef = useRef<boolean>(false)
  const editorViewRef = useRef<EditorView | null>(null)
  const [blameOn, setBlameOn] = useState(false)
  const [blameLines, setBlameLines] = useState<Array<LineAuthor | null> | null>(null)
  useEffect(() => {
    if (!blameOn || viewMode === 'reading') { setBlameLines(null); return }
    const meta = doc.getMap('meta')
    let timer: ReturnType<typeof setTimeout> | null = null
    const compute = () => { setBlameLines(lineAuthors(computeBlame(doc), yText.toString())) }
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { timer = null; compute() }, 300)
    }
    compute()
    yText.observe(schedule)
    meta.observeDeep(schedule)
    return () => {
      yText.unobserve(schedule)
      meta.unobserveDeep(schedule)
      if (timer) clearTimeout(timer)
    }
  }, [blameOn, viewMode, doc, yText])
  const peers = usePeers(session.awareness)

  const isSpeakerMode = new URLSearchParams(window.location.search).get('speaker') === 'true'

  const docContainerRef = useRef<HTMLDivElement | null>(null)

  const sessionDocId = session.docId
  useEffect(() => {
    if (!sessionDocId) return
    let cancelled = false
    void Promise.resolve(getRecord(sessionDocId)).then((rec) => {
      if (cancelled || userSwitchedRef.current || !rec?.viewMode) return
      setViewMode(rec.viewMode === 'reading' ? 'reading' : 'live')
    }).catch(() => {})
    return () => { cancelled = true }
  }, [sessionDocId])

  const changeViewMode = useCallback((next: ViewMode) => {
    if (next === viewMode) return
    userSwitchedRef.current = true
    let id: string | null = null
    if (viewMode === 'reading') {
      if (docContainerRef.current) id = nearestHeadingAtTop(docContainerRef.current, 56)
    } else {
      const view = editorViewRef.current
      if (view) {
        const pane = view.dom.closest('.editor-live-pane') as HTMLElement | null
        const y = (pane?.getBoundingClientRect().top ?? 48) + 8
        const x = view.contentDOM.getBoundingClientRect().left + 20
        const pos = view.posAtCoords({ x, y }, false)
        id = headingIdAtLine(yText.toString(), view.state.doc.lineAt(pos).number - 1)
      }
    }
    pendingAnchorRef.current = { to: next, id }
    setViewMode(next)
    if (sessionDocId) void Promise.resolve(touchRecord(sessionDocId, { viewMode: next })).catch(() => {})
  }, [viewMode, yText, sessionDocId])

  useEffect(() => {
    const p = pendingAnchorRef.current
    if (!p || p.to !== viewMode) return
    pendingAnchorRef.current = null
    if (!p.id) return
    const id = p.id
    let frames = 0
    let raf = 0
    const step = () => {
      frames++
      let settled = false
      if (viewMode === 'live') {
        const view = editorViewRef.current
        const line = lineOfHeading(yText.toString(), id)
        const pane = view?.dom.closest('.editor-live-pane') as HTMLElement | null
        if (view && pane && line !== null) {
          const pos = view.state.doc.line(Math.min(line + 1, view.state.doc.lines)).from
          const top = pane.getBoundingClientRect().top + 8
          const c = view.coordsAtPos(pos)
          if (c) {
            const d = c.top - top
            if (Math.abs(d) <= 2) settled = frames > 3
            else pane.scrollTop += d
          } else {
            const blk = view.lineBlockAt(pos)
            pane.scrollTop = view.contentDOM.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop + blk.top - 8
          }
        }
      } else {
        const el = document.getElementById(id)
        if (el) {
          const d = el.getBoundingClientRect().top - 56
          if (Math.abs(d) <= 2) settled = frames > 3
          else window.scrollBy({ top: d, behavior: 'instant' as ScrollBehavior })
        }
      }
      if (!settled && frames < 40) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [viewMode, yText])
  const [exportOpen, setExportOpen] = useState<boolean>(false)
  const [shareOpen, setShareOpen] = useState<boolean>(false)
  const share = useShare({ docId: session.docId, serverUrl: serverUrl ?? '' })
  const execSessionRef = useRef<ExecSession | null>(null)
  execSessionRef.current = session.docId && yText ? { docId: session.docId, title: session.title, yText, shared: !!share.binding, synced: session.synced, checkpoints: session.checkpoints ?? null, persisted: session.persisted ?? null } : null
  useEffect(() => {
    const onMsg = chrome?.runtime?.onMessage
    if (!onMsg?.addListener) return
    const exec = createBridgeExecutor(() => execSessionRef.current)
    const listener = (msg: unknown, sender: { id?: string; tab?: unknown }, sendResponse: (r: unknown) => void): boolean | undefined => {
      const m = msg as Partial<ExecMsg> | null
      if (!m || m.type !== BRIDGE_EXEC_MSG || !m.req) return undefined
      if (sender.id !== chrome.runtime.id || sender.tab) return undefined
      const req = m.req
      void exec(req).then(sendResponse, (err) => sendResponse({ type: 'res', id: req.id, ok: false, error: { code: 'INTERNAL', message: String(err) } }))
      return true
    }
    onMsg.addListener(listener)
    return () => onMsg.removeListener(listener)
  }, [])
  const shareServer = !serverUrl
    ? ({ state: 'missing' } as const)
    : share.error === t('ext.share.unreachable')
      ? ({ state: 'unreachable', url: serverUrl } as const)
      : share.error === t('ext.share.invalid')
        ? ({ state: 'not-md-reader', url: serverUrl } as const)
        : undefined
  const shareRef = useRef(share)
  shareRef.current = share
  useEffect(() => {
    if (retryNonce === 0 || !serverUrl) return
    const s = shareRef.current
    void (s.binding ? s.refresh() : s.enable()).catch(() => {})
  }, [retryNonce, serverUrl])
  useEffect(() => { setRoom(share.binding) }, [share.binding])
  const shareRoomId = share.binding?.roomId
  const shareRefresh = share.refresh
  useEffect(() => {
    if (shareOpen && shareRoomId) void shareRefresh().catch(() => {})
  }, [shareOpen, shareRoomId, shareRefresh])
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
      if (res) window.location.assign((await docQuery(res.docId)) + (res.kept ? '&kept=1' : ''))
    } catch (err) {
      setError((err as Error)?.message || t('ext.app.openFailed'))
    }
  }

  const handleFormatAction = (action: FormatAction) => {
    const view = editorViewRef.current
    if (view) {
      const { from, to } = view.state.selection.main
      const current = yText.toString()
      const r = applyFormat(current, from, to, action, t)
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
      const { newText, newSelectionStart, newSelectionEnd } = applyFormat(yText.toString(), start, end, action, t)
      applyTextChange(yText, newText)
      setTimeout(() => {
        activeEl.focus()
        activeEl.setSelectionRange?.(newSelectionStart, newSelectionEnd)
      }, 0)
    } else {
      const { newText } = applyFormat(yText.toString(), 0, 0, action, t)
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

  const renderHtmlFor = useCallback((text: string) => {
    const parsed = parseMarkdown(text, { math: readerSettings?.enableMath !== false, parseYaml })
    const rendered = renderToHtml(parsed, {
      math: readerSettings?.enableMath !== false,
      stripFrontmatter: readerSettings?.stripFrontmatter,
      displayMetadata: readerSettings?.displayMetadata,
      typographer: readerSettings?.typographer,
      externalLinks: readerSettings?.externalLinks,
      githubAlerts: readerSettings?.githubAlerts,
      localizeAlerts: readerSettings?.localizeAlerts ? 'vi' : 'en',
      plugins: PLUGINS,
    })
    return { parsed, rendered }
  }, [readerSettings])
  const previewHtml = useMemo(
    () => (history.previewText === null ? null : renderHtmlFor(history.previewText).rendered.html),
    [history.previewText, renderHtmlFor],
  )
  const previewEntry = history.previewId ? history.entries.find((e) => e.id === history.previewId) : undefined
  const previewBanner = previewHtml !== null && previewEntry ? (
    <div role="status" className="history-preview-banner">
      {t('ext.history.previewing', { label: historyLabel(previewEntry.label), date: new Date(previewEntry.ts).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) })}
      <button type="button" onClick={() => history.preview(null)}>{t('ext.history.exitPreview')}</button>
    </div>
  ) : null
  const closeHistory = () => { history.preview(null); setHistoryOpen(false) }

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
    const { parsed, rendered } = renderHtmlFor(content)
    return {
      html: rendered.html,
      toc: rendered.toc,
      parseResult: parsed,
      parsedDoc: parsed,
    }
  }, [content, renderHtmlFor])

  const mindmapRoot = useMemo(() => {
    if (!isMindmapOpen) return null
    return extractMindmap(parsedDoc.tree, docTitle || t('ext.app.untitled'))
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

  const [printHtml, setPrintHtml] = useState<{ id: string; html: string }[] | null>(null)
  const [preparingSlides, setPreparingSlides] = useState(false)
  const exportAs = async (format: ExportFormat): Promise<void> => {
    if (preparingSlides) return
    if (format === 'slides-pdf' && readerSettings.enableMermaid !== false) {
      setPreparingSlides(true)
      try {
        const list = splitIntoSlides(content, {
            math: readerSettings.enableMath !== false,
            render: {
              typographer: readerSettings.typographer,
              externalLinks: readerSettings.externalLinks,
              githubAlerts: readerSettings.githubAlerts,
              localizeAlerts: readerSettings.localizeAlerts ? 'vi' : 'en',
              plugins: PLUGINS,
            },
          })
        const out = await Promise.all(
          list.map(async (sl) => ({ id: sl.id, html: await inlineMermaid(sl.html, 'default') })),
        )
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
    () => (exportOpen ? splitIntoSlides(content, {
            math: readerSettings.enableMath !== false,
            render: {
              typographer: readerSettings.typographer,
              externalLinks: readerSettings.externalLinks,
              githubAlerts: readerSettings.githubAlerts,
              localizeAlerts: readerSettings.localizeAlerts ? 'vi' : 'en',
              plugins: PLUGINS,
            },
          }).length > 1 : false),
    [exportOpen, content, readerSettings.enableMath],
  )

  const slides = useMemo(
    () => (isPresenting || isPrintingSlides || isSpeakerMode ? splitIntoSlides(content, {
            math: readerSettings.enableMath !== false,
            render: {
              typographer: readerSettings.typographer,
              externalLinks: readerSettings.externalLinks,
              githubAlerts: readerSettings.githubAlerts,
              localizeAlerts: readerSettings.localizeAlerts ? 'vi' : 'en',
              plugins: PLUGINS,
            },
          }) : []),
    [content, isPresenting, isPrintingSlides, isSpeakerMode, readerSettings.enableMath, readerSettings.typographer, readerSettings.externalLinks, readerSettings.githubAlerts, readerSettings.localizeAlerts],
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
      <ThemeProvider mode={readerSettings.mode || 'system'} contrast={readerSettings.contrast}>
      <SpeakerView
        slides={slides}
        currentSlideIndex={currentSlideIndex}
        onSlideChange={(idx) => {
          setCurrentSlideIndex(idx)
          channelRef.current?.postMessage({ type: 'NAVIGATE', index: idx })
        }}
        mermaid={readerSettings.enableMermaid !== false}
      />
      </ThemeProvider>
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
    { id: 'open', label: t('ext.menu.open'), icon: 'open-file', onSelect: () => { void handleOpenFile() } },
    { id: 'export', label: t('ext.menu.export'), icon: 'export', onSelect: () => setExportOpen(true) },
    ...(viewMode !== 'reading' ? [{ id: 'blame', label: blameOn ? t('ext.menu.blameHide') : t('ext.menu.blameShow'), icon: 'person' as const, onSelect: () => setBlameOn((v) => !v) }] : []),
    { id: 'history', label: t('ext.menu.history'), icon: 'history', onSelect: () => { if (historyOpen) closeHistory(); else setHistoryOpen(true) } },
    { id: 'settings', label: t('ext.menu.settings'), icon: 'settings', onSelect: () => setSettingsOpen(true) },
  ]

  return (
    <ThemeProvider mode={themeMode} contrast={readerSettings.contrast} onModeChange={handleModeChange}>
      {preparingSlides && <div role="status" className="deck-print-busy">{t('ext.app.preparingDiagrams')}</div>}
      {isPrintingSlides && (
        <div className="deck-print-container" aria-hidden="true">
          {(printHtml ?? slides.map((sl) => ({ id: sl.id, html: sl.html }))).map((slide, idx) => (
            <div key={slide.id || idx} className="deck-print-slide md-viewer">
              <div className="deck-slide-content" dangerouslySetInnerHTML={{ __html: slide.html }} />
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
          onOpenSpeakerView={async () => {
            const q = session.docId
              ? (await docQuery(session.docId)) + '&speaker=true'
              : '?speaker=true' + (fileUrlParam ? '&file=' + encodeURIComponent(fileUrlParam) : '')
            window.open(window.location.pathname + q, 'md-speaker', 'width=1080,height=680')
          }
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
      <div className={`app-container${isReadingMode ? ' reading-mode' : ''}`} data-font-scale={fontScale} data-font-family={readerSettings.fontFamily} data-width={readerSettings.pageWidth ?? 'medium'}>
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
          syncStatus={session.syncStatus}
          presence={session.syncStatus !== 'off' ? peers : undefined}
          title={docTitle || t('ext.app.untitled')}
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
          onViewModeChange={changeViewMode}
          saveStatus={saveStatus}
          onSave={() => fileSave.save({ explicit: true })}
          actions={toolbarActions}
          onShare={session.docId ? () => setShareOpen(true) : undefined}
        />
        <>
          <ExportModal open={exportOpen} onOpenChange={setExportOpen} onExport={exportAs} hasSlides={hasSlides} />
          <ShareModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            binding={share.binding}
            links={share.links}
            onEnable={async () => { await share.enable() }}
            onCreateLink={share.createLink}
            onRevoke={share.revoke}
            onRecreate={share.recreate}
            onRevokeAll={share.revokeAll}
            onDeleteRemote={share.deleteRemote}
            buildUrl={(t: string) => buildShareUrl(share.binding?.serverUrl ?? serverUrl ?? '', t)}
            busy={share.busy}
            error={share.error}
            server={shareServer}
            onSaveServer={(u: string) => { handleSettingChange('serverUrl', u); setRetryNonce((n) => n + 1) }}
            guideUrl={SELF_HOST_GUIDE_URL}
          />
          <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} settings={readerSettings} onSettingChange={handleSettingChange} defaultServerUrl={DEFAULT_SERVER_URL} aiBridge={{ enabled: bridge.enabled, clients: bridge.clients, onToggle: (v) => { void bridge.setEnabled(v) }, onRevoke: (h) => { void bridge.revoke(h) } }} />
        </>
        {isReadingMode && (
          <button
            className="exit-reading-mode-btn md-no-print"
            onClick={() => setIsReadingMode(false)}
          >
            <Icon name="close" size={16} />
            {t('ext.app.exitReading')}
          </button>
        )}
        <FileDrop>
          {imageNotice && (
            <div className="error-banner notice" role="status">
              <span>{imageNotice}</span>
              <div className="notice__actions">
                {session.record?.hasHandle && !dirHandle && !room && <button type="button" onClick={() => void allowImageDir()}>{t('ext.image.allowDir')}</button>}
                <button type="button" onClick={() => setImageNotice(null)}>{t('ext.close')}</button>
              </div>
            </div>
          )}
          {session.externalChange && (
            <div className="error-banner notice" role="status">
              <span>{t('ext.notice.externalChanged')}</span>
              <div className="notice__actions">
                <button type="button" onClick={session.acceptExternal}>{t('ext.notice.loadNew')}</button>
                <button type="button" onClick={session.dismissExternal}>{t('ext.notice.keepMine')}</button>
              </div>
            </div>
          )}
          {keptNoticeOpen && (
            <div className="error-banner notice" role="status">
              <span>{t('ext.notice.keptUnsaved')}</span>
              <div className="notice__actions">
                <button type="button" onClick={() => setKeptNoticeOpen(false)}>{t('ext.notice.gotIt')}</button>
              </div>
            </div>
          )}
          {fileSave.saveState.kind === 'error' && (
            <div className="error-banner notice notice--danger" role="alert">
              <span>{t('ext.save.failed', { message: fileSave.saveState.message })}</span>
              <div className="notice__actions">
                <button type="button" onClick={() => { void fileSave.save({ explicit: true }) }}>{t('ext.save.retry')}</button>
                {fileSave.saveState.canSaveAs && (
                  <button type="button" onClick={() => { void fileSave.saveAs() }}>{t('ext.save.saveAs')}</button>
                )}
              </div>
            </div>
          )}
          <FileAccessHint fileUrl={fileUrlParam} failed={!!error} />
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
                    {t('ext.fileAccess.openLong')}
                  </button>
                </div>
              )}
            </div>
          )}

          {viewMode === 'reading' && hasContent && (
            <div className={`app-layout ${(!(narrow ? false : tocRailOpen) || isReadingMode || !toc || toc.length === 0) ? 'single-column' : ''}`}>
              <div className="main-content" data-font-scale={fontScale}>
                {previewBanner}
                <div ref={docContainerRef} className="a4-document-container">
                  <Viewer html={previewHtml ?? html} resolveImage={resolveImage} mermaid={readerSettings.enableMermaid !== false} onActiveHeadingChange={setActiveHeadingId} />
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
                  <div className="toc-drawer" role="dialog" aria-modal="true" aria-label={t('ext.app.toc')} ref={drawerRef}>
                    <Toc entries={toc} activeId={activeHeadingId} onNavigate={() => setTocDrawerOpen(false)} />
                  </div>
                </>
              )}
            </div>
          )}

          {historyOpen && (
            <div className="history-drawer">
              <HistoryTimeline
                entries={history.entries}
                actors={history.actors}
                previewId={history.previewId}
                previewText={history.previewText}
                onPreview={history.preview}
                onRestore={(id) => { history.restore(id) }}
                onClose={closeHistory}
              />
            </div>
          )}

          {viewMode === 'live' && (
            <div className="editor-mode-container">
              {previewHtml === null && <FormattingToolbar onAction={handleFormatAction} />}
              <div className="editor-mode-body">
                {previewHtml !== null ? (
                  <div className="history-preview-scroll">
                    {previewBanner}
                    <div className="main-content" data-font-scale={fontScale}>
                      <div className="a4-document-container">
                        <Viewer html={previewHtml} resolveImage={resolveImage} mermaid={readerSettings.enableMermaid !== false} />
                      </div>
                    </div>
                  </div>
                ) : (
                <Suspense fallback={<LazyFallback />}>
                  <Editor awareness={session.awareness ?? undefined} yText={yText} undoManager={undoManager} editorViewRef={editorViewRef} blame={blameOn ? blameLines : null} variant="live" live={liveOpts} resolveImage={resolveImage} saveImage={saveImage} onImageMessage={setImageNotice} />
                </Suspense>
                )}
              </div>
            </div>
          )}

          {viewMode === 'reading' && !hasContent && !error && (
            <div data-testid="app-placeholder" className="first-screen">
              <Logo size={56} />
              <h1>{t('ext.empty.title')}</h1>
              <p>{t('ext.empty.hint')}</p>
              <button type="button" className="first-screen__open" onClick={() => { void handleOpenFile() }}>
                <Icon name="open-file" size={16} /> {t('ext.menu.open')}
              </button>
              <RecentFiles />
            </div>
          )}
        </FileDrop>
      </div>
    </ThemeProvider>
  )
}
