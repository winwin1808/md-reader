import React, { useEffect, useState, useMemo } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { ThemeProvider, ThemePicker, SettingsModal, Viewer, Toc } from "@md-reader/ui"
import type { ThemeMode, ColorTheme } from '@md-reader/ui'
import { parseMarkdown, renderToHtml } from '@md-reader/core'
import { FileDrop } from './FileDrop'
import { RecentFiles } from './RecentFiles'
import { addRecentFile } from './registry'
import './app.css'

export function App(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeMode | null>(null)
  const [colorTheme, setColorTheme] = useState<ColorTheme | null>(null)
  const [autoFormatMd, setAutoFormatMd] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
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
    const observer = () => {
      setHasContent(text.length > 0)
      setContent(text.toString())
    }
    text.observe(observer)
    // Wait for initial sync from IDB
    if (persistence) {
      persistence.once('synced', () => {
        setHasContent(text.length > 0)
        setContent(text.toString())
      })
    }

    return () => {
      text.unobserve(observer)
      if (persistence) {
        persistence.destroy()
      }
    }
  }, [doc])

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await chrome.storage.sync.get(['theme', 'colorTheme', 'autoFormatMd'])
        setTheme((result.theme as ThemeMode) || 'system')
        setColorTheme((result.colorTheme as ColorTheme) || 'black')
        setAutoFormatMd(result.autoFormatMd !== undefined ? (result.autoFormatMd as boolean) : true)
      } catch (err) {
        setTheme('system')
        setColorTheme('black')
        setAutoFormatMd(true)
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

  if (!theme || !colorTheme) return <div>Loading...</div>

  let html = ''
  let toc: any[] = []
  if (content) {
    const parsed = parseMarkdown(content)
    const rendered = renderToHtml(parsed)
    html = rendered.html
    toc = rendered.toc
  }

  return (
    <ThemeProvider mode={theme} colorTheme={colorTheme} onModeChange={handleModeChange} onColorThemeChange={handleColorThemeChange}>
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 1000 }}>
        <SettingsModal
          themePicker={<ThemePicker currentTheme={colorTheme} onSelect={handleColorThemeChange} />}
          autoFormat={autoFormatMd}
          onAutoFormatChange={handleAutoFormatChange}
        />
      </div>
      <FileDrop doc={doc}>
        {error && <div style={{ color: 'red', padding: '20px' }}>{error}</div>}
        
        {hasContent && (
          <div className="app-layout">
            <div className="main-content">
              <Viewer html={html} />
            </div>
            {toc && toc.length > 0 && (
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
    </ThemeProvider>
  )
}
