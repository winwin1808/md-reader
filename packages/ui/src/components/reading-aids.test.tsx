import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import { WordCountBar } from './WordCountBar'
import { CelebrationConfetti } from './CelebrationConfetti'

describe('WordCountBar', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders word count, character count, and reading time correctly', () => {
    const sampleText = 'Xin chào thế giới! Đây là một bài kiểm tra markdown.'
    // sampleText has 11 words, 52 characters
    render(<WordCountBar text={sampleText} />)

    const bar = screen.getByRole('status')
    expect(bar).not.toBeNull()
    expect(bar.textContent).toContain('11 từ')
    expect(bar.textContent).toContain('52 ký tự')
    expect(bar.textContent).toContain('~1 phút đọc')
  })

  it('handles empty text gracefully', () => {
    render(<WordCountBar text="   " />)
    const bar = screen.getByRole('status')
    expect(bar.textContent).toContain('0 từ')
    expect(bar.textContent).toContain('3 ký tự')
    expect(bar.textContent).toContain('~1 phút đọc')
  })

  it('returns null when visible is false', () => {
    const { container } = render(<WordCountBar text="Hello world" visible={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('toggles is-hidden class on scroll near bottom when autoHide is true', () => {
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 })
    Object.defineProperty(document.documentElement, 'scrollHeight', { writable: true, configurable: true, value: 2000 })

    render(<WordCountBar text="Some text here" autoHide={true} />)
    const bar = screen.getByRole('status')
    expect(bar.classList.contains('word-count-bar')).toBe(true)
    expect(bar.classList.contains('is-hidden')).toBe(false)

    // Scroll to near bottom: innerHeight (800) + scrollY (1100) = 1900 >= 2000 - 120 (1880)
    window.scrollY = 1100
    fireEvent.scroll(window)
    expect(bar.classList.contains('is-hidden')).toBe(true)

    // Scroll back up
    window.scrollY = 500
    fireEvent.scroll(window)
    expect(bar.classList.contains('is-hidden')).toBe(false)
  })
})

describe('CelebrationConfetti', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders null or canvas when not active', () => {
    const { container } = render(<CelebrationConfetti active={false} />)
    expect(container.querySelector('.celebration-confetti-canvas')).toBeNull()
  })

  it('renders canvas when active and fires onComplete after duration', () => {
    const onComplete = vi.fn()
    // Mock getContext for canvas
    const getContextMock = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    })
    window.HTMLCanvasElement.prototype.getContext = getContextMock

    const { container } = render(
      <CelebrationConfetti active={true} duration={1500} onComplete={onComplete} />
    )

    const canvas = container.querySelector('.celebration-confetti-canvas')
    expect(canvas).not.toBeNull()

    // Advance timers by duration
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
