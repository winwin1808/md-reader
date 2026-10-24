import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'
import { render, screen, waitFor } from '@testing-library/react'
import { SharePage } from './SharePage'
import { loadShare, tokenFromPath } from './share-client'

const TOKEN = 'abcdefghijklmnop1234'

function snapshot(text: string): ArrayBuffer {
  const d = new Y.Doc({ gc: false })
  d.getText('source').insert(0, text)
  const u = Y.encodeStateAsUpdate(d)
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

function fakeFetch(resolveStatus: number): typeof fetch {
  return (async (url: string) => {
    if (String(url).endsWith('/snapshot')) return new Response(snapshot('# Xin chào'), { status: 200 })
    if (resolveStatus !== 200) return new Response('', { status: resolveStatus })
    return new Response(JSON.stringify({ roomId: 'r', role: 'viewer', title: 'Tiêu đề' }), { status: 200 })
  }) as unknown as typeof fetch
}

describe('tokenFromPath', () => {
  it('parses', () => {
    expect(tokenFromPath(`/s/${TOKEN}`)).toBe(TOKEN)
    expect(tokenFromPath('/d/x')).toBeNull()
    expect(tokenFromPath('/s/short')).toBeNull()
  })
})

describe('loadShare', () => {
  it('410 -> gone', async () => {
    expect((await loadShare(TOKEN, fakeFetch(410))).kind).toBe('gone')
  })
  it('500 -> error', async () => {
    expect((await loadShare(TOKEN, fakeFetch(500))).kind).toBe('error')
  })
  it('200 -> ready', async () => {
    const s = await loadShare(TOKEN, fakeFetch(200))
    expect(s.kind).toBe('ready')
    if (s.kind === 'ready') expect(s.text).toBe('# Xin chào')
  })
})

describe('SharePage', () => {
  it('ready renders heading and footer', async () => {
    render(<SharePage token={TOKEN} load={(t) => loadShare(t, fakeFetch(200))} />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Xin chào'))
    expect(screen.getByText('Xem bằng MD Reader')).toBeTruthy()
    expect(document.title).toBe('Tiêu đề')
  })
  it('gone', async () => {
    render(<SharePage token={TOKEN} load={vi.fn(async () => ({ kind: 'gone' as const }))} />)
    await waitFor(() => expect(screen.getByText(/không còn hiệu lực/)).toBeTruthy())
  })
  it('null token', () => {
    render(<SharePage token={null} />)
    expect(screen.getByText(/Không tìm thấy/)).toBeTruthy()
  })
})
