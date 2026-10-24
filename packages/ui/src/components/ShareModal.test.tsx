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
  describe('review fixes', () => {
    const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) }
    const guard = () => { const spy = vi.fn(); process.on('unhandledRejection', spy); return spy }

    it('onEnable rejection shows message, no unhandled rejection', async () => {
      const spy = guard()
      setup({ binding: null, onEnable: vi.fn().mockRejectedValue(new Error('x')) })
      fireEvent.click(screen.getByRole('button', { name: 'Bật chia sẻ' }))
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('x'))
      await flush()
      process.off('unhandledRejection', spy)
      expect(spy).not.toHaveBeenCalled()
    })

    it('onCreateLink rejection shows alert', async () => {
      const spy = guard()
      setup({ onCreateLink: vi.fn().mockRejectedValue(new Error('c')) })
      fireEvent.click(screen.getByRole('button', { name: 'Tạo link xem' }))
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('c'))
      await flush()
      process.off('unhandledRejection', spy)
      expect(spy).not.toHaveBeenCalled()
    })

    it('onRevoke rejection shows alert; non-Error falls back', async () => {
      const spy = guard()
      setup({ links: [link()], onRevoke: vi.fn().mockRejectedValue('boom') })
      fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Không thực hiện được'))
      await flush()
      process.off('unhandledRejection', spy)
      expect(spy).not.toHaveBeenCalled()
    })

    it('error prop wins over local error', async () => {
      setup({ binding: null, error: 'P', onEnable: vi.fn().mockRejectedValue(new Error('x')) })
      fireEvent.click(screen.getByRole('button', { name: 'Bật chia sẻ' }))
      await flush()
      expect(screen.getByRole('alert').textContent).toBe('P')
    })

    it('reopening resets copied state', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
      const props = {
        open: true, onClose: vi.fn(), binding, links: [link({ token: 'TOK' })],
        onEnable: async () => {}, onCreateLink: async () => link(), onRevoke: async () => {},
        buildUrl: (t: string) => `https://app/s/${t}`,
      }
      const { rerender } = render(<ShareModal {...props} />)
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Đã sao chép' })).toBeTruthy())
      rerender(<ShareModal {...props} open={false} />)
      rerender(<ShareModal {...props} open={true} />)
      expect(screen.getByRole('button', { name: 'Sao chép' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Đã sao chép' })).toBeNull()
    })

    it('double click on copy calls writeText once', async () => {
      let resolve!: () => void
      const writeText = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r }))
      vi.stubGlobal('navigator', { clipboard: { writeText } })
      setup({ links: [link({ token: 'TOK' })] })
      const b = screen.getByRole('button', { name: 'Sao chép' })
      fireEvent.click(b)
      fireEvent.click(b)
      expect(writeText).toHaveBeenCalledTimes(1)
      resolve()
      await waitFor(() => expect(screen.getByRole('button', { name: 'Đã sao chép' })).toBeTruthy())
    })
  })
})
