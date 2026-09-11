import React, { createContext, useContext, useEffect, useState } from 'react'
import './tokens.css'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeContextValue {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

export interface ThemeProviderProps {
  mode: ThemeMode
  onModeChange?: (mode: ThemeMode) => void
  children: React.ReactNode
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemMode(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function ThemeProvider(props: ThemeProviderProps): React.JSX.Element {
  const { mode, onModeChange, children } = props
  const [resolvedSystemMode, setResolvedSystemMode] = useState<'light' | 'dark'>(() => getSystemMode())

  useEffect(() => {
    if (mode !== 'system') return
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedSystemMode(e.matches ? 'dark' : 'light')
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange as EventListener)
    } else if ('addListener' in mediaQuery) {
      // Fallback for older browsers
      ;(mediaQuery as any).addListener(handleChange)
    }

    setResolvedSystemMode(mediaQuery.matches ? 'dark' : 'light')

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange as EventListener)
      } else if ('removeListener' in mediaQuery) {
        ;(mediaQuery as any).removeListener(handleChange)
      }
    }
  }, [mode])

  const resolved = mode === 'system' ? resolvedSystemMode : mode

  const setMode = (newMode: ThemeMode) => {
    if (onModeChange) {
      onModeChange(newMode)
    }
  }

  const value = {
    mode,
    resolved,
    setMode
  }

  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={resolved}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
