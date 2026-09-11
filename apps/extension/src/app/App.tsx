import React, { useEffect, useState, useMemo } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { ThemeProvider } from "@md-reader/ui"
import type { ThemeMode } from '@md-reader/ui'

export function App(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeMode | null>(null)

  const doc = useMemo(() => new Y.Doc(), [])

  useEffect(() => {
    let persistence: IndexeddbPersistence | null = null
    try {
      persistence = new IndexeddbPersistence('md-reader', doc)
    } catch (err) {
      // Fallback to memory-only Y.Doc
      console.warn('Failed to initialize IndexeddbPersistence:', err)
    }

    return () => {
      if (persistence) {
        persistence.destroy()
      }
    }
  }, [doc])

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const result = await chrome.storage.sync.get('theme')
        setTheme((result.theme as ThemeMode) || 'system')
      } catch (err) {
        console.warn('Failed to get theme from storage:', err)
        setTheme('system')
      }
    }
    fetchTheme()
  }, [])

  const handleModeChange = async (mode: ThemeMode) => {
    setTheme(mode) // Update local state immediately
    try {
      await chrome.storage.sync.set({ theme: mode })
    } catch (err) {
      console.warn('Failed to set theme in storage:', err)
    }
  }

  if (!theme) {
    return <div>Loading...</div>
  }

  return (
    <ThemeProvider mode={theme} onModeChange={handleModeChange}>
      <div data-testid="app-placeholder">App Page</div>
    </ThemeProvider>
  )
}
