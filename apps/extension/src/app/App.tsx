import React, { useEffect, useState, useMemo } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { ThemeProvider, ThemeMode } from '@md-reader/ui'

export function App(): React.JSX.Element {
  const [initialTheme, setInitialTheme] = useState<ThemeMode | null>(null)

  const doc = useMemo(() => new Y.Doc(), [])

  useEffect(() => {
    try {
      const persistence = new IndexeddbPersistence('md-reader', doc)
    } catch (err) {
      // Fallback to memory-only Y.Doc
      console.warn('Failed to initialize IndexeddbPersistence:', err)
    }
  }, [doc])

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const result = await chrome.storage.sync.get('theme')
        setInitialTheme((result.theme as ThemeMode) || 'system')
      } catch (err) {
        console.warn('Failed to get theme from storage:', err)
        setInitialTheme('system')
      }
    }
    fetchTheme()
  }, [])

  const handleModeChange = async (mode: ThemeMode) => {
    try {
      await chrome.storage.sync.set({ theme: mode })
    } catch (err) {
      console.warn('Failed to set theme in storage:', err)
    }
  }

  if (!initialTheme) {
    return <div>Loading...</div>
  }

  return (
    <ThemeProvider mode={initialTheme} onModeChange={handleModeChange}>
      <div data-testid="app-placeholder">App Page</div>
    </ThemeProvider>
  )
}
