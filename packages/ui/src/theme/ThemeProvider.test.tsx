import { render, screen, cleanup, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeProvider'
import React from 'react'

const TestComponent = () => {
  const { mode, resolved, setMode } = useTheme()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setMode('dark')}>Set Dark</button>
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

  it('system mode resolves dark on first render (initializer, not effect)', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const seen: string[] = []
    const Probe = () => {
      seen.push(useTheme().resolved)
      return null
    }
    render(
      <ThemeProvider mode="system">
        <Probe />
      </ThemeProvider>
    )
    expect(seen[0]).toBe('dark')
  })

  it('nested provider stays scoped and does not touch html', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const { container, rerender } = render(
      <ThemeProvider mode="dark" contrast="high">
        <div data-testid="slot" />
      </ThemeProvider>
    )
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    rerender(
      <ThemeProvider mode="dark" contrast="high">
        <ThemeProvider mode="system">
          <span data-testid="inner" />
        </ThemeProvider>
      </ThemeProvider>
    )
    const inner = screen.getByTestId('inner').parentElement!
    expect(inner).toHaveAttribute('data-theme', 'light')
    expect(inner).toHaveAttribute('data-contrast', 'high')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    rerender(
      <ThemeProvider mode="dark" contrast="high">
        <div data-testid="slot" />
      </ThemeProvider>
    )
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high')
    expect(container.firstChild).toHaveAttribute('data-theme', 'dark')
  })

  it('outermost provider removes html attributes on unmount', () => {
    const { unmount } = render(
      <ThemeProvider mode="dark"><TestComponent /></ThemeProvider>
    )
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    unmount()
    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(document.documentElement).not.toHaveAttribute('data-contrast')
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
