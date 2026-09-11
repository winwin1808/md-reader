import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { ReadingProgress } from './ReadingProgress'

describe('ReadingProgress', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 1000,
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 500,
    })
    Object.defineProperty(document.documentElement, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders progress bar with default styles', () => {
    const { container } = render(<ReadingProgress />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toBeTruthy()
    expect(el.className).toContain('reading-progress-bar')
    expect(el.className).toContain('md-no-print')
    expect(el.style.position).toBe('fixed')
    expect(el.style.top).toBe('0px')
    expect(el.style.left).toBe('0px')
    expect(el.style.height).toBe('3px')
    expect(el.style.zIndex).toBe('9999')
    expect(el.style.backgroundColor).toBe('var(--md-accent, #3b82f6)')
    expect(el.style.width).toBe('0%')
  })

  it('accepts custom color and className', () => {
    const { container } = render(<ReadingProgress color="#ff0000" className="custom-bar" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('reading-progress-bar')
    expect(el.className).toContain('md-no-print')
    expect(el.className).toContain('custom-bar')
    expect(el.style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('updates progress width on window scroll', () => {
    const { container } = render(<ReadingProgress />)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.width).toBe('0%')

    // Scroll halfway: (1000 - 500) total scrollable = 500, scrolled 250 => 50%
    document.documentElement.scrollTop = 250
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    expect(el.style.width).toBe('50%')
  })

  it('cleans up scroll and resize listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<ReadingProgress />)
    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
