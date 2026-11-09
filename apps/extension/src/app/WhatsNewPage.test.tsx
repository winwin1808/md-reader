import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { I18nProvider } from '@md-reader/ui'
import { WhatsNewPage } from './WhatsNewPage'
import type { ReleaseNote } from '../shared/release-notes'

afterEach(cleanup)

const mk = (version: string): ReleaseNote => ({
  version,
  showOnUpdate: true,
  title: { vi: `Tiêu đề ${version}`, en: `Title ${version}` },
  items: { vi: [`Mục vi ${version}`], en: [`Item en ${version}`] },
})
const notes = [mk('1.3.0'), mk('1.5.0'), mk('1.4.0')]

function setup(highlight: string | null, locale: 'vi' | 'en' = 'vi', list = notes) {
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
})
