import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ContentApp } from './ContentApp'
import React from 'react'

const FAIL = 'Không mở được MD Reader. Thử bấm biểu tượng MD Reader trên thanh công cụ.'

afterEach(cleanup)

let removeMock: any

function setupChrome(sendMessage: any, get?: any) {
  const setMock = vi.fn().mockResolvedValue(undefined)
  removeMock = vi.fn().mockResolvedValue(undefined)
  globalThis.chrome = {
    runtime: { getURL: vi.fn((p) => `chrome-extension://123/${p}`), sendMessage },
    storage: { local: { set: setMock, remove: removeMock, get: get ?? vi.fn().mockResolvedValue({}) } },
  } as any
  return setMock
}

describe('ContentApp', () => {
  it('click open caches { text, ts } once and messages the worker', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const send = vi.fn((_m: any, cb: any) => cb?.({ success: true }))
    const setMock = setupChrome(send)

    render(<ContentApp markdown="# Test" />)
    fireEvent.click(await screen.findByRole('button', { name: /Đọc trong MD Reader/i }))

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(setMock).toHaveBeenCalledTimes(1)
    const arg = setMock.mock.calls[0]![0]
    expect(arg['file_content_http://localhost:3000/']).toEqual({ text: '# Test', ts: expect.any(Number) })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toMatchObject({ action: 'openApp', fileUrl: 'http://localhost:3000/' })
    expect(openSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(FAIL)).toBeNull()
    openSpy.mockRestore()
  })

  it('shows honest failure text and never calls window.open when worker fails', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    setupChrome(vi.fn((_m: any, cb: any) => cb?.({ success: false })))

    render(<ContentApp markdown="# Test" />)
    fireEvent.click(await screen.findByRole('button', { name: /Đọc trong MD Reader/i }))

    expect(await screen.findByText(FAIL)).toBeTruthy()
    expect(removeMock).toHaveBeenCalledWith('file_content_http://localhost:3000/')
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('renders tab; Ẩn writes collapsed=true and shows strip', async () => {
    const setMock = setupChrome(vi.fn())
    render(<ContentApp markdown="# T" />)
    expect(await screen.findByRole('button', { name: /Đọc trong MD Reader/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn' }))
    expect(setMock).toHaveBeenCalledWith({ 'mdr.widget.collapsed': true })
    expect(screen.queryByRole('button', { name: /Đọc trong MD Reader/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Mở MD Reader/ })).toBeTruthy()
  })

  it('stored true on mount collapses', async () => {
    setupChrome(vi.fn(), vi.fn().mockResolvedValue({ 'mdr.widget.collapsed': true }))
    render(<ContentApp markdown="# T" />)
    expect(await screen.findByRole('button', { name: /Mở MD Reader/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Đọc trong MD Reader/ })).toBeNull()
  })

  it('renders nothing until stored state resolves', async () => {
    let resolve!: (v: any) => void
    setupChrome(vi.fn(), vi.fn(() => new Promise((r) => (resolve = r))))
    const { container } = render(<ContentApp markdown="# T" />)
    expect(container.innerHTML).toBe('')
    resolve({ 'mdr.widget.collapsed': true })
    expect(await screen.findByRole('button', { name: /Mở MD Reader/ })).toBeTruthy()
  })

  it('storage error stays expanded', async () => {
    setupChrome(vi.fn(), vi.fn().mockRejectedValue(new Error('x')))
    render(<ContentApp markdown="# T" />)
    expect(await screen.findByRole('button', { name: /Đọc trong MD Reader/ })).toBeTruthy()
  })
})
