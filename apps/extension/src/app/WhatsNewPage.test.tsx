import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { I18nProvider } from '@md-reader/ui'
import { WhatsNewPage } from './WhatsNewPage'
import { RELEASE_NOTES, noteText, type ReleaseNote } from '../shared/release-notes'
import type { Locale } from '@md-reader/ui'
import { RELEASE_NOTES_URL } from './feedback-client'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

afterEach(cleanup)

const mk = (version: string): ReleaseNote => ({
  version,
  showOnUpdate: true,
  title: { vi: `Tiêu đề ${version}`, en: `Title ${version}` },
  items: { vi: [`Mục vi ${version}`], en: [`Item en ${version}`] },
})
const notes = [mk('1.3.0'), mk('1.5.0'), mk('1.4.0')]

function setup(highlight: string | null, locale: Locale = 'vi', list = notes) {
  const onDone = vi.fn()
  const r = render(
    <I18nProvider locale={locale}>
      <WhatsNewPage notes={list} locale={locale} highlight={highlight} onDone={onDone} />
    </I18nProvider>,
  )
  return { onDone, ...r }
}
const order = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('section[data-version]')).map((s) => s.getAttribute('data-version'))

describe('WhatsNewPage', () => {
  it('shows vi content', () => {
    setup(null, 'vi')
    expect(screen.getByText('Tiêu đề 1.5.0')).toBeTruthy()
    expect(screen.getByText('Mục vi 1.5.0')).toBeTruthy()
  })
  it('shows en content', () => {
    setup(null, 'en')
    expect(screen.getByText('Title 1.5.0')).toBeTruthy()
    expect(screen.getByText('Item en 1.5.0')).toBeTruthy()
  })
  it('highlight goes first with marker and text', () => {
    const { container } = setup('1.4.0')
    expect(order(container)).toEqual(['1.4.0', '1.5.0', '1.3.0'])
    const first = container.querySelector('section[data-version]')!
    expect(first.getAttribute('data-highlight')).toBe('true')
    expect(first.textContent).toContain('Mới')
  })
  it('null highlight sorts descending, none highlighted', () => {
    const { container } = setup(null)
    expect(order(container)).toEqual(['1.5.0', '1.4.0', '1.3.0'])
    expect(container.querySelector('[data-highlight="true"]')).toBeNull()
  })
  it('empty shows empty text', () => {
    setup(null, 'vi', [])
    expect(screen.getByText('Chưa có ghi chú phát hành.')).toBeTruthy()
  })
  it('enter button calls onDone', () => {
    const { onDone } = setup(null)
    fireEvent.click(screen.getByRole('button', { name: 'Vào MD Reader' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
  it('full-notes link points at newest version hash', () => {
    setup('1.3.0')
    const a = screen.getByRole('link', { name: 'Xem toàn bộ ghi chú phát hành' })
    expect(a.getAttribute('href')).toBe(`${RELEASE_NOTES_URL}#v1.5.0`)
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })
  it('full-notes link has no hash without notes', () => {
    setup(null, 'en', [])
    const a = screen.getByRole('link', { name: 'See all release notes' })
    expect(a.getAttribute('href')).toBe(RELEASE_NOTES_URL)
  })
})

describe('WhatsNewPage 5 locales', () => {
  it('it without translation falls back to en', () => {
    setup(null, 'it')
    expect(screen.getByText('Title 1.5.0')).toBeTruthy()
    expect(screen.getByText('Item en 1.5.0')).toBeTruthy()
  })
  it('it with translation shows it', () => {
    const n: ReleaseNote = { ...mk('2.0.0'), title: { vi: 'v', en: 'Title en', it: 'Titolo it' }, items: { vi: ['v'], en: ['e'], it: ['Voce it'] } }
    setup(null, 'it', [n])
    expect(screen.getByText('Titolo it')).toBeTruthy()
    expect(screen.getByText('Voce it')).toBeTruthy()
  })
  it('noteText falls back to en', () => {
    expect(noteText({ vi: 'a', en: 'b' }, 'de')).toBe('b')
    expect(noteText({ vi: 'a', en: 'b', de: 'c' }, 'de')).toBe('c')
  })
})

describe('site/changelog.html sync', () => {
  it('has a section for every release note version', () => {
    // vitest chạy với cwd = apps/extension (pnpm --filter) hoặc gốc repo
    const file = [resolve(process.cwd(), '../../site/changelog.html'), resolve(process.cwd(), 'site/changelog.html')].find(existsSync)!
    const html = readFileSync(file, 'utf8')
    const missing = RELEASE_NOTES.map((n) => n.version).filter((v) => !html.includes(`id="v${v}"`))
    expect(missing, `site/changelog.html thiếu phiên bản: ${missing.join(', ')} — hãy cập nhật site/changelog.html`).toEqual([])
  })
})
