import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ExportModal } from './ExportModal'

afterEach(() => {
  cleanup()
})

describe('ExportModal', () => {
  it('renders trigger button with title "Xuất tài liệu"', () => {
    render(<ExportModal onExport={vi.fn()} />)
    const trigger = screen.getByTitle('Xuất tài liệu')
    expect(trigger).toBeDefined()
  })

  it('opens modal dialog when trigger is clicked', () => {
    render(<ExportModal onExport={vi.fn()} />)
    const trigger = screen.getByTitle('Xuất tài liệu')
    fireEvent.click(trigger)

    expect(screen.getByRole('heading', { name: 'Xuất tài liệu' })).toBeDefined()
    expect(screen.getByText('HTML Độc lập (.html)')).toBeDefined()
    expect(screen.getByText('Microsoft Word (.docx)')).toBeDefined()
    expect(screen.getByText('Tài liệu PDF (.pdf)')).toBeDefined()
    expect(screen.getByText('Slide PDF (Khổ ngang)')).toBeDefined()
  })

  it('calls onExport and closes modal with "html", "docx", "pdf", "slide-pdf" when respective options are clicked', () => {
    const handleExport = vi.fn()
    render(<ExportModal onExport={handleExport} />)

    fireEvent.click(screen.getByTitle('Xuất tài liệu'))
    fireEvent.click(screen.getByText('HTML Độc lập (.html)'))
    expect(handleExport).toHaveBeenCalledWith('html')
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByTitle('Xuất tài liệu'))
    fireEvent.click(screen.getByText('Microsoft Word (.docx)'))
    expect(handleExport).toHaveBeenCalledWith('docx')
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByTitle('Xuất tài liệu'))
    fireEvent.click(screen.getByText('Tài liệu PDF (.pdf)'))
    expect(handleExport).toHaveBeenCalledWith('pdf')
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByTitle('Xuất tài liệu'))
    fireEvent.click(screen.getByText('Slide PDF (Khổ ngang)'))
    expect(handleExport).toHaveBeenCalledWith('slide-pdf')
    expect(screen.queryByRole('dialog')).toBeNull()
  })


  it('closes modal when close button (✕) is clicked', () => {
    render(<ExportModal onExport={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Xuất tài liệu'))
    expect(screen.getByRole('heading', { name: 'Xuất tài liệu' })).toBeDefined()

    const closeButton = screen.getByRole('button', { name: '✕' })
    fireEvent.click(closeButton)
    expect(screen.queryByRole('heading', { name: 'Xuất tài liệu' })).toBeNull()
  })

  it('closes modal when backdrop is clicked', () => {
    render(<ExportModal onExport={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Xuất tài liệu'))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(screen.queryByRole('heading', { name: 'Xuất tài liệu' })).toBeNull()
  })

  it('disables buttons when isExporting is true', () => {
    const handleExport = vi.fn()
    render(<ExportModal onExport={handleExport} isExporting={true} />)
    fireEvent.click(screen.getByTitle('Xuất tài liệu'))

    const htmlOption = screen.getByText('HTML Độc lập (.html)').closest('button')
    expect(htmlOption).toBeDefined()
    expect(htmlOption?.disabled).toBe(true)

    fireEvent.click(htmlOption!)
    expect(handleExport).not.toHaveBeenCalled()
  })

  it('renders modal dialog with solid background and theme attributes', () => {
    render(<ExportModal onExport={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Xuất tài liệu'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('data-theme')).toBeTruthy()
    const dialogCard = dialog.firstChild as HTMLElement
    expect(dialogCard.style.background).toContain('var(--md-bg')
  })
})
