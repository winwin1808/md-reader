import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { SHARE_EXPIRY_PRESETS } from '@md-reader/core'
import type { ShareLink } from '@md-reader/core'
import { ShareModal } from './ShareModal'

const link = (over: Partial<ShareLink> = {}): ShareLink => ({
  token: '', tokenPrefix: 'abc123', roomId: 'r1', role: 'view', label: '',
  createdAt: 1, expiresAt: null, revokedAt: null, ...over,
})
const binding = { serverUrl: 'https://s', roomId: 'r1', ownerToken: 'o' }

function setup(over: Partial<React.ComponentProps<typeof ShareModal>> = {}) {
  const props = {
    open: true, onClose: vi.fn(), binding, links: [] as ShareLink[],
    onEnable: vi.fn().mockResolvedValue(undefined),
    onCreateLink: vi.fn().mockResolvedValue(link()),
    onRevoke: vi.fn().mockResolvedValue(undefined),
    buildUrl: (t: string) => `https://app/s/${t}`,
    ...over,
  }
  render(<ShareModal {...props} />)
  return props
}

describe('ShareModal', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('renders nothing when closed', () => {
    const { container } = render(<ShareModal open={false} onClose={() => {}} binding={null} links={[]}
      onEnable={async () => {}} onCreateLink={async () => link()} onRevoke={async () => {}} buildUrl={(t) => t} />)
    expect(container.firstChild).toBeNull()
  })

  it('unshared: shows text and Bật chia sẻ calls onEnable', () => {
    const p = setup({ binding: null })
    expect(screen.getByText('Tài liệu sẽ được tải lên máy chủ đồng bộ. Chỉ người có link mới xem được.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bật chia sẻ' }))
    expect(p.onEnable).toHaveBeenCalled()
  })

  it('dialog is labelled by the title', () => {
    setup()
    const dlg = screen.getByRole('dialog')
    expect(dlg.getAttribute('aria-modal')).toBe('true')
    const id = dlg.getAttribute('aria-labelledby')!
    expect(document.getElementById(id)!.textContent).toBe('Chia sẻ')
  })

  it('Tạo link xem calls onCreateLink with view + 30d', () => {
    const p = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo link xem' }))
    expect(p.onCreateLink).toHaveBeenCalledWith({ role: 'view', expiresIn: SHARE_EXPIRY_PRESETS['30d'] })
    expect(screen.getByText('Chưa có link nào.')).toBeTruthy()
  })

  it('copy writes url and shows Đã sao chép', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    setup({ links: [link({ token: 'TOK' })] })
    expect((screen.getByDisplayValue('https://app/s/TOK') as HTMLInputElement).readOnly).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đã sao chép' })).toBeTruthy())
    expect(writeText).toHaveBeenCalledWith('https://app/s/TOK')
  })

  it('clipboard rejection shows message', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('x')) } })
    setup({ links: [link({ token: 'TOK' })] })
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }))
    await waitFor(() => expect(screen.getByText('Không sao chép được')).toBeTruthy())
  })

  it('row with empty token shows note, no copy button', () => {
    setup({ links: [link()] })
    expect(screen.getByText('Chỉ sao chép được ngay khi tạo')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sao chép' })).toBeNull()
    expect(screen.getByText(/abc123…/)).toBeTruthy()
    expect(screen.getByText('Không hết hạn')).toBeTruthy()
  })

  it('hides revoked links; Thu hồi calls onRevoke with prefix', () => {
    const p = setup({ links: [link({ tokenPrefix: 'gone', revokedAt: 5 }), link({ tokenPrefix: 'live' })] })
    expect(screen.queryByText(/gone…/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
    expect(p.onRevoke).toHaveBeenCalledWith('live')
  })

  it('busy disables action buttons', () => {
    setup({ busy: true, links: [link({ token: 'T' })] })
    for (const n of ['Tạo link xem', 'Sao chép', 'Thu hồi']) {
      expect((screen.getByRole('button', { name: n }) as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('error renders alert', () => {
    setup({ error: 'Lỗi mạng' })
    expect(screen.getByRole('alert').textContent).toContain('Lỗi mạng')
  })

  it('Esc and close button call onClose', () => {
    const p = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(p.onClose).toHaveBeenCalledTimes(2)
  })
})
