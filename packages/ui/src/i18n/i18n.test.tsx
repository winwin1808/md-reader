import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { resolveLocale, format, createT, catalogs, I18nProvider, useT } from './index'

const vi = catalogs.vi as Record<string, string>
const en = catalogs.en as Record<string, string>

describe('resolveLocale', () => {
  it('honours explicit pref', () => {
    expect(resolveLocale('en', ['vi-VN'])).toBe('en')
    expect(resolveLocale('vi', ['en-US'])).toBe('vi')
  })
  it('auto follows the browser language', () => {
    expect(resolveLocale('auto', ['vi-VN', 'en'])).toBe('vi')
    expect(resolveLocale('auto', ['en-US', 'vi'])).toBe('en')
    expect(resolveLocale('auto', ['fr'])).toBe('en')
    expect(resolveLocale('auto', [])).toBe('en')
  })
})

describe('format', () => {
  it('interpolates and picks plurals', () => {
    expect(format('Hi {name}', { name: 'A' })).toBe('Hi A')
    expect(format('{n} {n|file|files}', { n: 1 })).toBe('1 file')
    expect(format('{n} {n|file|files}', { n: 3 })).toBe('3 files')
    expect(format('{x}')).toBe('{x}')
  })
})

describe('catalogs', () => {
  it('en has every vi key, non-empty', () => {
    for (const k of Object.keys(vi)) expect(en[k], k).toBeTruthy()
    expect(Object.keys(en).length).toBe(Object.keys(vi).length)
  })
  it('placeholders match between vi and en', () => {
    const ph = (s: string) => (s.match(/\{\w+/g) ?? []).sort().join()
    for (const k of Object.keys(vi)) expect(ph(en[k] ?? ''), k).toBe(ph(vi[k] ?? ''))
  })
})

describe('I18nProvider', () => {
  const C = () => <span>{useT()('common.close')}</span>
  it('defaults to vi, switches to en', () => {
    const { unmount } = render(<C />)
    expect(screen.getByText('Đóng')).toBeTruthy()
    unmount()
    render(
      <I18nProvider locale="en">
        <C />
      </I18nProvider>,
    )
    expect(screen.getByText('Close')).toBeTruthy()
    expect(createT('en')('common.close')).toBe('Close')
  })
})
