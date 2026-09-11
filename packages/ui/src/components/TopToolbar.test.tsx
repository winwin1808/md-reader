import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TopToolbar, type FontScale } from './TopToolbar'

describe('TopToolbar', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    title: 'Document Title',
    tocOpen: false,
    onToggleToc: vi.fn(),
    fontScale: 'md' as FontScale,
    onFontScaleChange: vi.fn(),
    isReadingMode: false,
    onToggleReadingMode: vi.fn(),
    onOpenSearch: vi.fn(),
  }

  it('renders header container with required class and inline styles', () => {
    const { container } = render(<TopToolbar {...defaultProps} />)
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
    expect(header?.classList.contains('top-toolbar')).toBe(true)
    expect(header?.classList.contains('md-no-print')).toBe(true)
    expect(header?.style.position).toBe('sticky')
    expect(header?.style.top).toBe('0px')
    expect(header?.style.height).toBe('48px')
    expect(header?.style.display).toBe('flex')
  })

  it('renders title and fallback when title is empty', () => {
    const { rerender } = render(<TopToolbar {...defaultProps} title="My Notes" />)
    expect(screen.getByText('My Notes')).toBeTruthy()

    rerender(<TopToolbar {...defaultProps} title="" />)
    expect(screen.getByText('Untitled')).toBeTruthy()
  })

  it('triggers onToggleToc when ToC button is clicked', () => {
    const onToggleToc = vi.fn()
    render(<TopToolbar {...defaultProps} onToggleToc={onToggleToc} />)

    const tocBtn = screen.getByRole('button', { name: 'Mục lục' })
    fireEvent.click(tocBtn)
    expect(onToggleToc).toHaveBeenCalledTimes(1)
  })

  it('displays correct percentage for font scales', () => {
    const { rerender } = render(<TopToolbar {...defaultProps} fontScale="sm" />)
    expect(screen.getByText('85%')).toBeTruthy()

    rerender(<TopToolbar {...defaultProps} fontScale="md" />)
    expect(screen.getByText('100%')).toBeTruthy()

    rerender(<TopToolbar {...defaultProps} fontScale="lg" />)
    expect(screen.getByText('115%')).toBeTruthy()

    rerender(<TopToolbar {...defaultProps} fontScale="xl" />)
    expect(screen.getByText('130%')).toBeTruthy()
  })

  it('handles font scale decrease and disabled state at sm', () => {
    const onFontScaleChange = vi.fn()
    const { rerender } = render(
      <TopToolbar {...defaultProps} fontScale="md" onFontScaleChange={onFontScaleChange} />
    )

    const decreaseBtn = screen.getByTitle('Giảm cỡ chữ') as HTMLButtonElement
    expect(decreaseBtn.disabled).toBe(false)
    fireEvent.click(decreaseBtn)
    expect(onFontScaleChange).toHaveBeenCalledWith('sm')

    rerender(
      <TopToolbar {...defaultProps} fontScale="sm" onFontScaleChange={onFontScaleChange} />
    )
    expect(decreaseBtn.disabled).toBe(true)
  })

  it('handles font scale increase and disabled state at xl', () => {
    const onFontScaleChange = vi.fn()
    const { rerender } = render(
      <TopToolbar {...defaultProps} fontScale="lg" onFontScaleChange={onFontScaleChange} />
    )

    const increaseBtn = screen.getByTitle('Tăng cỡ chữ') as HTMLButtonElement
    expect(increaseBtn.disabled).toBe(false)
    fireEvent.click(increaseBtn)
    expect(onFontScaleChange).toHaveBeenCalledWith('xl')

    rerender(
      <TopToolbar {...defaultProps} fontScale="xl" onFontScaleChange={onFontScaleChange} />
    )
    expect(increaseBtn.disabled).toBe(true)
  })

  it('triggers onOpenSearch when search button is clicked', () => {
    const onOpenSearch = vi.fn()
    render(<TopToolbar {...defaultProps} onOpenSearch={onOpenSearch} />)

    const searchBtn = screen.getByRole('button', { name: 'Tìm kiếm' })
    fireEvent.click(searchBtn)
    expect(onOpenSearch).toHaveBeenCalledTimes(1)
  })

  it('triggers onToggleReadingMode when reading mode button is clicked', () => {
    const onToggleReadingMode = vi.fn()
    render(<TopToolbar {...defaultProps} onToggleReadingMode={onToggleReadingMode} />)

    const readingBtn = screen.getByRole('button', { name: 'Chế độ tập trung' })
    fireEvent.click(readingBtn)
    expect(onToggleReadingMode).toHaveBeenCalledTimes(1)
  })

  it('renders rightActions when provided', () => {
    render(
      <TopToolbar
        {...defaultProps}
        rightActions={<div data-testid="custom-action">Custom Action</div>}
      />
    )
    expect(screen.getByTestId('custom-action')).toBeTruthy()
  })
})
