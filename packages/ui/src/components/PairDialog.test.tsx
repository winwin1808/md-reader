import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PairDialog } from './PairDialog'
import { SettingsModal } from './SettingsModal'

afterEach(cleanup)

describe('PairDialog', () => {
  it('shows the client name and wires Allow/Deny', () => {
    const onAllow = vi.fn()
    const onDeny = vi.fn()
    render(<PairDialog client="Claude" fingerprint="ABCD-1234" onAllow={onAllow} onDeny={onDeny} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText(/Claude/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép' }))
    expect(onAllow).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }))
    expect(onDeny).toHaveBeenCalledTimes(1)
  })

  it('shows the server fingerprint', () => {
    render(<PairDialog client="Claude" fingerprint="ABCD-1234" onAllow={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText(/ABCD-1234/)).toBeInTheDocument()
  })

  it('Esc denies and initial focus is on Deny', () => {
    const onDeny = vi.fn()
    render(<PairDialog client="Cursor" fingerprint="ABCD-1234" onAllow={vi.fn()} onDeny={onDeny} />)
    expect(screen.getByRole('button', { name: 'Từ chối' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDeny).toHaveBeenCalled()
  })
})

describe('PairDialog busy/result', () => {
  const base = { client: 'Claude', fingerprint: 'ABCD-1234' }
  it('busy disables both buttons and shows pair.busy', () => {
    const onAllow = vi.fn()
    const onDeny = vi.fn()
    render(<PairDialog {...base} busy onAllow={onAllow} onDeny={onDeny} />)
    const allow = screen.getByRole('button', { name: 'Đang kết nối…' })
    const deny = screen.getByRole('button', { name: 'Từ chối' })
    expect(allow).toBeDisabled()
    expect(deny).toBeDisabled()
    fireEvent.click(allow)
    fireEvent.click(deny)
    expect(onAllow).not.toHaveBeenCalled()
    expect(onDeny).not.toHaveBeenCalled()
  })

  it('Esc while busy does nothing', () => {
    const onDeny = vi.fn()
    const onClose = vi.fn()
    render(<PairDialog {...base} busy onAllow={vi.fn()} onDeny={onDeny} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDeny).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it.each([
    ['rejected-other', /npx le-sach-mcp unpair/],
    ['rejected', /từ chối kết nối/],
    ['gone', /Không còn thấy/],
  ] as const)('result %s shows message and a single Close button', (result, re) => {
    const onClose = vi.fn()
    const onAllow = vi.fn()
    const onDeny = vi.fn()
    render(<PairDialog {...base} result={result} onAllow={onAllow} onDeny={onDeny} onClose={onClose} />)
    expect(screen.getByText(re)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cho phép' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull()
    const close = screen.getByRole('button', { name: 'Đóng' })
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(close).toHaveFocus()
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc with result calls onClose, not onDeny', () => {
    const onDeny = vi.fn()
    const onClose = vi.fn()
    render(<PairDialog {...base} result="gone" onAllow={vi.fn()} onDeny={onDeny} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDeny).not.toHaveBeenCalled()
  })
})

describe('SettingsModal AI section', () => {
  it('toggles and revokes', () => {
    const onToggle = vi.fn()
    const onRevoke = vi.fn()
    render(
      <SettingsModal
        open
        aiBridge={{ enabled: false, clients: [{ keyHash: 'abcd1234ef', client: 'Claude', at: 1700000000000 }], onToggle, onRevoke }}
      />,
    )
    fireEvent.click(screen.getByLabelText('Cho phép ứng dụng AI kết nối'))
    expect(onToggle).toHaveBeenCalledWith(true)
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText(/ABCD-1234/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
    expect(onRevoke).toHaveBeenCalledWith('abcd1234ef')
  })

  it('has no ai section without the prop', () => {
    const { container } = render(<SettingsModal open />)
    expect(container.ownerDocument.querySelector('[data-section="ai"]')).toBeNull()
  })
})
