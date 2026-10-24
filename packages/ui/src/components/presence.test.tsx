import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { awarenessToPeers, peerUser, usePeers, type AwarenessLike } from './presence'
import { peerColor } from './PresenceBar'

describe('awarenessToPeers', () => {
  it('maps, skips, marks self, caps and defaults names', () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: { name: 'An' } }],
      [2, {}],
      [3, { user: { name: 'x'.repeat(60) } }],
      [4, { user: { name: '   ' } }],
    ])
    const r = awarenessToPeers(states, 1)
    expect(r.map((p) => p.clientId)).toEqual([1, 3, 4])
    expect(r[0]!.isSelf).toBe(true)
    expect(r[1]!.isSelf).toBe(false)
    expect(r[1]!.name).toHaveLength(40)
    expect(r[2]!.name).toBe('Ẩn danh')
  })
  it('ignores remote color', () => {
    const r = awarenessToPeers(new Map([[5, { user: { name: 'a', color: 'red;background:url(x)' } }]]), 0)
    expect(r[0]!.color).toBe(peerColor(5))
  })
})

describe('peerUser', () => {
  it('builds colorLight', () => {
    const u = peerUser(2, 'B')
    expect(u.color).toBe(peerColor(2))
    expect(u.colorLight).toContain('color-mix')
    expect(u.colorLight).toContain('var(--peer-')
  })
})

function fake(): AwarenessLike & { states: Map<number, Record<string, unknown>>; emit(): void; n(): number } {
  const ls = new Set<() => void>()
  const states = new Map<number, Record<string, unknown>>([[1, { user: { name: 'Me' } }]])
  return {
    clientID: 1, states,
    getStates: () => states,
    on: (_e, cb) => { ls.add(cb) },
    off: (_e, cb) => { ls.delete(cb) },
    emit: () => ls.forEach((f) => f()),
    n: () => ls.size,
  }
}

function Probe({ a }: { a: AwarenessLike | null }) {
  return <div data-testid="o">{usePeers(a).map((p) => p.name).join(',')}</div>
}

describe('usePeers', () => {
  it('renders, updates, unsubscribes', () => {
    const a = fake()
    const { container, unmount } = render(<Probe a={a} />)
    expect(container.textContent).toBe('Me')
    act(() => { a.states.set(2, { user: { name: 'You' } }); a.emit() })
    expect(container.textContent).toBe('Me,You')
    expect(a.n()).toBe(1)
    unmount()
    expect(a.n()).toBe(0)
  })
  it('null gives empty', () => {
    const { container } = render(<Probe a={null} />)
    expect(container.textContent).toBe('')
  })
})
