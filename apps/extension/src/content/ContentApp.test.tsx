import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ContentApp } from './ContentApp'
import React from 'react'

const FAIL = 'Không mở được MD Reader. Thử bấm biểu tượng MD Reader trên thanh công cụ.'

function setupChrome(sendMessage: any) {
  const setMock = vi.fn().mockResolvedValue(undefined)
  globalThis.chrome = {
    runtime: { getURL: vi.fn((p) => `chrome-extension://123/${p}`), sendMessage },
    storage: { local: { set: setMock } },
  } as any
  return setMock
}

describe('ContentApp', () => {
  it('click open caches { text, ts } once and messages the worker', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const send = vi.fn((_m: any, cb: any) => cb?.({ success: true }))
    const setMock = setupChrome(send)

    render(<ContentApp markdown="# Test" />)
    fireEvent.click(screen.getByRole('button', { name: /Open in MD Reader/i }))

    expect(setMock).toHaveBeenCalledTimes(1)
    const arg = setMock.mock.calls[0]![0]
    expect(arg['file_content_http://localhost:3000/']).toEqual({ text: '# Test', ts: expect.any(Number) })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toMatchObject({ action: 'openApp', fileUrl: 'http://localhost:3000/' })
    expect(openSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(FAIL)).toBeNull()
    openSpy.mockRestore()
  })

  it('shows honest failure text and never calls window.open when worker fails', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    setupChrome(vi.fn((_m: any, cb: any) => cb?.({ success: false })))

    render(<ContentApp markdown="# Test" />)
    fireEvent.click(screen.getByRole('button', { name: /Open in MD Reader/i }))

    expect(screen.getByText(FAIL)).toBeTruthy()
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })
})
