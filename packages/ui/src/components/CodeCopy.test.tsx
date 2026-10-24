import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Viewer } from '../Viewer'

vi.mock('mermaid', () => ({ default: { initialize: () => {}, render: async () => ({ svg: '<svg/>' }) } }))

describe('Viewer code copy and header enhancement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders code block header with language badge and copy button, and handles copy', async () => {
    const html = '<pre><code class="language-js">console.log("hello")</code></pre>'
    const { container } = render(<Viewer html={html} />)

    const header = container.querySelector('.code-block-header')
    expect(header).not.toBeNull()

    const badge = container.querySelector('.code-lang-badge')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('js')

    const copyBtn = container.querySelector('.code-copy-btn') as HTMLButtonElement | null
    expect(copyBtn).not.toBeNull()
    expect(copyBtn?.textContent).toBe('Sao chép')
    expect(copyBtn?.getAttribute('title')).toBeNull()
    expect(copyBtn?.getAttribute('aria-label')).toBe('Sao chép mã')

    // Click "Copy"
    await act(async () => {
      fireEvent.click(copyBtn!)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("hello")')
    expect(copyBtn?.textContent).toBe('Đã chép')
    expect(copyBtn?.classList.contains('copied')).toBe(true)

    // After 1500ms, restore text to "Copy" and remove class .copied
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(copyBtn?.textContent).toBe('Sao chép')
    expect(copyBtn?.classList.contains('copied')).toBe(false)
  })

  it('defaults to "text" if language is not specified', () => {
    const html = '<pre><code>plain text</code></pre>'
    const { container } = render(<Viewer html={html} />)

    const badge = container.querySelector('.code-lang-badge')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('text')
  })

  it('does not add header to mermaid blocks', () => {
    const html = '<pre class="mermaid-block"><code class="language-mermaid">graph TD; A-->B;</code></pre>'
    const { container } = render(<Viewer html={html} />)

    const header = container.querySelector('.code-block-header')
    expect(header).toBeNull()
  })

  it('does not change button text to "Copied ✓" if clipboard write fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Failed to copy')
    )
    const html = '<pre><code class="language-js">console.log("hello")</code></pre>'
    const { container } = render(<Viewer html={html} />)

    const copyBtn = container.querySelector('.code-copy-btn') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(copyBtn)
    })

    expect(copyBtn.textContent).toBe('Sao chép')
    expect(copyBtn.classList.contains('copied')).toBe(false)
    consoleError.mockRestore()
  })
})
