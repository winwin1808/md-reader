import React, { useEffect, useState, useMemo } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { ThemeProvider, ThemePicker } from "@md-reader/ui"
import type { ThemeMode, ColorTheme } from '@md-reader/ui'
import { FileDrop } from './FileDrop'
import { RecentFiles } from './RecentFiles'
import { DocViewer } from './DocViewer'
import { addRecentFile } from './registry'

export function App(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeMode | null>(null)
  const [colorTheme, setColorTheme] = useState<ColorTheme | null>(null)
  const [error, setError] = useState<string | null>(null)
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
    const observer = () => setHasContent(text.length > 0)
    text.observe(observer)
    // Wait for initial sync from IDB
    if (persistence) {
      persistence.once('synced', () => setHasContent(text.length > 0))
    }

    return () => {
      text.unobserve(observer)
      if (persistence) {
        persistence.destroy()
      }
    }
  }, [doc])

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const result = await chrome.storage.sync.get(['theme', 'colorTheme'])
        setTheme((result.theme as ThemeMode) || 'system')
        setColorTheme((result.colorTheme as ColorTheme) || 'black')
      } catch (err) {
        setTheme('system')
        setColorTheme('black')
      }
    }
    fetchTheme()
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

  if (!theme || !colorTheme) return <div>Loading...</div>

  return (
    <ThemeProvider mode={theme} colorTheme={colorTheme} onModeChange={handleModeChange} onColorThemeChange={handleColorThemeChange}>
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 1000, background: 'rgba(128, 128, 128, 0.1)', padding: '8px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <ThemePicker currentTheme={colorTheme} onSelect={handleColorThemeChange} />
      </div>
      <FileDrop doc={doc}>
        {error && <div style={{ color: 'red', padding: '20px' }}>{error}</div>}
        <DocViewer doc={doc} />
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
