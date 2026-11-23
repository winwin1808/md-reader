// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { EditorState, EditorSelection, Compartment } from '@codemirror/state'
import { EditorView, showTooltip, type Tooltip } from '@codemirror/view'
import type { CommentThread } from '@md-reader/core'
import { commentsExtension, refreshComments, type EditorCommentsConfig } from './comments'

const DOC = 'hello world, text here'
function th(id: string, p: Partial<CommentThread> = {}): CommentThread {
  return { id, author: 'a', clientId: 1, ts: 0, body: 'b', quote: '', range: { from: 2, to: 7 }, resolved: false, resolvedBy: null, deleted: false, replies: [], ...p }
}
function setup(cfg: EditorCommentsConfig, doc = DOC) {
  const view = new EditorView({ state: EditorState.create({ doc, extensions: [commentsExtension(() => cfg)] }), parent: document.body })
  return view
}
const mk = (threads: CommentThread[], activeId: string | null = null) => ({ threads, activeId, onCreate: vi.fn(), onSelect: vi.fn() })
const tipOf = (view: EditorView): Tooltip | null => {
  const vals = view.state.facet(showTooltip)
  return (vals.find((v) => v) as Tooltip | null | undefined) ?? null
}

describe('commentsExtension', () => {
  it('decorates open thread range', () => {
    const view = setup(mk([th('a')]))
    const els = view.contentDOM.querySelectorAll('.cm-comment')
    expect(Array.from(els).map((e) => e.textContent).join('')).toBe(DOC.slice(2, 7))
    expect(els[0]?.getAttribute('data-comment-id')).toBe('a')
  })
  it('skips resolved/deleted/null range', () => {
    const view = setup(mk([th('a', { resolved: true }), th('b', { deleted: true }), th('c', { range: null })]))
    expect(view.contentDOM.querySelector('.cm-comment')).toBeNull()
  })
  it('marks active', () => {
    const view = setup(mk([th('a'), th('b', { range: { from: 9, to: 12 } })], 'a'))
    expect(view.contentDOM.querySelectorAll('.cm-comment-active').length).toBeGreaterThan(0)
    expect(view.contentDOM.querySelector('[data-comment-id="b"]')!.classList.contains('cm-comment-active')).toBe(false)
  })
  it('refreshes on effect', () => {
    const cfg = mk([th('a')])
    const view = setup(cfg)
    cfg.threads = [th('z', { range: { from: 9, to: 12 } })]
    view.dispatch({ effects: refreshComments.of(null) })
    const els = view.contentDOM.querySelectorAll('.cm-comment')
    expect(Array.from(els).map((e) => e.textContent).join('')).toBe(DOC.slice(9, 12))
    expect(els[0]?.getAttribute('data-comment-id')).toBe('z')
  })
  it('maps through edits', () => {
    const view = setup(mk([th('a')]))
    view.dispatch({ changes: { from: 0, insert: 'XX' } })
    const els = view.contentDOM.querySelectorAll('.cm-comment')
    expect(Array.from(els).map((e) => e.textContent).join('')).toBe(DOC.slice(2, 7))
  })
  it('tooltip on selection, creates', () => {
    const cfg = mk([])
    const view = setup(cfg)
    expect(tipOf(view)).toBeNull()
    view.dispatch({ selection: EditorSelection.single(2, 7) })
    const tip = tipOf(view)!
    expect(tip).not.toBeNull()
    expect(tip.above).toBe(true)
    const dom = tip.create(view).dom
    const btn = dom.querySelector('.cm-comment-add') as HTMLButtonElement
    expect(btn.textContent).toBeTruthy()
    const md = new MouseEvent('mousedown', { cancelable: true, bubbles: true })
    btn.dispatchEvent(md)
    expect(md.defaultPrevented).toBe(true)
    btn.click()
    expect(cfg.onCreate).toHaveBeenCalledWith({ from: 2, to: 7 })
    view.dispatch({ selection: EditorSelection.single(3) })
    expect(tipOf(view)).toBeNull()
  })
  it('click on comment selects', () => {
    const cfg = mk([th('a')])
    const view = setup(cfg)
    view.contentDOM.querySelector('[data-comment-id]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cfg.onSelect).toHaveBeenCalledWith('a')
  })
  it('tooltip follows readOnly reconfigure', () => {
    const cfg = mk([])
    const ro = new Compartment()
    const view = new EditorView({
      state: EditorState.create({ doc: DOC, selection: EditorSelection.single(2, 7), extensions: [commentsExtension(() => cfg), ro.of(EditorState.readOnly.of(false))] }),
      parent: document.body,
    })
    expect(tipOf(view)).not.toBeNull()
    view.dispatch({ effects: ro.reconfigure(EditorState.readOnly.of(true)) })
    expect(tipOf(view)).toBeNull()
    view.dispatch({ effects: ro.reconfigure(EditorState.readOnly.of(false)) })
    expect(tipOf(view)).not.toBeNull()
  })
  it('tooltip keeps same object when head unchanged', () => {
    const view = setup(mk([]))
    view.dispatch({ selection: EditorSelection.single(2, 7) })
    const a = tipOf(view)
    view.dispatch({ selection: EditorSelection.single(3, 7) })
    expect(tipOf(view)).toBe(a)
  })
})
