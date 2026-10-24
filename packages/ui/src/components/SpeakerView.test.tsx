import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Slide } from '@md-reader/core'
import { SpeakerView } from './SpeakerView'

vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: vi.fn(async () => ({ svg: '<svg data-testid="mm"></svg>' })) },
}))

describe('SpeakerView', () => {
  const slides: Slide[] = [
    {
      id: 'slide-0',
      index: 0,
      rawMarkdown: '# Slide 1 Title\n\nFirst slide body',
      html: '<h1>Slide 1 Title</h1><p>First slide body</p>',
      notes: ['Note 1A: intro', 'Note 1B: details'],
    },
    {
      id: 'slide-1',
      index: 1,
      rawMarkdown: '## Slide 2 Title',
      html: '<h2>Slide 2 Title</h2>',
      notes: ['Single note for slide 2'],
    },
    {
      id: 'slide-2',
      index: 2,
      rawMarkdown: '### Slide 3 Title',
      html: '<h3>Slide 3 Title</h3>',
      notes: [],
    },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders structure with container, header, body columns', () => {
    const onSlideChange = vi.fn()
    const { container } = render(
      <SpeakerView slides={slides} currentSlideIndex={0} onSlideChange={onSlideChange} />
    )

    expect(container.querySelector('.speaker-view-container')).not.toBeNull()
    expect(container.querySelector('.speaker-view-header')).not.toBeNull()
    expect(container.querySelector('.speaker-view-body')).not.toBeNull()
    expect(container.querySelector('.speaker-current-slide-wrapper')).not.toBeNull()
    expect(container.querySelector('.speaker-notes-box')).not.toBeNull()
  })

  it('renders slide counter and navigation buttons', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={0} onSlideChange={onSlideChange} />)

    expect(screen.getByText(/Trang 1 \/ 3/)).not.toBeNull()
    const prevBtn = screen.getByRole('button', { name: /Trước/i }) as HTMLButtonElement
    const nextBtn = screen.getByRole('button', { name: /Tiếp/i }) as HTMLButtonElement

    expect(prevBtn.disabled).toBe(true)
    expect(nextBtn.disabled).toBe(false)

    fireEvent.click(nextBtn)
    expect(onSlideChange).toHaveBeenCalledWith(1)
  })

  it('disables next button on the last slide and enables prev button', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={2} onSlideChange={onSlideChange} />)

    expect(screen.getByText(/Trang 3 \/ 3/)).not.toBeNull()
    const prevBtn = screen.getByRole('button', { name: /Trước/i }) as HTMLButtonElement
    const nextBtn = screen.getByRole('button', { name: /Tiếp/i }) as HTMLButtonElement

    expect(prevBtn.disabled).toBe(false)
    expect(nextBtn.disabled).toBe(true)

    fireEvent.click(prevBtn)
    expect(onSlideChange).toHaveBeenCalledWith(1)
  })

  it('renders current slide and next slide preview correctly', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={0} onSlideChange={onSlideChange} />)

    expect(screen.getByText('Trang hiện tại')).not.toBeNull()
    expect(screen.getByText('Slide 1 Title')).not.toBeNull()
    expect(screen.getByText('First slide body')).not.toBeNull()

    expect(screen.getByText('Trang tiếp theo')).not.toBeNull()
    expect(screen.getByText('Slide 2 Title')).not.toBeNull()
  })

  it('shows "(Đã đến slide cuối cùng)" when on last slide', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={2} onSlideChange={onSlideChange} />)

    expect(screen.getByText('(Đã đến slide cuối cùng)')).not.toBeNull()
  })

  it('renders speaker notes when present', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={0} onSlideChange={onSlideChange} />)

    expect(screen.getByText('Ghi chú')).not.toBeNull()
    expect(screen.getByText('Note 1A: intro')).not.toBeNull()
    expect(screen.getByText('Note 1B: details')).not.toBeNull()
  })

  it('displays "(Không có ghi chú cho slide này)" when slide has no notes', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={2} onSlideChange={onSlideChange} />)

    expect(screen.getByText('(Không có ghi chú cho slide này)')).not.toBeNull()
  })

  it('handles keyboard navigation: ArrowRight, ArrowDown, Space, PageDown', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={0} onSlideChange={onSlideChange} />)

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onSlideChange).toHaveBeenCalledWith(1)

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(onSlideChange).toHaveBeenCalledWith(1)

    fireEvent.keyDown(window, { key: ' ' })
    expect(onSlideChange).toHaveBeenCalledWith(1)

    fireEvent.keyDown(window, { key: 'PageDown' })
    expect(onSlideChange).toHaveBeenCalledWith(1)
  })

  it('handles keyboard navigation: ArrowLeft, ArrowUp, Backspace, PageUp', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={1} onSlideChange={onSlideChange} />)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onSlideChange).toHaveBeenCalledWith(0)

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(onSlideChange).toHaveBeenCalledWith(0)

    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(onSlideChange).toHaveBeenCalledWith(0)

    fireEvent.keyDown(window, { key: 'PageUp' })
    expect(onSlideChange).toHaveBeenCalledWith(0)
  })

  it('does not trigger keyboard navigation when focus is on an input or button', () => {
    const onSlideChange = vi.fn()
    render(
      <div>
        <input data-testid="dummy-input" />
        <SpeakerView slides={slides} currentSlideIndex={1} onSlideChange={onSlideChange} />
      </div>
    )

    const input = screen.getByTestId('dummy-input')
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(onSlideChange).not.toHaveBeenCalled()

    const btn = screen.getByRole('button', { name: /Trước/i })
    btn.focus()
    fireEvent.keyDown(btn, { key: 'ArrowRight' })
    expect(onSlideChange).not.toHaveBeenCalled()
  })

  it('supports external elapsedSeconds and onResetTimer', () => {
    const onSlideChange = vi.fn()
    const onResetTimer = vi.fn()
    render(
      <SpeakerView
        slides={slides}
        currentSlideIndex={0}
        onSlideChange={onSlideChange}
        elapsedSeconds={125}
        onResetTimer={onResetTimer}
      />
    )

    expect(screen.getByText('02:05')).not.toBeNull()

    const resetBtn = screen.getByRole('button', { name: /Đặt lại/i })
    fireEvent.click(resetBtn)
    expect(onResetTimer).toHaveBeenCalledTimes(1)
  })

  it('maintains internal timer when elapsedSeconds is not provided', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={0} onSlideChange={onSlideChange} />)

    expect(screen.getByText('00:00')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('00:05')).not.toBeNull()

    // Pause timer
    const pauseBtn = screen.getByRole('button', { name: /Tạm dừng/i })
    fireEvent.click(pauseBtn)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('00:05')).not.toBeNull()

    // Resume timer
    const startBtn = screen.getByRole('button', { name: /Tiếp tục/i })
    fireEvent.click(startBtn)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('00:08')).not.toBeNull()

    // Reset timer
    const resetBtn = screen.getByRole('button', { name: /Đặt lại/i })
    fireEvent.click(resetBtn)
    expect(screen.getByText('00:00')).not.toBeNull()
  })

  it('displays local current time', () => {
    const onSlideChange = vi.fn()
    render(<SpeakerView slides={slides} currentSlideIndex={0} onSlideChange={onSlideChange} />)

    expect(screen.getByTestId('speaker-clock')).not.toBeNull()
  })

  it('labels are sentence case, not uppercase', () => {
    const { container } = render(<SpeakerView slides={slides} currentSlideIndex={0} onSlideChange={vi.fn()} />)
    const labels = Array.from(container.querySelectorAll('.speaker-section-label, .speaker-timer-label'))
    expect(labels.length).toBeGreaterThanOrEqual(4)
    for (const l of labels) {
      const t = l.textContent ?? ''
      expect(t).not.toBe(t.toUpperCase())
    }
    expect(screen.getByText('Đã trình bày')).not.toBeNull()
  })

  it('mounts a diagram for mermaid blocks when mermaid is on', async () => {
    vi.useRealTimers()
    const ms: Slide[] = [{ id: 's', index: 0, rawMarkdown: '', html: '<pre><code class="language-mermaid">graph TD;A-->B</code></pre>', notes: [] }]
    const { container } = render(<SpeakerView slides={ms} currentSlideIndex={0} onSlideChange={() => {}} mermaid />)
    await vi.waitFor(() => expect(container.querySelector('svg')).not.toBeNull())
  })
})
