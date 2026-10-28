import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const h = vi.hoisted(() => ({
  calls: [] as string[],
  override: { syncStatus: null as any, newerFormat: false, bound: false },
  deleteRemote: vi.fn(),
  suspend: vi.fn(),
  compact: vi.fn(),
  loadMath: vi.fn(),
}))

vi.mock('../app/hooks/useDocSession', async (orig) => {
  const actual: any = await orig()
  return { ...actual, useDocSession: (...a: any[]) => {
    const r = actual.useDocSession(...a)
    return {
      ...r,
      ...(h.override.syncStatus ? { syncStatus: h.override.syncStatus } : {}),
      newerFormat: h.override.newerFormat || r.newerFormat,
      suspendPersistence: h.suspend,
    }
  } }
})
vi.mock('../app/collab/useShare', () => {
  const links: any[] = []
  const binding = { roomId: 'r1', serverUrl: 'https://s.example', ownerToken: 'tok' }
  const fn = () => async (..._a: any[]): Promise<any> => undefined
  const stable = {
    binding, links, enable: fn(), createLink: fn(), revoke: fn(), recreate: fn(), revokeAll: fn(), refresh: fn(),
    deleteRemote: (...a: any[]) => h.deleteRemote(...a), busy: false, error: null,
    currentLinks: () => links, currentBinding: () => binding,
  }
  return { useShare: () => stable }
})
vi.mock('../app/doc-registry', async (orig) => {
  const actual: any = await orig()
  return { ...actual, compactStoredDoc: (...a: any[]) => h.compact(...a) }
})
vi.mock('@md-reader/core/plugins', async (orig) => {
  const actual: any = await orig()
  return { ...actual, loadMathPlugin: (...a: any[]) => h.loadMath(...a) }
})

import { App } from '../app/App'
import { createRecord, writeDocText } from '../app/doc-registry'
import * as core from '@md-reader/core'

async function openDoc(text: string): Promise<string> {
  const rec = await createRecord({ title: 'doc', originKind: 'drop', originPath: null })
  await writeDocText(rec, text, 'replace')
  window.history.replaceState(null, '', '/?doc=' + rec.docId)
  return rec.docId
}

const reload = vi.fn()
const realLocation = window.location

function stubLocation(): void {
  const u = new URL(window.location.href) as any
  u.reload = reload
  delete (window as any).location
  ;(window as any).location = u
}

describe('App: làm gọn, xuất khi lỗi công thức, banner (16d)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.calls = []
    h.override.syncStatus = null
    h.override.newerFormat = false
    h.deleteRemote.mockImplementation(async () => { h.calls.push('deleteRemote') })
    h.suspend.mockImplementation(async () => { h.calls.push('suspend') })
    h.compact.mockImplementation(async () => { h.calls.push('compact') })
    h.loadMath.mockResolvedValue(undefined)
    reload.mockImplementation(() => { h.calls.push('reload') })
    sessionStorage.clear()
    ;(window as any).chrome = {
      storage: {
        local: { get: vi.fn().mockResolvedValue({ recentFiles: [] }), set: vi.fn().mockResolvedValue(undefined) },
        sync: { get: vi.fn().mockResolvedValue({ theme: 'light', autoFormatMd: true }), set: vi.fn().mockResolvedValue(undefined) },
      },
    }
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    ;(window as any).location = realLocation
    window.history.replaceState(null, '', '/')
    vi.restoreAllMocks()
  })

  let first: { unmount: () => void } | null = null
  async function openCompactConfirm(docId: string): Promise<void> {
    await openDoc('# Hi')
    void docId
    stubLocation()
    h.override.syncStatus = 'full'
    first = render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Hi' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Làm gọn tài liệu' })) })
  }
  const confirm = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Xác nhận làm gọn' })) }) }

  it('toolbar hiện trạng thái full và revoked', async () => {
    await openDoc('# Hi')
    h.override.syncStatus = 'full'
    const { unmount } = render(<App />)
    await waitFor(() => expect(document.querySelector('.tb-status[data-kind^="sync-"]')!.getAttribute('data-kind')).toBe('sync-full'))
    expect(document.querySelector('.tb-status[data-kind^="sync-"]')!.textContent).toContain('vượt giới hạn dung lượng')
    unmount()
    h.override.syncStatus = 'revoked'
    render(<App />)
    await waitFor(() => expect(document.querySelector('.tb-status[data-kind^="sync-"]')!.getAttribute('data-kind')).toBe('sync-revoked'))
    expect(document.querySelector('.tb-status[data-kind^="sync-"]')!.textContent).toContain('link bị thu hồi')
  })

  it('banner formatVersion mới hơn hiện và đóng được', async () => {
    await openDoc('# Hi')
    h.override.newerFormat = true
    render(<App />)
    await screen.findByText(/phiên bản MD Reader mới hơn/)
    fireEvent.click(screen.getByRole('button', { name: 'Đóng', hidden: false }))
    await waitFor(() => expect(screen.queryByText(/phiên bản MD Reader mới hơn/)).toBeNull())
  })

  it('(a) deleteRemote lỗi: không compact, không reload, gỡ overlay, lỗi hiện trong modal', async () => {
    h.deleteRemote.mockImplementation(async () => { throw new Error('mạng hỏng') })
    await openCompactConfirm('')
    await confirm()
    await screen.findByText('mạng hỏng')
    expect(h.compact).not.toHaveBeenCalled()
    expect(h.suspend).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('(b) thành công: khoá nhập trước, đúng thứ tự, đặt cờ compacted, reload', async () => {
    let release!: () => void
    h.deleteRemote.mockImplementation(() => { h.calls.push('deleteRemote'); return new Promise<void>((r) => { release = r }) })
    await openCompactConfirm('')
    await confirm()
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).not.toBeNull())
    expect(h.suspend).not.toHaveBeenCalled()
    await act(async () => { release() })
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(h.calls).toEqual(['deleteRemote', 'suspend', 'compact', 'reload'])
    const id = h.compact.mock.calls[0]![0] as string
    expect(sessionStorage.getItem('mdr-compacted:' + id)).toBe('1')
    expect(sessionStorage.getItem('mdr-compact-failed:' + id)).toBeNull()
  })

  it('(c) compact lỗi: đặt cờ failed, reload, mount lại hiện banner và xoá cờ', async () => {
    h.compact.mockImplementation(async () => { h.calls.push('compact'); throw new Error('idb') })
    await openCompactConfirm('')
    await confirm()
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(h.calls).toEqual(['deleteRemote', 'suspend', 'compact', 'reload'])
    const id = h.compact.mock.calls[0]![0] as string
    expect(sessionStorage.getItem('mdr-compact-failed:' + id)).toBe('1')
    expect(sessionStorage.getItem('mdr-compacted:' + id)).toBeNull()
    first!.unmount()
    h.override.syncStatus = null
    await act(async () => { render(<App />) })
    await screen.findByText(/chưa làm gọn được tài liệu/)
    expect(sessionStorage.getItem('mdr-compact-failed:' + id)).toBeNull()
  })

  it('(d) sau reload có cờ compacted: hiện notice và đóng được', async () => {
    const id = await openDoc('# Hi')
    sessionStorage.setItem('mdr-compacted:' + id, '1')
    await act(async () => { render(<App />) })
    await screen.findByText(/Đã làm gọn tài liệu/)
    expect(sessionStorage.getItem('mdr-compacted:' + id)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Đã hiểu' }))
    await waitFor(() => expect(screen.queryByText(/Đã làm gọn tài liệu/)).toBeNull())
  })

  it('xuất HTML khi loadMathPlugin lỗi: hiện notice và vẫn xuất file', async () => {
    h.loadMath.mockRejectedValue(new Error('chunk'))
    let downloaded = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloaded = this.download })
    const htmlSpy = vi.spyOn(core, 'exportToHtml').mockResolvedValue('<html><body>X</body></html>')
    await openDoc('# Hi\n\nGiá trị $x$ đây.')
    await act(async () => { render(<App />) })
    await screen.findByRole('heading', { level: 1, name: 'Hi' })
    fireEvent.click(screen.getByRole('button', { name: 'Xuất file' }))
    await act(async () => { fireEvent.click(screen.getByText('Trang web (.html)').closest('button')!) })
    await screen.findByText(/Không tải được bộ hiển thị công thức/)
    await waitFor(() => expect(htmlSpy).toHaveBeenCalled())
    expect(h.loadMath).toHaveBeenCalled()
    await waitFor(() => expect(downloaded).toMatch(/\.html$/))
  })
})
