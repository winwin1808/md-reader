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
    expect(screen.getByText(/Chưa có link nào\./)).toBeTruthy()
  })

  it('copy writes url and shows Đã sao chép', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    setup({ links: [link({ token: 'TOK' })] })
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép link' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Đã sao chép'))
    expect(writeText).toHaveBeenCalledWith('https://app/s/TOK')
  })

  it('clipboard rejection shows message', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('x')) } })
    setup({ links: [link({ token: 'TOK' })] })
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép link' }))
    await waitFor(() => expect(screen.getByText('Không sao chép được')).toBeTruthy())
  })

  it('row with empty token shows hint, no copy button', () => {
    setup({ links: [link()] })
    expect(screen.queryByRole('button', { name: 'Sao chép link' })).toBeNull()
    expect(screen.getByText('Link abc123')).toBeTruthy()
    expect(document.querySelector('li')!.textContent).toContain('Không hết hạn')
  })

  it('Thu hồi calls onRevoke with prefix; revoked row has no actions', () => {
    const p = setup({ links: [link({ tokenPrefix: 'gone', revokedAt: 5, token: 'X' }), link({ tokenPrefix: 'live' })] })
    expect(screen.getAllByRole('button', { name: 'Thu hồi link' }).length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi link' }))
    fireEvent.click(screen.getByRole('button', { name: 'Có' }))
    expect(p.onRevoke).toHaveBeenCalledWith('live')
  })

  it('busy disables action buttons', () => {
    setup({ busy: true, links: [link({ token: 'T' })] })
    for (const n of ['Tạo link', 'Sao chép link', 'Thu hồi link']) {
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
      fireEvent.click(screen.getByRole('button', { name: 'Thu hồi link' }))
      fireEvent.click(screen.getByRole('button', { name: 'Có' }))
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
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép link' }))
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Đã sao chép'))
      rerender(<ShareModal {...props} open={false} />)
      rerender(<ShareModal {...props} open={true} />)
      expect(screen.queryByRole('status')?.textContent ?? '').toBe('')
    })

    it('double click on copy calls writeText once', async () => {
      let resolve!: () => void
      const writeText = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r }))
      vi.stubGlobal('navigator', { clipboard: { writeText } })
      setup({ links: [link({ token: 'TOK' })] })
      const b = screen.getByRole('button', { name: 'Sao chép link' })
      fireEvent.click(b)
      fireEvent.click(b)
      expect(writeText).toHaveBeenCalledTimes(1)
      resolve()
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Đã sao chép'))
    })
  })

  describe('8e2 link management', () => {
    const DAY = 86_400_000
    const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

    it('creates an edit link with 7d and trimmed label', async () => {
      const p = setup()
      fireEvent.click(screen.getByRole('radio', { name: 'Sửa' }))
      fireEvent.change(screen.getByRole('combobox', { name: 'Hết hạn' }), { target: { value: '7d' } })
      fireEvent.click(screen.getByRole('button', { name: 'Thêm nhãn' }))
      fireEvent.change(screen.getByLabelText('Nhãn (tuỳ chọn)'), { target: { value: '  Nhóm A ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Tạo link' }))
      expect(p.onCreateLink).toHaveBeenCalledWith({ role: 'edit', expiresIn: SHARE_EXPIRY_PRESETS['7d'], label: 'Nhóm A' })
      await waitFor(() => expect(screen.queryByLabelText('Nhãn (tuỳ chọn)')).toBeNull())
      expect(screen.getByRole('button', { name: 'Thêm nhãn' })).toBeTruthy()
    })

    it('keeps the typed label when onCreateLink rejects', async () => {
      setup({ onCreateLink: vi.fn().mockRejectedValue(new Error('x')) })
      fireEvent.click(screen.getByRole('button', { name: 'Thêm nhãn' }))
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

    it('row shows remaining days, role pill and fallback label', () => {
      setup({ now: () => 1000, links: [link({ role: 'edit', expiresAt: 1000 + 12 * DAY })] })
      const li = document.querySelector('li')!
      expect(li.textContent).toContain('còn 12 ngày')
      expect(li.textContent).toContain('Sửa')
      expect(li.textContent).toContain('Link abc123')
    })

    it('revoke needs inline confirmation and Không cancels', () => {
      const p = setup({ links: [link()] })
      fireEvent.click(screen.getByRole('button', { name: 'Thu hồi link' }))
      expect(p.onRevoke).not.toHaveBeenCalled()
      expect(screen.getByText('Thu hồi?')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Không' }))
      expect(screen.queryByText('Thu hồi?')).toBeNull()
      expect(p.onRevoke).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Thu hồi link' }))
      fireEvent.click(screen.getByRole('button', { name: 'Có' }))
      expect(p.onRevoke).toHaveBeenCalledWith('abc123')
    })

    it('only one row confirms at a time', () => {
      setup({ links: [link({ tokenPrefix: 'a' }), link({ tokenPrefix: 'b' })] })
      const [b1, b2] = screen.getAllByRole('button', { name: 'Thu hồi link' }) as [HTMLElement, HTMLElement]
      fireEvent.click(b1)
      fireEvent.click(b2)
      expect(screen.getAllByText('Thu hồi?').length).toBe(1)
    })

    it('Tắt chia sẻ with confirmation calls onRevokeAll once', async () => {
      const onRevokeAll = vi.fn().mockResolvedValue(undefined)
      setup({ onRevokeAll, links: [link()] })
      fireEvent.click(screen.getByRole('button', { name: 'Tắt chia sẻ' }))
      expect(onRevokeAll).not.toHaveBeenCalled()
      expect(screen.getByText('Thu hồi tất cả link?')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Có' }))
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

    it('expired link is folded under the disclosure, no actions', () => {
      setup({ now: () => 1000, links: [link({ expiresAt: 500, token: 'T' })] })
      expect(document.querySelector('li')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /Link đã tắt \(1\)/ }))
      const li = document.querySelector('li')!
      expect(li.textContent).toContain('Hết hạn')
      expect(screen.queryByRole('button', { name: 'Thu hồi link' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Sao chép link' })).toBeNull()
    })
  })

  it('confirmAll resets when links go to zero', () => {
    const props = {
      open: true, onClose: vi.fn(), binding, links: [link()],
      onEnable: vi.fn(), onCreateLink: vi.fn(), onRevoke: vi.fn(), onRevokeAll: vi.fn().mockResolvedValue(undefined),
      buildUrl: (t: string) => t,
    }
    const { rerender } = render(<ShareModal {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tắt chia sẻ' }))
    expect(screen.getByText(/Thu hồi tất cả link/)).toBeTruthy()
    rerender(<ShareModal {...props} links={[]} />)
    rerender(<ShareModal {...props} links={[link({ tokenPrefix: 'new999' })]} />)
    expect(screen.queryByText(/Thu hồi tất cả link/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Tắt chia sẻ' })).toBeTruthy()
  })

  it('confirming row removed then re-added is no longer confirming', () => {
    const props = {
      open: true, onClose: vi.fn(), binding, links: [link()],
      onEnable: vi.fn(), onCreateLink: vi.fn(), onRevoke: vi.fn(),
      buildUrl: (t: string) => t,
    }
    const { rerender } = render(<ShareModal {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi link' }))
    expect(screen.getByText('Thu hồi?')).toBeTruthy()
    rerender(<ShareModal {...props} links={[]} />)
    rerender(<ShareModal {...props} links={[link()]} />)
    expect(screen.queryByText('Thu hồi?')).toBeNull()
  })

  describe('9i.1 redesigned list', () => {
    it('newest first; label input hidden until Thêm nhãn', () => {
      setup({ links: [link({ tokenPrefix: 'old', createdAt: 1 }), link({ tokenPrefix: 'new', createdAt: 9 })] })
      const names = Array.from(document.querySelectorAll('li .share-row-name')).map((e) => e.textContent)
      expect(names).toEqual(['Link new', 'Link old'])
      expect(screen.queryByLabelText('Nhãn (tuỳ chọn)')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Thêm nhãn' }))
      expect(screen.getByLabelText('Nhãn (tuỳ chọn)')).toBeTruthy()
    })

    it('segment is a radiogroup with arrow keys', () => {
      setup()
      const g = screen.getByRole('radiogroup')
      fireEvent.keyDown(g, { key: 'ArrowRight' })
      expect(screen.getByRole('radio', { name: 'Sửa' }).getAttribute('aria-checked')).toBe('true')
    })

    it('active row without token: Tạo lại link calls onRecreate', () => {
      const onRecreate = vi.fn().mockResolvedValue(undefined)
      const l = link()
      setup({ links: [l], onRecreate })
      fireEvent.click(screen.getByRole('button', { name: 'Tạo lại link' }))
      expect(onRecreate).toHaveBeenCalledWith(l)
    })

    it('revoked hidden until disclosure opened; then dimmed without buttons', () => {
      setup({ links: [link({ revokedAt: 5, token: 'T' })] })
      expect(document.querySelector('li')).toBeNull()
      expect(screen.getByText(/Chưa có link nào\./)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /Link đã tắt \(1\)/ }))
      expect(document.querySelector('li')!.textContent).toContain('Đã thu hồi')
      for (const n of ['Sao chép link', 'Tạo lại link', 'Thu hồi link']) expect(screen.queryByRole('button', { name: n })).toBeNull()
    })

    it('footer shows active count; just-created link shows with copy', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })
      setup({ links: [link({ token: 'A' })], onCreateLink: vi.fn().mockResolvedValue(link({ token: 'NEW' })) })
      expect(screen.getByText('Đang chia sẻ · 1 link hoạt động')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Tạo link' }))
      await waitFor(() => expect(screen.getByLabelText('Link vừa tạo')).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }))
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://app/s/NEW'))
    })
  })
})

describe('ShareModal setup panel', () => {
  afterEach(() => { cleanup() })
  it('missing: shows setup panel, no Tạo link, save calls onSaveServer', () => {
    const onSaveServer = vi.fn()
    setup({ server: { state: 'missing' }, onSaveServer, guideUrl: 'https://g' })
    expect(screen.getByText('Cần máy chủ đồng bộ')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tạo link' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Địa chỉ máy chủ'), { target: { value: 'https://example.workers.dev' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và thử lại' }))
    expect(onSaveServer).toHaveBeenCalledWith('https://example.workers.dev')
  })
  it('unreachable text', () => {
    setup({ server: { state: 'unreachable', url: 'https://a' } })
    expect(screen.getByText('Không kết nối được máy chủ này.')).toBeTruthy()
  })
  it('no server prop shows normal dialog', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Tạo link' })).toBeTruthy()
  })
})
