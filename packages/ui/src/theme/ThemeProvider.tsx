import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import './tokens.css'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Contrast = 'standard' | 'high'

export interface ThemeContextValue {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  contrast: Contrast
  setMode: (mode: ThemeMode) => void
}

export interface ThemeProviderProps {
  mode: ThemeMode
  contrast?: Contrast
  onModeChange?: (mode: ThemeMode) => void
  children: React.ReactNode
}

function readSystemMode(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider(props: ThemeProviderProps): React.JSX.Element {
  const parent = useContext(ThemeContext)
  const isRoot = parent === undefined
  const { mode, contrast = parent?.contrast ?? 'standard', onModeChange, children } = props
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>(readSystemMode)

  useEffect(() => {
    if (mode !== 'system') return
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? 'dark' : 'light')
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange as EventListener)
    } else if ('addListener' in mediaQuery) {
      ;(mediaQuery as any).addListener(handleChange)
    }

    setSystemMode(mediaQuery.matches ? 'dark' : 'light')

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange as EventListener)
      } else if ('removeListener' in mediaQuery) {
        ;(mediaQuery as any).removeListener(handleChange)
      }
    }
  }, [mode])

  const resolved = mode === 'system' ? systemMode : mode

  useLayoutEffect(() => {
    if (!isRoot || typeof document === 'undefined') return
    const root = document.documentElement
    root.setAttribute('data-theme', resolved)
    root.setAttribute('data-contrast', contrast)
    if (root.style) {
      root.style.colorScheme = resolved
    }
  }, [isRoot, resolved, contrast])

  useLayoutEffect(() => {
    if (!isRoot || typeof document === 'undefined') return
    return () => {
      const root = document.documentElement
      root.removeAttribute('data-theme')
      root.removeAttribute('data-contrast')
      if (root.style) root.style.colorScheme = ''
    }
  }, [isRoot])

  const setMode = (newMode: ThemeMode) => {
    if (onModeChange) {
      onModeChange(newMode)
    }
  }

  const value = {
    mode,
    resolved,
    contrast,
    setMode
  }

  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={resolved} data-contrast={contrast}>
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

export function useResolvedTheme(): 'light' | 'dark' {
  return useContext(ThemeContext)?.resolved ?? 'light'
}
