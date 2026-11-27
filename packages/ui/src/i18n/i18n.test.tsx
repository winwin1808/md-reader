import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { resolveLocale, format, createT, catalogs, I18nProvider, useT, localeTag, isLocale, loadLocale, isLocaleLoaded } from './index'

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
    expect(resolveLocale('auto', ['ja'])).toBe('en')
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
    const ph = (s: string) => [...new Set(s.match(/\{\w+/g) ?? [])].sort().join()
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

describe('placeholder parity', () => {
  const names = (s: string) =>
    [...new Set([...s.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map((m) => m[1]))].sort().join(',')
  it('every en string has the same placeholders as vi', async () => {
    const { vi } = await import('./vi')
    const { en } = await import('./en')
    const bad = Object.keys(vi).filter(
      (k) => names((vi as Record<string, string>)[k] ?? "") !== names((en as Record<string, string>)[k] ?? ''),
    )
    expect(bad).toEqual([])
  })
})

describe('resolveLocale 5 locales', () => {
  it('walks navigator.languages', () => {
    expect(resolveLocale('fr', [])).toBe('fr')
    expect(resolveLocale('auto', ['fr-CA', 'vi'])).toBe('fr')
    expect(resolveLocale(undefined, ['es', 'de-AT'])).toBe('de')
    expect(resolveLocale('auto', ['ja'])).toBe('en')
    expect(resolveLocale('auto', [])).toBe('en')
    expect(resolveLocale('xx' as any, ['it-IT'])).toBe('it')
    expect(resolveLocale('auto', ['vi-VN'])).toBe('vi')
  })
  it('localeTag / isLocale', () => {
    expect(localeTag('de')).toBe('de-DE')
    expect(isLocale('fr')).toBe(true)
    expect(isLocale('es')).toBe(false)
  })
})

describe('lazy locales', () => {
  it('falls back to en, uses loaded catalog, loadLocale', async () => {
    const key = 'common.close' as const
    const other = Object.keys(en).find((k) => k !== key) as any
    expect(createT('it')(key)).toBe(en[key])
    const t = createT('it')
    const prevIt = catalogs.it
    catalogs.it = { [key]: 'X' }
    try {
      expect(t(key)).toBe('X')
      expect(t(other)).toBe(en[other])
    } finally {
      if (prevIt === undefined) delete catalogs.it
      else catalogs.it = prevIt
    }
    await loadLocale('it')
    expect(isLocaleLoaded('it')).toBe(true)
    await loadLocale('vi')
    expect(isLocaleLoaded('vi')).toBe(true)
  })
})
