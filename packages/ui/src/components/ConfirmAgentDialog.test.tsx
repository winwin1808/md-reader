import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ConfirmAgentDialog } from './ConfirmAgentDialog'
import { I18nProvider } from '../i18n'

afterEach(cleanup)

describe('ConfirmAgentDialog', () => {
  it('share view 7 days renders the vi sentence', () => {
    render(
      <ConfirmAgentDialog
        req={{ kind: 'share', docTitle: 'Tài liệu A', role: 'view', expiresInDays: 7 }}
        client="Claude"
        onAllow={vi.fn()}
        onDeny={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByText('«Claude» muốn tạo link Xem hết hạn sau 7 ngày cho «Tài liệu A».'),
    ).toBeInTheDocument()
  })

  it('share edit with null expiry says no expiry', () => {
    render(
      <ConfirmAgentDialog
        req={{ kind: 'share', docTitle: 'B', role: 'edit', expiresInDays: null }}
        client="Claude"
        onAllow={vi.fn()}
        onDeny={vi.fn()}
      />,
    )
    expect(screen.getByText(/Sửa không hết hạn/)).toBeInTheDocument()
  })

  it('revoke renders the token prefix', () => {
    render(
      <ConfirmAgentDialog
        req={{ kind: 'revoke', docTitle: 'C', tokenPrefix: 'abc123' }}
        client="Cursor"
        onAllow={vi.fn()}
        onDeny={vi.fn()}
      />,
    )
    expect(screen.getByText('«Cursor» muốn thu hồi link abc123… của «C».')).toBeInTheDocument()
  })

  it('Allow calls onAllow, Esc calls onDeny, focus starts on Deny', () => {
    const onAllow = vi.fn()
    const onDeny = vi.fn()
    render(
      <ConfirmAgentDialog req={{ kind: 'revoke', docTitle: 'C', tokenPrefix: 'x' }} client="K" onAllow={onAllow} onDeny={onDeny} />,
    )
    expect(screen.getByRole('button', { name: 'Từ chối' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép' }))
    expect(onAllow).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDeny).toHaveBeenCalled()
  })

  it('renders en', () => {
    render(
      <I18nProvider locale="en">
        <ConfirmAgentDialog
          req={{ kind: 'share', docTitle: 'Doc', role: 'edit', expiresInDays: 30 }}
          client="Claude"
          onAllow={vi.fn()}
          onDeny={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(screen.getByText('"Claude" wants to create a link (edit, expiring in 30 days) for "Doc".')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deny' })).toBeInTheDocument()
  })

  it('Tab/Shift+Tab giữ focus trong hộp', () => {
    render(
      <ConfirmAgentDialog req={{ kind: 'revoke', docTitle: 'C', tokenPrefix: 'x' }} client="K" onAllow={vi.fn()} onDeny={vi.fn()} />,
    )
    const deny = screen.getByRole('button', { name: 'Từ chối' })
    const allow = screen.getByRole('button', { name: 'Cho phép' })
    allow.focus()
    fireEvent.keyDown(allow, { key: 'Tab' })
    expect(deny).toHaveFocus()
    fireEvent.keyDown(deny, { key: 'Tab', shiftKey: true })
    expect(allow).toHaveFocus()
  })
})
