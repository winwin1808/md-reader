import { render, screen, cleanup, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeProvider'
import React from 'react'

const TestComponent = () => {
  const { mode, resolved, setMode, colorTheme, setColorTheme } = useTheme()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <span data-testid="color-theme">{colorTheme}</span>
      <button onClick={() => setMode('dark')}>Set Dark</button>
      {setColorTheme && <button onClick={() => setColorTheme('navy')}>Set Navy</button>}
    </div>
  )
}

describe('ThemeProvider', () => {
  let originalMatchMedia: any

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    cleanup()
  })

  it('never sets data-color-theme', () => {
    const { container } = render(
      <ThemeProvider mode="light">
        <TestComponent />
      </ThemeProvider>
    )
    
    expect(container.firstChild).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
  })

  it('ignores deprecated colorTheme for styling', () => {
    const { container } = render(
      <ThemeProvider mode="light" colorTheme="green">
        <TestComponent />
      </ThemeProvider>
    )
    
    expect(container.firstChild).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(screen.getByTestId('color-theme')).toHaveTextContent('green')
  })

  it('calls onColorThemeChange when setColorTheme is called', () => {
    const onColorThemeChange = vi.fn()
    render(
      <ThemeProvider mode="light" colorTheme="black" onColorThemeChange={onColorThemeChange}>
        <TestComponent />
      </ThemeProvider>
    )

    screen.getByText('Set Navy').click()
    expect(onColorThemeChange).toHaveBeenCalledWith('navy')
  })

  // ... copy the rest of existing tests
  it('renders with light mode', () => {
    const { container } = render(
      <ThemeProvider mode="light">
        <TestComponent />
      </ThemeProvider>
    )
    
    expect(container.firstChild).toHaveAttribute('data-theme', 'light')
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('renders with dark mode', () => {
    const { container } = render(
      <ThemeProvider mode="dark">
        <TestComponent />
      </ThemeProvider>
    )
    
    expect(container.firstChild).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })

  it('resolves system mode to matchMedia when available', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const { container } = render(
      <ThemeProvider mode="system">
        <TestComponent />
      </ThemeProvider>
    )

    expect(container.firstChild).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })

  it('updates resolved mode when matchMedia change event fires', () => {
    type ChangeListener = (e: any) => void
    let listener: ChangeListener | null = null

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      addEventListener: vi.fn((event, cb) => {
        if (event === 'change') listener = cb
      }),
      removeEventListener: vi.fn(),
    }))

    const { container } = render(
      <ThemeProvider mode="system">
        <TestComponent />
      </ThemeProvider>
    )

    // Initial state
    expect(container.firstChild).toHaveAttribute('data-theme', 'light')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')

    // Simulate system theme changing to dark
    act(() => {
      if (listener) {
        listener({ matches: true })
      }
    })

    expect(container.firstChild).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })

  it('resolves system mode to light when matchMedia is undefined', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined
    })

    const { container } = render(
      <ThemeProvider mode="system">
        <TestComponent />
      </ThemeProvider>
    )

    expect(container.firstChild).toHaveAttribute('data-theme', 'light')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('dark mode sets data-theme and colorScheme on html and wrapper synchronously', () => {
    const { container } = render(
      <ThemeProvider mode="dark">
        <TestComponent />
      </ThemeProvider>
    )
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(container.firstChild).toHaveAttribute('data-theme', 'dark')
  })

  it('system mode follows matchMedia live and updates html', () => {
    let listener: ((e: any) => void) | null = null
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn((ev, cb) => { if (ev === 'change') listener = cb }),
      removeEventListener: vi.fn(),
    }))
    const { container } = render(
      <ThemeProvider mode="system">
        <TestComponent />
      </ThemeProvider>
    )
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    act(() => { listener?.({ matches: false }) })
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(container.firstChild).toHaveAttribute('data-theme', 'light')
  })

  it('contrast defaults to standard and high is applied to html and wrapper', () => {
    const { container, rerender } = render(
      <ThemeProvider mode="light"><TestComponent /></ThemeProvider>
    )
    expect(container.firstChild).toHaveAttribute('data-contrast', 'standard')
    expect(document.documentElement).toHaveAttribute('data-contrast', 'standard')
    rerender(<ThemeProvider mode="light" contrast="high"><TestComponent /></ThemeProvider>)
    expect(container.firstChild).toHaveAttribute('data-contrast', 'high')
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high')
  })

  it('calls onModeChange when setMode is called', () => {
    const onModeChange = vi.fn()
    render(
      <ThemeProvider mode="light" onModeChange={onModeChange}>
        <TestComponent />
      </ThemeProvider>
    )

    screen.getByText('Set Dark').click()
    expect(onModeChange).toHaveBeenCalledWith('dark')
  })

  it('throws error when useTheme is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useTheme must be used within ThemeProvider')
    
    consoleSpy.mockRestore()
  })
})
