import { render, screen, cleanup } from '@testing-library/react'
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

  it('calls onModeChange when setMode is called', () => {
    const onModeChange = vi.fn()
    render(
      <ThemeProvider mode="light" onModeChange={onModeChange}>
        <TestComponent />
      </ThemeProvider>
    )

    screen.getByRole('button').click()
    expect(onModeChange).toHaveBeenCalledWith('dark')
  })

  it('throws error when useTheme is used outside provider', () => {
    // Suppress console.error for expected error boundary log
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useTheme must be used within ThemeProvider')
    
    consoleSpy.mockRestore()
  })
})
