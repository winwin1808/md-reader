import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as Y from 'yjs'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { listThreads } from '@md-reader/core'

let layerProps: Record<string, any> = {}
let sharedBind: ((d: Y.Doc, o: { onReject?: () => void }) => unknown) | null = null
vi.mock('./collab', async (orig) => {
  const m = await orig<typeof import('./collab')>()
  return { ...m, bindRoom: (...a: unknown[]) => (sharedBind ? sharedBind(...(a as [Y.Doc, { onReject?: () => void }])) : (m.bindRoom as any)(...a)) }
})
vi.mock('@md-reader/ui', async (orig) => ({
  ...(await orig<typeof import('@md-reader/ui')>()),
  // test-only mocks
  Viewer: (p: { html: string }): ReactNode => <div data-testid="viewer" dangerouslySetInnerHTML={{ __html: p.html }} />,
  CommentLayer: (p: Record<string, any>): ReactNode => {
    layerProps = p
    return null
  },
}))
import { ViewPage } from './ViewPage'
import { SharePage } from './SharePage'
import type { bindRoom, SyncStatus } from './collab'

afterEach(() => { cleanup(); localStorage.clear() })
beforeEach(() => { layerProps = {}; localStorage.clear() })

function setup() {
  const doc = new Y.Doc({ gc: false })
  doc.getText('source').insert(0, '# Hello world')
  let emit: (s: SyncStatus) => void = () => {}
  let reject: () => void = () => {}
  const destroy = vi.fn()
  const bind = vi.fn((_d: Y.Doc, o: { onReject?: () => void }) => {
    reject = () => o.onReject?.()
    return {
      provider: {}, awareness: {},
      status$: (cb: (s: SyncStatus) => void) => { emit = cb; return () => {} },
      destroy,
    }
  }) as unknown as typeof bindRoom
  const ui = (
    <ViewPage token="tok" info={{ roomId: 'r', role: 'view', title: 'T' } as never} doc={doc} bind={bind} mermaid={false} rejected={false} onRejected={() => {}} />
  )
  return { doc, ui, emit: (s: SyncStatus) => act(() => emit(s)), reject: () => act(() => reject()), destroy }
}

describe('ViewPage comments', () => {
  it('renders content from doc', () => {
    const { ui } = setup()
    render(ui)
    expect(screen.getByTestId('viewer').textContent).toContain('Hello world')
  })

  it('toggle opens the panel', () => {
    const { ui } = setup()
    render(ui)
    expect(document.querySelector('.web-comments-drawer')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Bình luận \(0\)/ }))
    expect(document.querySelector('.web-comments-drawer')).toBeTruthy()
  })

  it('creates a thread with the stored name', async () => {
    localStorage.setItem('mdr.displayName', 'Ann')
    const { ui, doc } = setup()
    render(ui)
    expect(layerProps.askName).toBe(false)
    act(() => { layerProps.onCreate({ from: 2, to: 7 }, 'hi') })
    expect(listThreads(doc)[0]?.author).toBe('Ann')
    await waitFor(() => expect(document.querySelector('.web-comments-drawer')).toBeTruthy())
  })

  it('asks for a name and stores it', () => {
    const { ui, doc } = setup()
    render(ui)
    expect(layerProps.askName).toBe(true)
    act(() => { layerProps.onCreate({ from: 2, to: 7 }, 'hi', 'Bo') })
    expect(localStorage.getItem('mdr.displayName')).toBe('Bo')
    expect(listThreads(doc)[0]?.author).toBe('Bo')
  })

  it('status full disables the button with a title', () => {
    const { ui, emit } = setup()
    render(ui)
    emit('full')
    const b = screen.getByRole('button', { name: /Bình luận/ }) as HTMLButtonElement
    expect(b.disabled).toBe(true)
    expect(b.title).toContain('đã đầy')
    expect(layerProps.enabled).toBe(false)
  })

  it('rejected prop disables the button and the layer, calls onRejected once, destroys conn', () => {
    const onRejected = vi.fn()
    const s = setup()
    const el = (r: boolean) => <ViewPage token="tok" info={{ roomId: 'r', role: 'view', title: 'T' } as never} doc={s.doc} bind={(s.ui.props as any).bind} mermaid={false} rejected={r} onRejected={onRejected} />
    const view = render(el(false))
    s.reject()
    expect(s.destroy).toHaveBeenCalledTimes(1)
    expect(onRejected).toHaveBeenCalledTimes(1)
    view.rerender(el(true))
    const b = screen.getByRole('button', { name: /Bình luận/ }) as HTMLButtonElement
    expect(b.disabled).toBe(true)
    expect(b.title).toContain('chỉ có quyền xem')
    expect(layerProps.enabled).toBe(false)
  })

  it('renders hostile body as text', () => {
    const { ui, doc } = setup()
    render(ui)
    act(() => { layerProps.onCreate({ from: 2, to: 7 }, '<img src=x onerror=alert(1)>', 'Bo') })
    const drawer = document.querySelector('.web-comments-drawer')!
    expect(drawer.querySelector('img')).toBeNull()
    expect(drawer.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(listThreads(doc).length).toBe(1)
  })

  it('does not destroy the doc on unmount', () => {
    const { ui, doc, destroy } = setup()
    const spy = vi.spyOn(doc, 'destroy')
    render(ui).unmount()
    expect(destroy).toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('SharePage rejected flow', () => {
  afterEach(() => { sharedBind = null })
  it('reload once, one notice, button disabled after reload; cancelled load destroys doc', async () => {
    const mk = () => { const d = new Y.Doc({ gc: false }); d.getText('source').insert(0, '# Hi'); return d }
    const destroys: ReturnType<typeof vi.fn>[] = []
    let reject: () => void = () => {}
    const connDestroy = vi.fn()
    sharedBind = (_d, o) => {
      reject = () => o.onReject?.()
      return { provider: {}, awareness: {}, status$: () => () => {}, destroy: connDestroy }
    }
    const load = vi.fn(async () => {
      const doc = mk()
      destroys.push(vi.spyOn(doc, 'destroy') as never)
      return { kind: 'ready' as const, info: { roomId: 'r', role: 'view', title: 'T' } as never, text: '# Hi', doc }
    })
    render(<SharePage token="tok" load={load as never} mermaid={false} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Bình luận/ })).toBeTruthy())
    expect(load).toHaveBeenCalledTimes(1)
    act(() => reject())
    expect(connDestroy).toHaveBeenCalled()
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await waitFor(() => expect((screen.getByRole('button', { name: /Bình luận/ }) as HTMLButtonElement).disabled).toBe(true))
    expect(screen.getAllByText(/chỉ có quyền xem/).length).toBe(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('destroys the doc of a load that resolves after cancel', async () => {
    const doc = new Y.Doc({ gc: false })
    const spy = vi.spyOn(doc, 'destroy')
    let resolve: (v: unknown) => void = () => {}
    const load = vi.fn(() => new Promise((r) => { resolve = r }))
    const v = render(<SharePage token="tok" load={load as never} mermaid={false} />)
    v.unmount()
    await act(async () => { resolve({ kind: 'ready', info: { roomId: 'r', role: 'view', title: 'T' }, text: '', doc }) })
    expect(spy).toHaveBeenCalled()
  })
})
