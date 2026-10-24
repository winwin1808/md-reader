import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { SHARE_EXPIRY_PRESETS } from '@md-reader/core'
import type { ShareLink } from '@md-reader/core'
import { ShareModal, formatRemaining } from './ShareModal'

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

  it('Tạo link calls onCreateLink with view + 30d + undefined label', () => {
    const p = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo link' }))
    expect(p.onCreateLink).toHaveBeenCalledWith({ role: 'view', expiresIn: SHARE_EXPIRY_PRESETS['30d'], label: undefined })
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
    expect(document.querySelector('li')!.textContent).toContain('Không hết hạn')
  })

  it('hides revoked links; Thu hồi calls onRevoke with prefix', () => {
    const p = setup({ links: [link({ tokenPrefix: 'gone', revokedAt: 5 }), link({ tokenPrefix: 'live' })] })
    expect(screen.queryByText(/gone…/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
    expect(p.onRevoke).toHaveBeenCalledWith('live')
  })

  it('busy disables action buttons', () => {
    setup({ busy: true, links: [link({ token: 'T' })] })
    for (const n of ['Tạo link', 'Sao chép', 'Thu hồi']) {
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
      fireEvent.click(screen.getByRole('button', { name: 'Tạo link' }))
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('c'))
      await flush()
      process.off('unhandledRejection', spy)
      expect(spy).not.toHaveBeenCalled()
    })

    it('onRevoke rejection shows alert; non-Error falls back', async () => {
      const spy = guard()
      setup({ links: [link()], onRevoke: vi.fn().mockRejectedValue('boom') })
      fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
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

  describe('8e2 link management', () => {
    const DAY = 86_400_000
    const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

    it('creates an edit link with 7d and trimmed label', async () => {
      const p = setup()
      fireEvent.click(screen.getByRole('radio', { name: 'Sửa' }))
      fireEvent.change(screen.getByRole('combobox', { name: 'Hết hạn' }), { target: { value: '7d' } })
      fireEvent.change(screen.getByLabelText('Nhãn (tuỳ chọn)'), { target: { value: '  Nhóm A ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Tạo link' }))
      expect(p.onCreateLink).toHaveBeenCalledWith({ role: 'edit', expiresIn: SHARE_EXPIRY_PRESETS['7d'], label: 'Nhóm A' })
      await waitFor(() => expect((screen.getByLabelText('Nhãn (tuỳ chọn)') as HTMLInputElement).value).toBe(''))
      expect((screen.getByLabelText('Nhãn (tuỳ chọn)') as HTMLInputElement).maxLength).toBe(120)
    })

    it('keeps the typed label when onCreateLink rejects', async () => {
      setup({ onCreateLink: vi.fn().mockRejectedValue(new Error('x')) })
      fireEvent.change(screen.getByLabelText('Nhãn (tuỳ chọn)'), { target: { value: 'Nhóm A' } })
      fireEvent.click(screen.getByRole('button', { name: 'Tạo link' }))
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('x'))
      expect((screen.getByLabelText('Nhãn (tuỳ chọn)') as HTMLInputElement).value).toBe('Nhóm A')
    })

    it('formatRemaining cases', () => {
      expect(formatRemaining(null, 1000)).toBe('Không hết hạn')
      expect(formatRemaining(500, 1000)).toBe('Đã hết hạn')
      expect(formatRemaining(1000 + 2 * 3600_000, 1000)).toBe('còn dưới 1 ngày')
      expect(formatRemaining(1000 + 12 * DAY, 1000)).toBe('còn 12 ngày')
    })

    it('row shows remaining days, role badge and fallback label', () => {
      setup({ now: () => 1000, links: [link({ role: 'edit', expiresAt: 1000 + 12 * DAY })] })
      const li = document.querySelector('li')!
      expect(li.textContent).toContain('còn 12 ngày')
      expect(li.textContent).toContain('Sửa')
      expect(li.textContent).toContain('Link sửa')
    })

    it('revoke needs confirmation and Huỷ cancels', () => {
      const p = setup({ links: [link()] })
      fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
      expect(p.onRevoke).not.toHaveBeenCalled()
      expect(screen.getByText('Thu hồi link này?')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
      expect(screen.queryByText('Thu hồi link này?')).toBeNull()
      expect(p.onRevoke).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
      fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))
      expect(p.onRevoke).toHaveBeenCalledWith('abc123')
    })

    it('only one row confirms at a time', () => {
      setup({ links: [link({ tokenPrefix: 'a' }), link({ tokenPrefix: 'b' })] })
      const [b1, b2] = screen.getAllByRole('button', { name: 'Thu hồi' }) as [HTMLElement, HTMLElement]
      fireEvent.click(b1)
      fireEvent.click(b2)
      expect(screen.getAllByText('Thu hồi link này?').length).toBe(1)
    })

    it('Tắt chia sẻ with confirmation calls onRevokeAll once', async () => {
      const onRevokeAll = vi.fn().mockResolvedValue(undefined)
      setup({ onRevokeAll, links: [link()] })
      fireEvent.click(screen.getByRole('button', { name: 'Tắt chia sẻ' }))
      expect(onRevokeAll).not.toHaveBeenCalled()
      expect(screen.getByText('Thu hồi tất cả link? Phòng vẫn giữ, có thể tạo link mới.')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Tắt chia sẻ' }))
      await flush()
      expect(onRevokeAll).toHaveBeenCalledTimes(1)
    })

    it('Tắt chia sẻ hidden without onRevokeAll or without active links', () => {
      setup({ links: [link()] })
      expect(screen.queryByRole('button', { name: 'Tắt chia sẻ' })).toBeNull()
      cleanup()
      setup({ onRevokeAll: vi.fn(), links: [link({ revokedAt: 3 })] })
      expect(screen.queryByRole('button', { name: 'Tắt chia sẻ' })).toBeNull()
    })

    it('expired link shows Đã hết hạn, is-expired, keeps revoke', () => {
      setup({ now: () => 1000, links: [link({ expiresAt: 500 })] })
      const li = document.querySelector('li')!
      expect(li.textContent).toContain('Đã hết hạn')
      expect(li.classList.contains('is-expired')).toBe(true)
      expect(screen.getByRole('button', { name: 'Thu hồi' })).toBeTruthy()
    })
  })
})
