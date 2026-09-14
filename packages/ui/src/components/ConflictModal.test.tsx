import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConflictModal } from './ConflictModal'

describe('ConflictModal', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    isOpen: true,
    fileName: 'test.md',
    localContent: 'line 1\nlocal line 2\nline 3',
    diskContent: 'line 1\ndisk line 2\nline 3',
    onKeepLocal: vi.fn(),
    onRevertToDisk: vi.fn(),
    onClose: vi.fn(),
  }

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ConflictModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal and warning header when isOpen is true', () => {
    render(<ConflictModal {...defaultProps} />)
    expect(screen.getByText('Phát hiện xung đột tập tin ngoài đĩa')).toBeDefined()
    expect(screen.getByText(/test\.md/)).toBeDefined()
  })

  it('displays local and disk diff content side-by-side', () => {
    render(<ConflictModal {...defaultProps} />)
    expect(screen.getByText(/Bản sửa cục bộ/)).toBeDefined()
    expect(screen.getByText(/Bản trên đĩa/)).toBeDefined()
    expect(screen.getByText('local line 2')).toBeDefined()
    expect(screen.getByText('disk line 2')).toBeDefined()
  })

  it('calls onKeepLocal when clicking "Giữ bản sửa của tôi (Ghi đè)"', () => {
    const onKeepLocal = vi.fn()
    render(<ConflictModal {...defaultProps} onKeepLocal={onKeepLocal} />)
    const keepBtn = screen.getByRole('button', { name: /Giữ bản sửa của tôi/i })
    fireEvent.click(keepBtn)
    expect(onKeepLocal).toHaveBeenCalledTimes(1)
  })

  it('calls onRevertToDisk when clicking "Tải lại từ đĩa (Bỏ thay đổi)"', () => {
    const onRevertToDisk = vi.fn()
    render(<ConflictModal {...defaultProps} onRevertToDisk={onRevertToDisk} />)
    const revertBtn = screen.getByRole('button', { name: /Tải lại từ đĩa/i })
    fireEvent.click(revertBtn)
    expect(onRevertToDisk).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking "Đóng" button', () => {
    const onClose = vi.fn()
    render(<ConflictModal {...defaultProps} onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: /Đóng/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<ConflictModal {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
