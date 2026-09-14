import React, { createContext, useContext, useEffect, useState } from 'react'
import './tokens.css'
import './color-themes.css'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ColorTheme = 'navy' | 'green' | 'orange' | 'pink' | 'black'

export interface ThemeContextValue {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

export interface ThemeProviderProps {
  mode: ThemeMode
  colorTheme?: ColorTheme
  onModeChange?: (mode: ThemeMode) => void
  onColorThemeChange?: (theme: ColorTheme) => void
  children: React.ReactNode
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider(props: ThemeProviderProps): React.JSX.Element {
  const { mode, colorTheme = 'black', onModeChange, onColorThemeChange, children } = props
  const [resolvedSystemMode, setResolvedSystemMode] = useState<'light' | 'dark'>('light')

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

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.setAttribute('data-color-theme', colorTheme)
    if (document.documentElement.style) {
      document.documentElement.style.colorScheme = resolved
    }
  }, [resolved, colorTheme])

  const setMode = (newMode: ThemeMode) => {
    if (onModeChange) {
      onModeChange(newMode)
    }
  }

  const setColorTheme = (newTheme: ColorTheme) => {
    if (onColorThemeChange) {
      onColorThemeChange(newTheme)
    }
  }

  const value = {
    mode,
    resolved,
    setMode,
    colorTheme,
    setColorTheme
  }

  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={resolved} data-color-theme={colorTheme}>
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
