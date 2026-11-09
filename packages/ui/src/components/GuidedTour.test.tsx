import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react'
import { GuidedTour, type TourStep } from './GuidedTour'
import { I18nProvider } from '../i18n'

const rect = (top: number, left: number) => () =>
  ({ top, left, width: 80, height: 30, right: left + 80, bottom: top + 30, x: left, y: top, toJSON() {} }) as DOMRect

function Host({ steps, open = true, onClose }: { steps: TourStep[]; open?: boolean; onClose: (r: 'done' | 'skipped') => void }) {
  return (
    <I18nProvider locale="vi">
      <button id="nut-a">A</button>
      <button id="nut-b">B</button>
      <button id="nut-c">C</button>
      <GuidedTour steps={steps} open={open} onClose={onClose} />
    </I18nProvider>
  )
}
const steps: TourStep[] = [
  { id: 'a', target: ['#nut-a'], title: 'TA', body: 'BA' },
  { id: 'b', target: ['#nut-b'], title: 'TB', body: 'BB' },
  { id: 'c', target: ['#nut-c'], title: 'TC', body: 'BC' },
]
function mockRects() {
  document.getElementById('nut-a')!.getBoundingClientRect = rect(100, 50)
  document.getElementById('nut-b')!.getBoundingClientRect = rect(200, 60)
  document.getElementById('nut-c')!.getBoundingClientRect = rect(300, 70)
}
const setup = (s = steps, onClose = vi.fn()) => {
  const r = render(<Host steps={s} onClose={onClose} />)
  mockRects()
  // re-render so positioning measures mocked rects
  r.rerender(<Host steps={s} onClose={onClose} />)
  fireEvent(window, new Event('resize'))
  return { r, onClose }
}
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('GuidedTour', () => {
  it('navigates with buttons and shows progress', () => {
    setup()
    expect(document.querySelector('.tour-prev')).toBeNull()
    expect(document.querySelector('.tour-progress')!.textContent).toBe('1/3')
    fireEvent.click(document.querySelector('.tour-next')!)
    expect(document.querySelector('.tour-progress')!.textContent).toBe('2/3')
    expect(document.querySelector('.tour-prev')).not.toBeNull()
    fireEvent.click(document.querySelector('.tour-prev')!)
    expect(document.querySelector('.tour-progress')!.textContent).toBe('1/3')
  })
  it('last step is Xong and closes done once', () => {
    const { onClose } = setup()
    fireEvent.click(document.querySelector('.tour-next')!)
    fireEvent.click(document.querySelector('.tour-next')!)
    expect(document.querySelector('.tour-next')!.textContent).toBe('Xong')
    fireEvent.click(document.querySelector('.tour-next')!)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith('done')
  })
  it('Esc skips; skip button skips', () => {
    const { onClose } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledWith('skipped')
    fireEvent.click(document.querySelector('.tour-skip')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('Esc does not reach a window listener while open, but does when closed', () => {
    const seen = vi.fn()
    window.addEventListener('keydown', seen)
    const { r, onClose } = setup()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledWith('skipped')
    expect(seen).not.toHaveBeenCalled()
    r.unmount()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(seen).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', seen)
  })
  it('arrow keys change step', () => {
    setup()
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(document.querySelector('.tour-progress')!.textContent).toBe('2/3')
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(document.querySelector('.tour-progress')!.textContent).toBe('1/3')
  })
  it('missing target is centered', () => {
    setup([{ id: 'x', target: ['#khong-co'], title: 'T', body: 'B' }])
    expect(document.querySelector('.tour-pop')!.getAttribute('data-placement')).toBe('center')
    expect(document.querySelector('.tour-spotlight')!.getAttribute('data-centered')).toBe('true')
  })
  it('falls through selector list to the first visible one', async () => {
    setup([{ id: 'x', target: ['#khong-co', '#nut-b'], title: 'T', body: 'B' }])
    const sp = document.querySelector('.tour-spotlight') as HTMLElement
    await waitFor(() => expect(sp.getAttribute('data-centered')).toBe('false'))
    expect(sp.style.top).toBe('194px')
  })
  it('focuses next on open and restores focus on close', () => {
    const onClose = vi.fn()
    const r = render(<Host steps={steps} open={false} onClose={onClose} />)
    const a = document.getElementById('nut-a')!
    a.focus()
    r.rerender(<Host steps={steps} open onClose={onClose} />)
    expect(document.activeElement).toBe(document.querySelector('.tour-next'))
    r.rerender(<Host steps={steps} open={false} onClose={onClose} />)
    expect(document.activeElement).toBe(a)
  })
  it('closed renders no dialog', () => {
    render(<Host steps={steps} open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
