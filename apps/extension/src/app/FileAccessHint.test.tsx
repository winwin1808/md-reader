import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { FileAccessHint } from './FileAccessHint'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function stub(allowed: boolean) {
  const create = vi.fn()
  vi.stubGlobal('chrome', {
    extension: { isAllowedFileSchemeAccess: (cb: (v: boolean) => void) => cb(allowed) },
    runtime: { id: 'abc123' },
    tabs: { create },
  })
  return create
}

describe('FileAccessHint', () => {
  it('shows hint and opens extension settings when file access is off', async () => {
    const create = stub(false)
    render(<FileAccessHint fileUrl="file:///a.md" />)
    await waitFor(() => expect(screen.getByText(/Cho phép truy cập URL tệp/)).toBeTruthy())
    fireEvent.click(screen.getByText('Mở cài đặt extension'))
    expect(create).toHaveBeenCalledWith({ url: 'chrome://extensions/?id=abc123' })
  })
  it('renders nothing when allowed or not a file URL', async () => {
    stub(true)
    const { container } = render(<FileAccessHint fileUrl="file:///a.md" />)
    await new Promise(r => setTimeout(r, 10))
    expect(container.textContent).toBe('')
    cleanup(); stub(false)
    const r2 = render(<FileAccessHint fileUrl="https://x/a.md" />)
    await new Promise(r => setTimeout(r, 10))
    expect(r2.container.textContent).toBe('')
  })
})
