import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Y from 'yjs'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'

const recorded: Array<Record<string, unknown>> = []
vi.mock('@md-reader/ui', async (orig) => ({
  ...(await orig<typeof import('@md-reader/ui')>()),
  // test-only: dangerouslySetInnerHTML is fine in a mock Viewer
  Viewer: (p: { html: string }): ReactNode => {
    recorded.push(p as unknown as Record<string, unknown>)
    return <div data-testid="viewer" dangerouslySetInnerHTML={{ __html: p.html }} />
  },
}))
import { SharePage } from './SharePage'
import { loadShare, renderShareHtml, tokenFromPath, sendReport } from './share-client'

afterEach(() => { cleanup(); document.title = '' })

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
    await waitFor(() => expect(document.title).toBe('Tiêu đề'))
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

describe('renderShareHtml', () => {
  it('strips frontmatter text', () => {
    const html = renderShareHtml('---\ntitle: A\n---\n# B')
    expect(html).not.toContain('title: A')
    expect(html).toContain('B')
  })
  it('localizes alerts to vi', () => {
    expect(renderShareHtml('> [!NOTE]\n> hi')).toContain('Ghi chú')
  })
  it('marks external links', () => {
    expect(renderShareHtml('[x](https://example.com)')).toContain('external-link')
  })
})

describe('loadShare errors', () => {
  it('fetch throws', async () => {
    const f = (async () => { throw new Error('x') }) as unknown as typeof fetch
    expect(await loadShare(TOKEN, f)).toEqual({ kind: 'error', message: 'Không kết nối được máy chủ' })
  })
  it('resolve 500', async () => {
    expect(await loadShare(TOKEN, fakeFetch(500))).toEqual({ kind: 'error', message: 'Máy chủ trả lỗi 500' })
  })
  it('snapshot 500', async () => {
    const f = (async (url: string) =>
      String(url).endsWith('/snapshot')
        ? new Response('', { status: 500 })
        : new Response(JSON.stringify({ roomId: 'r', role: 'viewer' }), { status: 200 })) as unknown as typeof fetch
    expect(await loadShare(TOKEN, f)).toEqual({ kind: 'error', message: 'Máy chủ trả lỗi 500' })
  })
  it('snapshot 410 -> gone', async () => {
    const f = (async (url: string) =>
      String(url).endsWith('/snapshot')
        ? new Response('', { status: 410 })
        : new Response(JSON.stringify({ roomId: 'r', role: 'viewer' }), { status: 200 })) as unknown as typeof fetch
    expect((await loadShare(TOKEN, f)).kind).toBe('gone')
  })
  it('garbage snapshot', async () => {
    const f = (async (url: string) =>
      String(url).endsWith('/snapshot')
        ? new Response(new Uint8Array([255, 255, 255, 1, 2, 3]), { status: 200 })
        : new Response(JSON.stringify({ roomId: 'r', role: 'viewer' }), { status: 200 })) as unknown as typeof fetch
    expect(await loadShare(TOKEN, f)).toEqual({ kind: 'error', message: 'Dữ liệu chia sẻ không hợp lệ' })
  })
})

describe('SharePage viewer props and retry', () => {
  beforeEach(() => { recorded.length = 0 })
  const ok = (t: string) => loadShare(t, fakeFetch(200))
  it('mermaid defaults true', async () => {
    render(<SharePage token={TOKEN} load={ok} />)
    await waitFor(() => expect(screen.getByTestId('viewer')).toBeTruthy())
    expect(recorded.at(-1)?.mermaid).toBe(true)
  })
  it('mermaid false is passed', async () => {
    render(<SharePage token={TOKEN} load={ok} mermaid={false} />)
    await waitFor(() => expect(screen.getByTestId('viewer')).toBeTruthy())
    expect(recorded.at(-1)?.mermaid).toBe(false)
  })
  it('rejected load shows unknown error', async () => {
    render(<SharePage token={TOKEN} load={vi.fn(async () => { throw new Error('x') })} />)
    await waitFor(() => expect(screen.getByText('Lỗi không xác định')).toBeTruthy())
  })
  it('error then retry', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ kind: 'error', message: 'Máy chủ trả lỗi 500' })
      .mockImplementationOnce(ok)
    render(<SharePage token={TOKEN} load={load} />)
    await waitFor(() => expect(screen.getByText('Máy chủ trả lỗi 500')).toBeTruthy())
    fireEvent.click(screen.getByText('Thử lại'))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Xin chào'))
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('SharePage roles', () => {
  const load = (role: string) => async () => ({
    kind: 'ready' as const, text: '# A', info: { roomId: 'r', role: role as 'view' | 'edit', title: 'T' },
  })
  it('edit role renders name form', async () => {
    localStorage.clear()
    render(<SharePage token={TOKEN} load={load('edit') as never} />)
    await waitFor(() => expect(screen.getByText('Bắt đầu sửa')).toBeTruthy())
  })
  it('view role has no editor or name form', async () => {
    render(<SharePage token={TOKEN} load={load('view') as never} />)
    await waitFor(() => expect(screen.getByTestId('viewer')).toBeTruthy())
    expect(screen.queryByText('Bắt đầu sửa')).toBeNull()
    expect(document.querySelector('.cm-editor')).toBeNull()
  })
})

describe('sendReport', () => {
  const mk = (status: number | 'throw'): typeof fetch =>
    (async () => { if (status === 'throw') throw new Error('x'); return new Response('', { status }) }) as unknown as typeof fetch
  it('maps statuses', async () => {
    expect(await sendReport(TOKEN, 'r', mk(202))).toBe('sent')
    expect(await sendReport(TOKEN, 'r', mk(429))).toBe('limited')
    expect(await sendReport(TOKEN, 'r', mk(500))).toBe('failed')
    expect(await sendReport(TOKEN, 'r', mk('throw'))).toBe('failed')
  })
})

describe('SharePage report', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const open = async (): Promise<void> => {
    render(<SharePage token={TOKEN} load={(t) => loadShare(t, fakeFetch(200))} />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())
    fireEvent.click(screen.getByText('Báo cáo nội dung'))
  }
  it('send disabled when empty; 202 closes form and notifies', async () => {
    const f = vi.fn(async () => new Response('', { status: 202 }))
    vi.stubGlobal('fetch', f)
    await open()
    const send = screen.getByText('Gửi báo cáo') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(f).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Lý do báo cáo'), { target: { value: 'spam' } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() => expect(screen.getByText(/Đã gửi báo cáo/)).toBeTruthy())
    expect(screen.queryByLabelText('Lý do báo cáo')).toBeNull()
  })
  it('429 shows limit notice', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })))
    await open()
    fireEvent.change(screen.getByLabelText('Lý do báo cáo'), { target: { value: 'spam' } })
    fireEvent.click(screen.getByText('Gửi báo cáo'))
    await waitFor(() => expect(screen.getByText(/quá nhiều báo cáo/)).toBeTruthy())
  })
})
