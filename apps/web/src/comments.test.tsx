import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as Y from 'yjs'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { listThreads } from '@md-reader/core'

let layerProps: Record<string, any> = {}
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
    <ViewPage token="tok" info={{ roomId: 'r', role: 'view', title: 'T' } as never} doc={doc} bind={bind} mermaid={false} />
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

  it('onReject notifies and disables', () => {
    const { ui, reject } = setup()
    render(ui)
    reject()
    expect(screen.getByText(/chỉ có quyền xem/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Bình luận/ }) as HTMLButtonElement).disabled).toBe(true)
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
