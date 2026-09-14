import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
import type { Slide } from '@md-reader/core'
import { Deck } from './Deck'

const mockSlides: Slide[] = [
  { index: 0, html: '<h1>Slide 1 Title</h1>', raw: '# Slide 1 Title', notes: 'Speaker note 1' },
  { index: 1, html: '<h2>Slide 2 Title</h2>', raw: '## Slide 2 Title', notes: 'Speaker note 2' },
  { index: 2, html: '<h3>Slide 3 Title</h3>', raw: '### Slide 3 Title' },
]

describe('Deck component', () => {
  it('renders fullscreen overlay, slide canvas with md-viewer, and current slide content', () => {
    const { container } = render(<Deck slides={mockSlides} />)
    const overlay = container.querySelector('.deck-overlay')
    expect(overlay).not.toBeNull()

    const slideCanvas = container.querySelector('.deck-slide')
    expect(slideCanvas).not.toBeNull()

    const mdViewer = slideCanvas?.querySelector('.md-viewer')
    expect(mdViewer).not.toBeNull()
    expect(mdViewer?.innerHTML).toContain('<h1>Slide 1 Title</h1>')
  })

  it('respects initialSlide prop', () => {
    const { container } = render(<Deck slides={mockSlides} initialSlide={1} />)
    const mdViewer = container.querySelector('.deck-slide .md-viewer')
    expect(mdViewer?.innerHTML).toContain('<h2>Slide 2 Title</h2>')
    expect(screen.getByText('Slide 2 / 3')).toBeDefined()
  })

  it('renders bottom floating controls and progress bar', () => {
    const { container } = render(<Deck slides={mockSlides} />)
    const controls = container.querySelector('.deck-controls')
    expect(controls).not.toBeNull()

    expect(screen.getByText('Slide 1 / 3')).toBeDefined()

    const prevBtn = screen.getByRole('button', { name: 'Slide trước' })
    expect(prevBtn).toBeDefined()
    expect(prevBtn.textContent).toBe('←')
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true)

    const nextBtn = screen.getByRole('button', { name: 'Slide kế tiếp' })
    expect(nextBtn).toBeDefined()
    expect(nextBtn.textContent).toBe('→')
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false)

    const speakerBtn = screen.getByRole('button', { name: 'Giao diện diễn giả' })
    expect(speakerBtn).toBeDefined()
    expect(speakerBtn.textContent).toBe('🎙')
    expect(speakerBtn.getAttribute('title')).toBe('Mở chế độ diễn giả')

    const exitBtn = screen.getByRole('button', { name: 'Thoát trình chiếu' })
    expect(exitBtn).toBeDefined()
    expect(exitBtn.textContent).toBe('✕')
    expect(exitBtn.getAttribute('title')).toBe('Thoát (Esc)')

    const progressBar = container.querySelector('.deck-progress-bar') as HTMLElement
    expect(progressBar).not.toBeNull()
    expect(progressBar.style.width).toBe(`${(1 / 3) * 100}%`)
  })

  it('handles prev and next navigation via buttons and fires onSlideChange', () => {
    const onSlideChange = vi.fn()
    render(<Deck slides={mockSlides} onSlideChange={onSlideChange} />)

    const nextBtn = screen.getByRole('button', { name: 'Slide kế tiếp' })
    const prevBtn = screen.getByRole('button', { name: 'Slide trước' })

    fireEvent.click(nextBtn)
    expect(screen.getByText('Slide 2 / 3')).toBeDefined()
    expect(onSlideChange).toHaveBeenCalledWith(1)
    expect((prevBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(nextBtn)
    expect(screen.getByText('Slide 3 / 3')).toBeDefined()
    expect(onSlideChange).toHaveBeenCalledWith(2)
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(prevBtn)
    expect(screen.getByText('Slide 2 / 3')).toBeDefined()
    expect(onSlideChange).toHaveBeenCalledWith(1)
  })

  it('calls onOpenSpeakerView when speaker button is clicked', () => {
    const onOpenSpeakerView = vi.fn()
    render(<Deck slides={mockSlides} onOpenSpeakerView={onOpenSpeakerView} />)

    const speakerBtn = screen.getByRole('button', { name: 'Giao diện diễn giả' })
    fireEvent.click(speakerBtn)
    expect(onOpenSpeakerView).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when exit button is clicked', () => {
    const onClose = vi.fn()
    render(<Deck slides={mockSlides} onClose={onClose} />)

    const exitBtn = screen.getByRole('button', { name: 'Thoát trình chiếu' })
    fireEvent.click(exitBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('keyboard navigation', () => {
    it('navigates next on ArrowRight, ArrowDown, PageDown, Space', () => {
      const onSlideChange = vi.fn()
      render(<Deck slides={mockSlides} onSlideChange={onSlideChange} />)

      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(screen.getByText('Slide 2 / 3')).toBeDefined()
      expect(onSlideChange).toHaveBeenLastCalledWith(1)

      fireEvent.keyDown(window, { key: 'ArrowDown' })
      expect(screen.getByText('Slide 3 / 3')).toBeDefined()
      expect(onSlideChange).toHaveBeenLastCalledWith(2)

      // Reset to 0 with Home
      fireEvent.keyDown(window, { key: 'Home' })
      expect(screen.getByText('Slide 1 / 3')).toBeDefined()

      // PageDown
      fireEvent.keyDown(window, { key: 'PageDown' })
      expect(screen.getByText('Slide 2 / 3')).toBeDefined()

      // Space
      fireEvent.keyDown(window, { key: ' ' })
      expect(screen.getByText('Slide 3 / 3')).toBeDefined()
    })

    it('navigates prev on ArrowLeft, ArrowUp, PageUp, Backspace', () => {
      render(<Deck slides={mockSlides} initialSlide={2} />)

      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      expect(screen.getByText('Slide 2 / 3')).toBeDefined()

      fireEvent.keyDown(window, { key: 'ArrowUp' })
      expect(screen.getByText('Slide 1 / 3')).toBeDefined()

      // End
      fireEvent.keyDown(window, { key: 'End' })
      expect(screen.getByText('Slide 3 / 3')).toBeDefined()

      // PageUp
      fireEvent.keyDown(window, { key: 'PageUp' })
      expect(screen.getByText('Slide 2 / 3')).toBeDefined()

      // Backspace
      fireEvent.keyDown(window, { key: 'Backspace' })
      expect(screen.getByText('Slide 1 / 3')).toBeDefined()
    })

    it('calls onClose on Escape key', () => {
      const onClose = vi.fn()
      render(<Deck slides={mockSlides} onClose={onClose} />)

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not trigger keyboard navigation if focus is inside input, textarea, or button', () => {
      const onSlideChange = vi.fn()
      render(
        <div>
          <input data-testid="test-input" />
          <textarea data-testid="test-textarea" />
          <button data-testid="test-button">Click</button>
          <Deck slides={mockSlides} onSlideChange={onSlideChange} />
        </div>
      )

      const input = screen.getByTestId('test-input')
      input.focus()
      fireEvent.keyDown(input, { key: 'ArrowRight' })
      expect(screen.getByText('Slide 1 / 3')).toBeDefined()
      expect(onSlideChange).not.toHaveBeenCalled()

      const textarea = screen.getByTestId('test-textarea')
      textarea.focus()
      fireEvent.keyDown(textarea, { key: 'ArrowRight' })
      expect(screen.getByText('Slide 1 / 3')).toBeDefined()
      expect(onSlideChange).not.toHaveBeenCalled()

      const button = screen.getByTestId('test-button')
      button.focus()
      fireEvent.keyDown(button, { key: 'ArrowRight' })
      expect(screen.getByText('Slide 1 / 3')).toBeDefined()
      expect(onSlideChange).not.toHaveBeenCalled()
    })
  })

  it('handles empty slides gracefully', () => {
    const { container } = render(<Deck slides={[]} />)
    expect(screen.getByText('Slide 0 / 0')).toBeDefined()
    const progressBar = container.querySelector('.deck-progress-bar') as HTMLElement
    expect(progressBar.style.width).toBe('0%')
  })

  it('passes colorTheme and mode to ThemeProvider', () => {
    const { container } = render(<Deck slides={mockSlides} colorTheme="github" mode="dark" />)
    const themeWrapper = container.querySelector('[data-theme="dark"][data-color-theme="github"]')
    expect(themeWrapper).not.toBeNull()
  })

  it('is exported from packages/ui/src/index.ts', async () => {
    const uiIndex = await import('../index')
    expect(uiIndex.Deck).toBeDefined()
    expect(uiIndex.Deck).toBe(Deck)
  })
})
