import React, { useEffect, useState, useMemo } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import {
  ThemeProvider,
  ThemePicker,
  SettingsModal,
  Viewer,
  Toc,
  ExportModal,
  printDocument,
  getDefaultExportCss,
  ReadingProgress,
  TopToolbar,
} from "@md-reader/ui"
import type { ThemeMode, ColorTheme, ExportFormat, FontScale } from '@md-reader/ui'
import { parseMarkdown, renderToHtml, exportToHtml, mdastToDocx } from '@md-reader/core'
import { FileDrop } from './FileDrop'
import { RecentFiles } from './RecentFiles'
import { addRecentFile } from './registry'
import './app.css'

export function App(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeMode | null>(null)
  const [colorTheme, setColorTheme] = useState<ColorTheme | null>(null)
  const [autoFormatMd, setAutoFormatMd] = useState<boolean>(true)
  const [fontScale, setFontScale] = useState<FontScale>('md')
  const [tocOpen, setTocOpen] = useState<boolean>(true)
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [docTitle, setDocTitle] = useState<string>('')
  // Re-render when doc text changes to hide placeholder
  const [hasContent, setHasContent] = useState(false)

  const doc = useMemo(() => new Y.Doc(), [])

  useEffect(() => {
    let persistence: IndexeddbPersistence | null = null
    try {
      persistence = new IndexeddbPersistence('md-reader', doc)
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
    const observer = () => {
      setHasContent(text.length > 0)
      setContent(text.toString())
      updateTitle()
    }
    text.observe(observer)
    meta.observe(updateTitle)
    // Wait for initial sync from IDB
    if (persistence) {
      persistence.once('synced', () => {
        setHasContent(text.length > 0)
        setContent(text.toString())
        updateTitle()
      })
    }

    return () => {
      text.unobserve(observer)
      meta.unobserve(updateTitle)
      if (persistence) {
        persistence.destroy()
      }
    }
  }, [doc])

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await chrome.storage.sync.get(['theme', 'colorTheme', 'autoFormatMd', 'fontScale'])
        setTheme((result.theme as ThemeMode) || 'system')
        setColorTheme((result.colorTheme as ColorTheme) || 'black')
        setAutoFormatMd(result.autoFormatMd !== undefined ? (result.autoFormatMd as boolean) : true)
        setFontScale((result.fontScale as FontScale) || 'md')
      } catch (err) {
        setTheme('system')
        setColorTheme('black')
        setAutoFormatMd(true)
        setFontScale('md')
      }
    }
    fetchSettings()
  }, [])

  // Handle URL file param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fileUrl = params.get('file')
    if (fileUrl) {
      fetch(fileUrl)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.text()
        })
        .then(text => {
          const ytext = doc.getText('source')
          ytext.delete(0, ytext.length)
          ytext.insert(0, text)
          const name = fileUrl.split('/').pop() || 'Untitled.md'
          doc.getMap('meta').set('name', name)
          setDocTitle(name.replace(/\.[^/.]+$/, ''))
          
          addRecentFile({
            id: fileUrl,
            name,
            lastOpened: Date.now()
          }).catch(console.error)
        })
        .catch(err => {
          console.error('Failed to load file from URL:', err)
          setError(`Cannot read file: ${fileUrl}. Make sure "Allow access to file URLs" is enabled in extension settings.`)
        })
    }
  }, [doc])

  const handleModeChange = async (mode: ThemeMode) => {
    setTheme(mode)
    try {
      await chrome.storage.sync.set({ theme: mode })
    } catch (err) {
      // ignore
    }
  }

  const handleColorThemeChange = async (color: ColorTheme) => {
    setColorTheme(color)
    try {
      await chrome.storage.sync.set({ colorTheme: color })
    } catch (err) {
      // ignore
    }
  }

  const handleAutoFormatChange = async (val: boolean) => {
    setAutoFormatMd(val)
    try {
      await chrome.storage.sync.set({ autoFormatMd: val })
    } catch (err) {
      // ignore
    }
  }

  const { html, toc, parseResult } = useMemo(() => {
    if (!content) return { html: '', toc: [], parseResult: { ast: { type: 'root', children: [] } as any } }
    const parsed = parseMarkdown(content)
    const rendered = renderToHtml(parsed)
    return {
      html: rendered.html,
      toc: rendered.toc,
      parseResult: { ast: parsed.tree, ...parsed },
    }
  }, [content])

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true)
    try {
      const title = docTitle || 'document'
      if (format === 'pdf') {
        printDocument()
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

  if (!theme || !colorTheme) return <div>Loading...</div>

  return (
    <ThemeProvider mode={theme} colorTheme={colorTheme} onModeChange={handleModeChange} onColorThemeChange={handleColorThemeChange}>
      <div className={`app-container${isReadingMode ? ' reading-mode' : ''}`} data-font-scale={fontScale}>
        <ReadingProgress />
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
          rightActions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <ExportModal onExport={handleExport} isExporting={isExporting} />
              <SettingsModal
                themePicker={<ThemePicker currentTheme={colorTheme} onSelect={handleColorThemeChange} />}
                autoFormat={autoFormatMd}
                onAutoFormatChange={handleAutoFormatChange}
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
          {error && <div style={{ color: 'red', padding: '20px' }}>{error}</div>}
          
          {hasContent && (
            <div className={`app-layout ${(!tocOpen || isReadingMode || !toc || toc.length === 0) ? 'single-column' : ''}`}>
              <div className="main-content" data-font-scale={fontScale}>
                <div className="a4-document-container">
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

          {!hasContent && !error && (
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
