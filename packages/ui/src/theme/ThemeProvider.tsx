import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import './tokens.css'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Contrast = 'standard' | 'high'
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
  contrast?: Contrast
  /** @deprecated ignored; removed in 7h2 */
  colorTheme?: ColorTheme
  onModeChange?: (mode: ThemeMode) => void
  /** @deprecated */
  onColorThemeChange?: (theme: ColorTheme) => void
  children: React.ReactNode
}

function readSystemMode(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider(props: ThemeProviderProps): React.JSX.Element {
  const { mode, contrast = 'standard', colorTheme = 'black', onModeChange, onColorThemeChange, children } = props
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
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.setAttribute('data-theme', resolved)
    root.setAttribute('data-contrast', contrast)
    root.removeAttribute('data-color-theme')
    if (root.style) {
      root.style.colorScheme = resolved
    }
  }, [resolved, contrast])

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
