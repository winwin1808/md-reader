import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
import type { Slide } from '@md-reader/core'
import { Deck, fitScale } from './Deck'

const mockSlides: Slide[] = [
  { id: 'slide-0', index: 0, html: '<h1>Slide 1 Title</h1>', rawMarkdown: '# Slide 1 Title', notes: ['Speaker note 1'] },
  { id: 'slide-1', index: 1, html: '<h2>Slide 2 Title</h2>', rawMarkdown: '## Slide 2 Title', notes: ['Speaker note 2'] },
  { id: 'slide-2', index: 2, html: '<h3>Slide 3 Title</h3>', rawMarkdown: '### Slide 3 Title', notes: [] },
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
    expect(screen.getByText('Trang 2 / 3')).toBeDefined()
  })

  it('renders bottom floating controls and progress bar', () => {
    const { container } = render(<Deck slides={mockSlides} />)
    const controls = container.querySelector('.deck-controls')
    expect(controls).not.toBeNull()

    expect(screen.getByText('Trang 1 / 3')).toBeDefined()

    const prevBtn = screen.getByRole('button', { name: 'Trang trước' })
    expect(prevBtn).toBeDefined()
    expect(prevBtn.querySelector('svg')).not.toBeNull()
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true)

    const nextBtn = screen.getByRole('button', { name: 'Trang sau' })
    expect(nextBtn).toBeDefined()
    expect(nextBtn.querySelector('svg')).not.toBeNull()
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false)

    const speakerBtn = screen.getByRole('button', { name: 'Cửa sổ diễn giả' })
    expect(speakerBtn).toBeDefined()
    expect(speakerBtn.querySelector('svg')).not.toBeNull()
    expect(speakerBtn.getAttribute('title')).toBe('Cửa sổ diễn giả')

    const exitBtn = screen.getByRole('button', { name: 'Thoát trình chiếu' })
    expect(exitBtn).toBeDefined()
    expect(exitBtn.querySelector('svg')).not.toBeNull()
    expect(exitBtn.getAttribute('title')).toBe('Thoát (Esc)')

    const progressBar = container.querySelector('.deck-progress-bar') as HTMLElement
    expect(progressBar).not.toBeNull()
    expect(progressBar.style.width).toBe(`${(1 / 3) * 100}%`)
  })

  it('handles prev and next navigation via buttons and fires onSlideChange', () => {
    const onSlideChange = vi.fn()
    render(<Deck slides={mockSlides} onSlideChange={onSlideChange} />)

    const nextBtn = screen.getByRole('button', { name: 'Trang sau' })
    const prevBtn = screen.getByRole('button', { name: 'Trang trước' })

    fireEvent.click(nextBtn)
    expect(screen.getByText('Trang 2 / 3')).toBeDefined()
    expect(onSlideChange).toHaveBeenCalledWith(1)
    expect((prevBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(nextBtn)
    expect(screen.getByText('Trang 3 / 3')).toBeDefined()
    expect(onSlideChange).toHaveBeenCalledWith(2)
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(prevBtn)
    expect(screen.getByText('Trang 2 / 3')).toBeDefined()
    expect(onSlideChange).toHaveBeenCalledWith(1)
  })

  it('calls onOpenSpeakerView when speaker button is clicked', () => {
    const onOpenSpeakerView = vi.fn()
    render(<Deck slides={mockSlides} onOpenSpeakerView={onOpenSpeakerView} />)

    const speakerBtn = screen.getByRole('button', { name: 'Cửa sổ diễn giả' })
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
      expect(screen.getByText('Trang 2 / 3')).toBeDefined()
      expect(onSlideChange).toHaveBeenLastCalledWith(1)

      fireEvent.keyDown(window, { key: 'ArrowDown' })
      expect(screen.getByText('Trang 3 / 3')).toBeDefined()
      expect(onSlideChange).toHaveBeenLastCalledWith(2)

      // Reset to 0 with Home
      fireEvent.keyDown(window, { key: 'Home' })
      expect(screen.getByText('Trang 1 / 3')).toBeDefined()

      // PageDown
      fireEvent.keyDown(window, { key: 'PageDown' })
      expect(screen.getByText('Trang 2 / 3')).toBeDefined()

      // Space
      fireEvent.keyDown(window, { key: ' ' })
      expect(screen.getByText('Trang 3 / 3')).toBeDefined()
    })

    it('navigates prev on ArrowLeft, ArrowUp, PageUp, Backspace', () => {
      render(<Deck slides={mockSlides} initialSlide={2} />)

      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      expect(screen.getByText('Trang 2 / 3')).toBeDefined()

      fireEvent.keyDown(window, { key: 'ArrowUp' })
      expect(screen.getByText('Trang 1 / 3')).toBeDefined()

      // End
      fireEvent.keyDown(window, { key: 'End' })
      expect(screen.getByText('Trang 3 / 3')).toBeDefined()

      // PageUp
      fireEvent.keyDown(window, { key: 'PageUp' })
      expect(screen.getByText('Trang 2 / 3')).toBeDefined()

      // Backspace
      fireEvent.keyDown(window, { key: 'Backspace' })
      expect(screen.getByText('Trang 1 / 3')).toBeDefined()
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
      expect(screen.getByText('Trang 1 / 3')).toBeDefined()
      expect(onSlideChange).not.toHaveBeenCalled()

      const textarea = screen.getByTestId('test-textarea')
      textarea.focus()
      fireEvent.keyDown(textarea, { key: 'ArrowRight' })
      expect(screen.getByText('Trang 1 / 3')).toBeDefined()
      expect(onSlideChange).not.toHaveBeenCalled()

    })

    it('leaves Space and Enter on a focused button to the button', () => {
      const onSlideChange = vi.fn()
      render(<Deck slides={mockSlides} onSlideChange={onSlideChange} />)
      const next = screen.getByRole('button', { name: 'Trang sau' })
      next.focus()
      fireEvent.keyDown(next, { key: ' ' })
      fireEvent.keyDown(next, { key: 'Enter' })
      expect(onSlideChange).not.toHaveBeenCalled()
    })

    it('focuses the overlay on open, handles keys, and restores focus on close', () => {
      const outside = document.createElement('button')
      document.body.appendChild(outside)
      outside.focus()
      expect(document.activeElement).toBe(outside)
      const onClose = vi.fn()
      const { container, unmount } = render(<Deck slides={mockSlides} onClose={onClose} />)
      const overlay = container.querySelector('.deck-overlay') as HTMLElement
      expect(overlay.getAttribute('role')).toBe('dialog')
      expect(overlay.getAttribute('aria-modal')).toBe('true')
      expect(overlay.getAttribute('aria-label')).toBe('Trình chiếu')
      expect(document.activeElement).toBe(overlay)
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' })
      expect(screen.getByText('Trang 2 / 3')).toBeDefined()
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
      unmount()
      expect(document.activeElement).toBe(outside)
      outside.remove()
    })

    it('ArrowRight advances while a deck control button is focused', () => {
      render(<Deck slides={mockSlides} />)
      const speaker = screen.getByRole('button', { name: 'Cửa sổ diễn giả' })
      speaker.focus()
      fireEvent.keyDown(speaker, { key: 'ArrowRight' })
      expect(screen.getByText('Trang 2 / 3')).toBeDefined()
    })

    it('Tab cycles within the deck controls', () => {
      render(<Deck slides={mockSlides} />)
      const exit = screen.getByRole('button', { name: 'Thoát trình chiếu' })
      const next = screen.getByRole('button', { name: 'Trang sau' })
      exit.focus()
      fireEvent.keyDown(exit, { key: 'Tab' })
      expect(document.activeElement).toBe(next)
      fireEvent.keyDown(next, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(exit)
    })

    it('a keydown reveals hidden controls', () => {
      vi.useFakeTimers()
      try {
        const { container } = render(<Deck slides={mockSlides} />)
        const controls = container.querySelector('.deck-controls') as HTMLElement
        act(() => { vi.advanceTimersByTime(2100) })
        expect(controls.classList.contains('deck-controls-hidden')).toBe(true)
        fireEvent.keyDown(window, { key: 'ArrowRight' })
        expect(controls.classList.contains('deck-controls-hidden')).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('handles empty slides gracefully', () => {
    const { container } = render(<Deck slides={[]} />)
    expect(screen.getByText('Trang 0 / 0')).toBeDefined()
    const progressBar = container.querySelector('.deck-progress-bar') as HTMLElement
    expect(progressBar.style.width).toBe('0%')
  })

  it('passes mode to ThemeProvider', () => {
    const { container } = render(<Deck slides={mockSlides} mode="dark" />)
    const themeWrapper = container.querySelector('[data-theme="dark"]')
    expect(themeWrapper).not.toBeNull()
  })

  it('is exported from packages/ui/src/index.ts', async () => {
    const uiIndex = await import('../index')
    expect(uiIndex.Deck).toBeDefined()
    expect(uiIndex.Deck).toBe(Deck)
  })

  describe('presentation customization settings', () => {
    it('applies custom background color, text color, and font', () => {
      const { container } = render(
        <Deck
          slides={mockSlides}
          presentationSettings={{
            slideBgColor: '#123456',
            slideTextColor: '#abcdef',
            slideFont: 'Georgia, serif',
          }}
        />
      )
      const overlay = container.querySelector('.deck-overlay') as HTMLElement
      const frame = container.querySelector('.deck-slide-frame') as HTMLElement
      expect(overlay.style.backgroundColor).toBe('')
      expect(overlay.style.color).toBe('')
      expect(frame.style.getPropertyValue('--slide-bg')).toBe('#123456')
      expect(frame.style.getPropertyValue('--slide-fg')).toBe('#abcdef')
      expect(frame.style.getPropertyValue('--slide-font')).toBe('Georgia, serif')
    })

    it('renders background image and applies opacity', () => {
      const { container, rerender } = render(
        <Deck
          slides={mockSlides}
          presentationSettings={{
            slideBgImage: 'https://example.com/bg.png',
            slideImageOpacity: 45,
          }}
        />
      )
      const bgImage = container.querySelector('.deck-custom-bg-image') as HTMLElement
      expect(bgImage).not.toBeNull()
      expect(bgImage.style.backgroundImage).toBe('url("https://example.com/bg.png")')
      expect(bgImage.style.opacity).toBe('0.45')
      expect(bgImage.getAttribute('aria-hidden')).toBe('true')

      // default opacity when not specified is 100% (1)
      rerender(
        <Deck
          slides={mockSlides}
          presentationSettings={{
            slideBgImage: 'https://example.com/bg2.png',
          }}
        />
      )
      const bgImage2 = container.querySelector('.deck-custom-bg-image') as HTMLElement
      expect(bgImage2.style.backgroundImage).toBe('url("https://example.com/bg2.png")')
      expect(bgImage2.style.opacity).toBe('1')

      // does not render bg div when slideBgImage is not provided or empty
      rerender(
        <Deck
          slides={mockSlides}
          presentationSettings={{
            slideBgImage: '',
          }}
        />
      )
      expect(container.querySelector('.deck-custom-bg-image')).toBeNull()
    })

    it('applies heading color and accent variables as CSS custom properties', () => {
      const { container } = render(
        <Deck
          slides={mockSlides}
          presentationSettings={{
            slideHeadingColor: '#ff0000',
            slideAccentColor: '#00ff00',
          }}
        />
      )
      const overlay = container.querySelector('.deck-overlay') as HTMLElement
      expect(overlay).not.toBeNull()
      expect(overlay.style.getPropertyValue('--slide-custom-heading')).toBe('#ff0000')
      expect(overlay.style.getPropertyValue('--slide-custom-accent')).toBe('#00ff00')
    })

    it('ensures slide content inside .deck-slide .md-viewer inherits custom styling and has transparent background', () => {
      const { container } = render(
        <Deck
          slides={[{ id: 's1', index: 0, html: '<p>Custom slide text</p><span>Span text</span>', rawMarkdown: 'Custom slide text', notes: [] }]}
          presentationSettings={{
            slideBgColor: '#222222',
            slideTextColor: '#f0f0f0',
            slideFont: 'Inter, sans-serif',
          }}
        />
      )

      const overlay = container.querySelector('.deck-overlay') as HTMLElement
      const slide = container.querySelector('.deck-slide') as HTMLElement
      const mdViewer = slide.querySelector('.md-viewer') as HTMLElement
      expect(overlay).not.toBeNull()
      expect(slide).not.toBeNull()
      expect(mdViewer).not.toBeNull()
      expect(slide.contains(mdViewer)).toBe(true)
      expect(overlay.style.backgroundColor).toBe('')
      expect(slide.style.getPropertyValue('--slide-bg')).toBe('#222222')
      expect(slide.style.getPropertyValue('--slide-fg')).toBe('#f0f0f0')
      expect(slide.style.getPropertyValue('--slide-font')).toBe('Inter, sans-serif')

      // Verify deck.css cascade rules for .deck-slide .md-viewer
      const cssPath = path.resolve(__dirname, '../theme/deck.css')
      const css = fs.readFileSync(cssPath, 'utf-8')
      expect(css).toMatch(/\.deck-slide\s+\.md-viewer\s*\{[^}]*background-color:\s*transparent\s*!important;/)
      expect(css).toMatch(/\.deck-slide\s+\.md-viewer\s*\{[^}]*color:\s*inherit;/)
      expect(css).toMatch(/\.deck-slide\s+\.md-viewer\s*\{[^}]*font-family:\s*inherit;/)
      expect(css).toMatch(/\.deck-slide\s+\.md-viewer\s+p,\s*\n*\s*\.deck-slide\s+\.md-viewer\s+li,\s*\n*\s*\.deck-slide\s+\.md-viewer\s+span\s*\{[^}]*color:\s*inherit;/)
      expect(css).not.toMatch(/\.deck-slide-content\s*\{[^}]*(color|font-family):\s*inherit;/)
    })
  })
})

describe('Deck scaling and controls', () => {
  it('fitScale fits the logical 1280x720 box', () => {
    expect(fitScale(1920, 1080)).toBe(1.5)
    expect(fitScale(800, 800)).toBe(0.625)
    expect(fitScale(0, 0)).toBe(1)
  })

  it('scales the slide frame from a ResizeObserver callback', () => {
    let cb: ResizeObserverCallback = () => {}
    class MockRO {
      constructor(c: ResizeObserverCallback) { cb = c }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', MockRO)
    try {
      const { container } = render(<Deck slides={mockSlides} />)
      const frame = container.querySelector('.deck-slide-frame') as HTMLElement
      expect(frame.style.width).toBe('1280px')
      act(() => {
        cb([{ contentRect: { width: 1920, height: 1080 } } as ResizeObserverEntry], {} as ResizeObserver)
      })
      expect(frame.style.transform).toBe('scale(1.5)')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('hides controls after 2s idle and shows them on mousemove', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<Deck slides={mockSlides} />)
      const controls = container.querySelector('.deck-controls') as HTMLElement
      expect(controls.classList.contains('deck-controls-hidden')).toBe(false)
      act(() => { vi.advanceTimersByTime(2100) })
      expect(controls.classList.contains('deck-controls-hidden')).toBe(true)
      fireEvent.mouseMove(container.querySelector('.deck-overlay') as HTMLElement)
      expect(controls.classList.contains('deck-controls-hidden')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Deck mermaid prop', () => {
  const mm: Slide[] = [
    { id: 's', index: 0, html: '<pre><code class="language-mermaid">graph TD; A--&gt;B</code></pre>', rawMarkdown: '', notes: [] },
  ]
  it('mermaid={false} keeps the code block visible and mounts no MermaidBlock', async () => {
    const { container } = render(<Deck slides={mm} mermaid={false} />)
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    const pre = container.querySelector('pre') as HTMLElement
    expect(pre).not.toBeNull()
    expect(pre.style.display).not.toBe('none')
    expect(container.querySelectorAll('.deck-slide-content > div').length).toBe(0)
  })
})
