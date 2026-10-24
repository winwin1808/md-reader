import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { ExportModal } from './ExportModal'

afterEach(() => {
  cleanup()
})

function open(onExport = vi.fn().mockResolvedValue(undefined), hasSlides = true, onOpenChange = vi.fn()) {
  render(<ExportModal open onOpenChange={onOpenChange} onExport={onExport} hasSlides={hasSlides} />)
  return { onExport, onOpenChange }
}

describe('ExportModal', () => {
  it('uncontrolled: trigger opens the dialog with named formats', () => {
    render(<ExportModal onExport={vi.fn()} hasSlides />)
    fireEvent.click(screen.getByTitle('Xuất tài liệu'))
    expect(screen.getByRole('heading', { name: 'Xuất tài liệu' })).toBeDefined()
    expect(screen.getByText('Trang web (.html)')).toBeDefined()
    expect(screen.getByText('PDF để in')).toBeDefined()
    expect(screen.getByText('Word (.docx)')).toBeDefined()
    expect(screen.getByText('PDF trình chiếu')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDefined()
  })

  it('hides slides row when hasSlides is false', () => {
    open(undefined, false)
    expect(screen.queryByText('PDF trình chiếu')).toBeNull()
  })

  it('shows pending state, disables other rows and sets aria-busy while working', async () => {
    let resolve!: () => void
    const onExport = vi.fn(() => new Promise<void>((r) => { resolve = r }))
    const { onOpenChange } = open(onExport)
    fireEvent.click(screen.getByText('Word (.docx)'))
    expect(onExport).toHaveBeenCalledWith('docx')
    expect(screen.getByText('Đang tạo file Word…')).toBeDefined()
    expect(screen.getByRole('dialog').getAttribute('aria-busy')).toBe('true')
    expect((screen.getByText('PDF để in').closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect(onOpenChange).not.toHaveBeenCalled()
    await act(async () => { resolve() })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Esc is ignored while working, works when idle', async () => {
    let resolve!: () => void
    const onExport = vi.fn(() => new Promise<void>((r) => { resolve = r }))
    const { onOpenChange } = open(onExport)
    fireEvent.click(screen.getByText('PDF để in'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
    await act(async () => { resolve() })
    onOpenChange.mockClear()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('failure keeps dialog open, shows error, and Thử lại re-runs same format', async () => {
    const onExport = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined)
    const { onOpenChange } = open(onExport)
    await act(async () => { fireEvent.click(screen.getByText('Trang web (.html)')) })
    expect(screen.getByRole('alert').textContent).toContain('boom')
    expect(onOpenChange).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })) })
    expect(onExport).toHaveBeenCalledTimes(2)
    expect(onExport).toHaveBeenLastCalledWith('html')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes via close button and backdrop when idle', () => {
    const { onOpenChange } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    fireEvent.click(screen.getByRole('dialog'))
    expect(onOpenChange).toHaveBeenCalledTimes(2)
  })

  it('renders dialog card with token background', () => {
    open()
    const card = screen.getByRole('dialog').firstChild as HTMLElement
    expect(card.style.background).toContain('var(--paper)')
  })
})
