import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { I18nProvider } from '@md-reader/ui'
import { WelcomePage, type WelcomeStatus } from './WelcomePage'

afterEach(cleanup)

const base: WelcomeStatus = { pinned: true, fileAccess: true, openedFile: true, aiConnected: true }

function setup(status: Partial<WelcomeStatus> = {}, locale: 'vi' | 'en' = 'vi') {
  const h = { onOpenSample: vi.fn(), onOpenFileSettings: vi.fn(), onDone: vi.fn() }
  const r = render(
    <I18nProvider locale={locale}>
      <WelcomePage status={{ ...base, ...status }} {...h} />
    </I18nProvider>,
  )
  return { ...h, ...r }
}

describe('WelcomePage', () => {
  it('has one primary sample button that calls onOpenSample', () => {
    const { onOpenSample } = setup()
    const btns = screen.getAllByRole('button', { name: 'Mở tài liệu mẫu' })
    expect(btns).toHaveLength(1)
    fireEvent.click(btns[0]!)
    expect(onOpenSample).toHaveBeenCalledTimes(1)
  })
  it('hides pin step when pinned is null, shows Chưa xong when false', () => {
    setup({ pinned: null })
    expect(screen.queryByText('Ghim MD Reader lên thanh công cụ')).toBeNull()
    cleanup()
    setup({ pinned: false })
    const li = screen.getByText('Ghim MD Reader lên thanh công cụ').closest('li')!
    expect(li.getAttribute('data-done')).toBe('false')
    expect(li.textContent).toContain('Chưa xong')
  })
  it('file access button only when not allowed', () => {
    const a = setup({ fileAccess: false })
    fireEvent.click(screen.getByRole('button', { name: 'Mở cài đặt extension' }))
    expect(a.onOpenFileSettings).toHaveBeenCalledTimes(1)
    cleanup()
    setup({ fileAccess: true })
    expect(screen.queryByRole('button', { name: 'Mở cài đặt extension' })).toBeNull()
  })
  it('data-done matches each field', () => {
    setup({ fileAccess: false, openedFile: true, aiConnected: false })
    const done = (t: string) => screen.getByText(t).closest('li')!.getAttribute('data-done')
    expect(done('Ghim MD Reader lên thanh công cụ')).toBe('true')
    expect(done('Cho phép đọc file trên máy')).toBe('false')
    expect(done('Mở một file .md')).toBe('true')
    expect(done('Kết nối AI (tuỳ chọn)')).toBe('false')
  })
  it('AI step is marked optional', () => {
    setup()
    expect(screen.getByText(/tuỳ chọn/)).toBeTruthy()
  })
  it('Done button calls onDone', () => {
    const { onDone } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Vào MD Reader' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
  it('renders English', () => {
    setup({}, 'en')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Markdown that reads like a book.')
  })
  it('renders new title, hint and aria-hidden figure', () => {
    const { container } = setup()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Markdown, đọc như một cuốn sách.')
    expect(screen.getByText('Tài liệu mẫu mở kèm hướng dẫn từng bước, chừng một phút.')).toBeTruthy()
    expect(container.querySelector('figure')!.getAttribute('aria-hidden')).toBe('true')
  })
  it('shows progress 2 of 4 with progressbar', () => {
    setup({ pinned: true, fileAccess: true, openedFile: false, aiConnected: false })
    expect(screen.getByText('2 trên 4 đã xong')).toBeTruthy()
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('2')
    expect(bar.getAttribute('aria-valuemax')).toBe('4')
  })
  it('pinned null gives total 3', () => {
    setup({ pinned: null })
    expect(screen.getByText(/trên 3 /)).toBeTruthy()
  })
  it('done step shows check, todo shows its ordinal', () => {
    setup({ pinned: true, fileAccess: false, openedFile: true, aiConnected: false })
    const mark = (t: string) => screen.getByText(t).closest('li')!.querySelector('.welcome-step-mark')!.textContent
    expect(mark('Ghim MD Reader lên thanh công cụ')).toBe('✓')
    expect(mark('Cho phép đọc file trên máy')).toBe('2')
    expect(mark('Kết nối AI (tuỳ chọn)')).toBe('4')
  })
})
