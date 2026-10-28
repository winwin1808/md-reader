import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PresenceBar, peerColor, initials, type Peer } from './PresenceBar'

const p = (clientId: number, name: string, isSelf = false): Peer => ({
  clientId, name, color: peerColor(clientId), isSelf,
})

describe('peerColor', () => {
  it('is deterministic and covers 6 values', () => {
    const s = new Set([0, 1, 2, 3, 4, 5].map(peerColor))
    expect(s.size).toBe(6)
    expect(peerColor(7)).toBe(peerColor(1))
    expect(peerColor(1)).toBe('var(--peer-2)')
    expect(peerColor(-7)).toMatch(/^var\(--peer-[1-6]\)$/)
  })
})

describe('initials', () => {
  it('works', () => {
    expect(initials('Nguyễn Văn An')).toBe('NV')
    expect(initials(' lan ')).toBe('L')
    expect(initials('')).toBe('?')
  })
})

describe('PresenceBar', () => {
  it('empty renders nothing', () => {
    const { container } = render(<PresenceBar peers={[]} />)
    expect(container.innerHTML).toBe('')
  })
  it('self first', () => {
    const { container } = render(<PresenceBar peers={[p(1, 'An'), p(2, 'Zed', true)]} />)
    const av = container.querySelectorAll('.presence-avatar')
    expect(av[0]!.textContent).toBe('Z')
    expect(av[0]!.getAttribute('title')).toBe('Zed (bạn)')
    expect(av[0]!.getAttribute('aria-label')).toBe('Zed (bạn)')
  })
  it('collapses beyond max', () => {
    const peers = [p(1, 'A'), p(2, 'B'), p(3, 'C'), p(4, 'D')]
    const { container } = render(<PresenceBar peers={peers} max={2} />)
    expect(container.querySelectorAll('.presence-avatar').length).toBe(3)
    const more = container.querySelector('.presence-more')!
    expect(more.textContent).toBe('+2')
    expect(more.getAttribute('title')).toBe('C, D')
  })
  it('renders names as text', () => {
    const { container } = render(<PresenceBar peers={[p(1, '<img src=x>')]} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.presence-avatar')!.getAttribute('title')).toBe('<img src=x>')
  })
  it('group label has count', () => {
    const { container } = render(<PresenceBar peers={[p(1, 'A'), p(2, 'B')]} />)
    expect(container.querySelector('.presence-bar')!.getAttribute('aria-label')).toBe('Đang trong phòng: 2 người')
  })
})

describe('initials graphemes', () => {
  it('keeps ZWJ emoji whole', () => {
    expect(initials('👩‍💻 Dev')).toBe('👩‍💻D')
  })
  it('handles NFD names', () => {
    expect(initials('Đặng Ánh'.normalize('NFD'))).toBe('ĐÁ')
  })
})
