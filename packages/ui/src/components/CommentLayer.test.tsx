import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { CommentLayer, CommentComposer, type CommentLayerProps } from './CommentLayer'

const source = 'Hello world foo world\n\nA **bold** b'
// block1 [0,21) block2 [23,35)
let root: HTMLElement
function mount(over: Record<string, unknown> = {}) {
  root = document.createElement('div')
  root.innerHTML =
    '<p data-sp="0:21">Hello world foo world</p><p data-sp="23:35">A <strong>bold</strong> b</p>'
  document.body.appendChild(root)
  const onCreate = vi.fn()
  const props = { container: root, source, threads: [], activeId: null, enabled: true, onCreate, onSelect: vi.fn(), askName: false, ...over }
  const r = render(<CommentLayer {...(props as unknown as CommentLayerProps)} />)
  return { ...r, onCreate }
}
function select(sn: Node, so: number, en: Node, eo: number) {
  const r = document.createRange()
  r.setStart(sn, so)
  r.setEnd(en, eo)
  const s = window.getSelection()!
  s.removeAllRanges()
  s.addRange(r)
  act(() => { document.dispatchEvent(new Event('selectionchange')) })
}
const addBtn = () => document.body.querySelector('.comment-add-btn') as HTMLElement | null
const ta = () => document.body.querySelector('.comment-composer textarea') as HTMLTextAreaElement
const sendBtn = () => Array.from(document.body.querySelectorAll('.comment-composer button')).find((b) => b.textContent === 'Gửi') as HTMLElement
const p1 = () => root.children[0]!.firstChild as Text
afterEach(() => { cleanup(); root?.remove(); window.getSelection()?.removeAllRanges() })

function submit(text: string) {
  fireEvent.click(addBtn()!)
  fireEvent.change(ta(), { target: { value: text } })
  fireEvent.click(sendBtn())
}

describe('CommentLayer', () => {
  it('select word -> button -> send', () => {
    const { onCreate } = mount()
    select(p1(), 0, p1(), 5)
    expect(addBtn()).toBeTruthy()
    submit('hi')
    const [range, body] = onCreate.mock.calls[0]!
    expect(source.slice(range.from, range.to)).toBe('Hello')
    expect(body).toBe('hi')
  })
  it('second occurrence maps to second', () => {
    const { onCreate } = mount()
    select(p1(), 16, p1(), 21)
    submit('x')
    const r = onCreate.mock.calls[0]![0]
    expect(r.from).toBe(16)
    expect(source.slice(r.from, r.to)).toBe('world')
  })
  it('bold text excludes markers', () => {
    const { onCreate } = mount()
    const t = root.querySelector('strong')!.firstChild!
    select(t, 0, t, 4)
    submit('x')
    const r = onCreate.mock.calls[0]![0]
    expect(source.slice(r.from, r.to)).toBe('bold')
  })
  it('across blocks ends at last block end', () => {
    const { onCreate } = mount()
    select(p1(), 12, root.children[1]!.lastChild!, 2)
    submit('x')
    const r = onCreate.mock.calls[0]![0]
    expect(r.to).toBe(35)
    expect(r.from).toBe(12)
  })
  it('triple-click ending at (next block, 0) stays in first block', () => {
    const { onCreate } = mount()
    select(p1(), 0, root.children[1]!.firstChild!, 0)
    submit('x')
    const r = onCreate.mock.calls[0]![0]
    expect(r.from).toBe(0)
    expect(r.to).toBeLessThanOrEqual(21)
  })
  it('source change closes composer without onCreate', () => {
    const { onCreate, rerender } = mount()
    select(p1(), 0, p1(), 5)
    fireEvent.click(addBtn()!)
    expect(ta()).toBeTruthy()
    rerender(<CommentLayer {...({ container: root, source: 'X' + source, threads: [], activeId: null, enabled: true, onCreate, onSelect: vi.fn(), askName: false } as unknown as CommentLayerProps)} />)
    expect(ta()).toBeNull()
    expect(sendBtn()).toBeUndefined()
    expect(onCreate).not.toHaveBeenCalled()
  })
  it('cmd+enter sends', () => {
    const { onCreate } = mount()
    select(p1(), 0, p1(), 5)
    fireEvent.click(addBtn()!)
    fireEvent.change(ta(), { target: { value: 'yo' } })
    fireEvent.keyDown(ta(), { key: 'Enter', metaKey: true })
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
  it('unmount removes selectionchange listener', () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = mount()
    unmount()
    expect(spy.mock.calls.some((c) => c[0] === 'selectionchange')).toBe(true)
    spy.mockRestore()
    select(p1(), 0, p1(), 5)
    expect(addBtn()).toBeNull()
  })
  it('disabled -> no button', () => {
    mount({ enabled: false })
    select(p1(), 0, p1(), 5)
    expect(addBtn()).toBeNull()
  })
  it('selection outside container -> no button', () => {
    mount()
    const out = document.createElement('p')
    out.textContent = 'outside text'
    document.body.appendChild(out)
    select(out.firstChild!, 0, out.firstChild!, 5)
    expect(addBtn()).toBeNull()
    out.remove()
  })
  it('ctrl+enter sends', () => {
    const { onCreate } = mount()
    select(p1(), 0, p1(), 5)
    fireEvent.click(addBtn()!)
    fireEvent.change(ta(), { target: { value: 'yo' } })
    fireEvent.keyDown(ta(), { key: 'Enter', ctrlKey: true })
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
  it('whitespace body not sent', () => {
    const { onCreate } = mount()
    select(p1(), 0, p1(), 5)
    submit('   ')
    expect(onCreate).not.toHaveBeenCalled()
  })
  it('askName passes trimmed name', () => {
    const { onCreate } = mount({ askName: true })
    select(p1(), 0, p1(), 5)
    fireEvent.click(addBtn()!)
    const name = document.body.querySelector('.comment-composer input') as HTMLInputElement
    expect(name).toBeTruthy()
    fireEvent.change(name, { target: { value: '  Lan ' } })
    fireEvent.change(ta(), { target: { value: 'b' } })
    fireEvent.click(sendBtn())
    expect(onCreate.mock.calls[0]![2]).toBe('Lan')
  })
  it('esc cancels', () => {
    const { onCreate } = mount()
    select(p1(), 0, p1(), 5)
    fireEvent.click(addBtn()!)
    fireEvent.change(ta(), { target: { value: 'b' } })
    fireEvent.keyDown(ta(), { key: 'Escape' })
    expect(onCreate).not.toHaveBeenCalled()
    expect(ta()).toBeNull()
  })
})

describe('CommentLayer highlights and markers', () => {
  const g = globalThis as unknown as Record<string, unknown>
  let origCSS: unknown
  let origHL: unknown
  let hmap: Map<string, { ranges: Range[] }>
  function stub() {
    hmap = new Map()
    class FakeHighlight {
      ranges: Range[] = []
      constructor(...r: Range[]) { this.ranges.push(...r) }
      add(r: Range) { this.ranges.push(r); return this }
    }
    g.CSS = { ...((origCSS as object) ?? {}), highlights: hmap }
    g.Highlight = FakeHighlight
  }
  function th(id: string, quote: string, from: number, to: number, over: Record<string, unknown> = {}) {
    return { id, author: 'a', clientId: 1, ts: 1, body: 'b', quote, range: { from, to }, resolved: false, resolvedBy: null, deleted: false, replies: [], ...over }
  }
  const T1 = th('t1', 'world', 6, 11)
  const marker = () => root.querySelector('.comment-marker') as HTMLElement | null
  beforeEach(() => { origCSS = g.CSS; origHL = g.Highlight; stub() })
  afterEach(() => {
    if (origCSS === undefined) delete g.CSS; else g.CSS = origCSS
    if (origHL === undefined) delete g.Highlight; else g.Highlight = origHL
  })

  it('open thread with quote -> one range equal to quote', () => {
    mount({ threads: [T1] })
    const h = hmap.get('mdr-comment')!
    expect(h.ranges).toHaveLength(1)
    expect(h.ranges[0]!.toString()).toBe('world')
  })
  it('active thread goes to active highlight', () => {
    mount({ threads: [T1], activeId: 't1' })
    expect(hmap.get('mdr-comment-active')!.ranges).toHaveLength(1)
    expect(hmap.get('mdr-comment')?.ranges ?? []).toHaveLength(0)
  })
  it('resolved or orphan -> not painted', () => {
    mount({ threads: [th('r', 'world', 6, 11, { resolved: true }), th('o', 'world', 6, 11, { range: null })] })
    expect(hmap.get('mdr-comment')?.ranges ?? []).toHaveLength(0)
    expect(root.querySelector('.comment-block-marked')).toBeNull()
    expect(marker()).toBeNull()
  })
  it('quote not found -> block marked', () => {
    mount({ threads: [th('t', 'nope', 0, 5)] })
    expect(root.children[0]!.classList.contains('comment-block-marked')).toBe(true)
    expect(hmap.get('mdr-comment')?.ranges ?? []).toHaveLength(0)
  })
  it('no CSS.highlights -> class fallback, no throw', () => {
    delete g.CSS
    delete g.Highlight
    mount({ threads: [T1], activeId: 't1' })
    const b = root.children[0]!
    expect(b.classList.contains('comment-block-marked')).toBe(true)
    expect(b.hasAttribute('data-comment-active')).toBe(true)
  })
  it('threads -> empty clears highlights and classes', () => {
    const { rerender } = mount({ threads: [T1, th('t2', 'zzz', 23, 30)], activeId: 't2' })
    expect(root.querySelector('.comment-block-marked')).toBeTruthy()
    rerender(<CommentLayer {...({ container: root, source, threads: [], activeId: null, enabled: true, onCreate: vi.fn(), onSelect: vi.fn(), askName: false } as unknown as CommentLayerProps)} />)
    expect(hmap.has('mdr-comment')).toBe(false)
    expect(hmap.has('mdr-comment-active')).toBe(false)
    expect(root.querySelector('.comment-block-marked')).toBeNull()
    expect(root.querySelector('[data-comment-active]')).toBeNull()
    expect(marker()).toBeNull()
  })
  it('unmount cleans up', () => {
    const { unmount } = mount({ threads: [th('t2', 'zzz', 23, 30)] })
    unmount()
    expect(root.querySelector('.comment-block-marked')).toBeNull()
    expect(hmap.size).toBe(0)
  })
  it('cleanup keeps highlight registered by another instance', () => {
    const { unmount } = mount({ threads: [T1] })
    const other = {}
    hmap.set('mdr-comment', other as never)
    unmount()
    expect(hmap.get('mdr-comment')).toBe(other)
  })
  it('marker shows count and click selects first thread', () => {
    const onSelect = vi.fn()
    mount({ threads: [T1, th('t2', 'Hello', 0, 5)], onSelect })
    const m = root.querySelectorAll('.comment-marker')
    expect(m).toHaveLength(1)
    expect(m[0]!.textContent).toBe('2')
    fireEvent.click(m[0]!)
    expect(onSelect).toHaveBeenCalledWith('t1')
  })
  it('marker data-active when thread active', () => {
    mount({ threads: [T1], activeId: 't1' })
    expect(marker()!.hasAttribute('data-active')).toBe(true)
  })
  it('click on commented text selects thread', () => {
    const onSelect = vi.fn()
    mount({ threads: [T1], onSelect })
    window.getSelection()!.removeAllRanges()
    fireEvent.click(p1())
    expect(onSelect).toHaveBeenCalledWith('t1')
  })
  it('click on uncommented text does nothing', () => {
    const onSelect = vi.fn()
    mount({ threads: [T1], onSelect })
    fireEvent.click(root.children[1]!.lastChild!)
    expect(onSelect).not.toHaveBeenCalled()
  })
  it('enabled=false -> no marker, no highlight', () => {
    mount({ threads: [T1], enabled: false })
    expect(marker()).toBeNull()
    expect(hmap.size).toBe(0)
    expect(root.querySelector('.comment-block-marked')).toBeNull()
  })
})

describe('CommentComposer', () => {
  const area = () => document.body.querySelector('textarea') as HTMLTextAreaElement
  const btn = (label: string) => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLElement
  it('submit sends body without author', () => {
    const onSubmit = vi.fn()
    render(<CommentComposer askName={false} onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(area(), { target: { value: 'hi' } })
    fireEvent.click(btn('Gửi'))
    expect(onSubmit).toHaveBeenCalledWith('hi', undefined)
  })
  it('askName sends trimmed name', () => {
    const onSubmit = vi.fn()
    render(<CommentComposer askName onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(document.body.querySelector('input')!, { target: { value: ' Lan ' } })
    fireEvent.change(area(), { target: { value: 'b' } })
    fireEvent.click(btn('Gửi'))
    expect(onSubmit).toHaveBeenCalledWith('b', 'Lan')
  })
  it('empty body not sent; cancel calls onCancel', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    render(<CommentComposer askName={false} onSubmit={onSubmit} onCancel={onCancel} />)
    fireEvent.click(btn('Gửi'))
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(btn('Huỷ'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('CommentLayer nested triple-click', () => {
  it('li with nested ul>li stays within outer block', () => {
    const src = '- outer\n  - inner'
    const r = document.createElement('div')
    r.innerHTML = '<ul><li data-sp="0:17">outer<ul><li data-sp="10:17">inner</li></ul></li></ul>'
    document.body.appendChild(r)
    const onCreate = vi.fn()
    render(<CommentLayer {...({ container: r, source: src, threads: [], activeId: null, enabled: true, onCreate, onSelect: vi.fn(), askName: false } as unknown as CommentLayerProps)} />)
    const outer = r.querySelector('li')!.firstChild!
    const inner = r.querySelectorAll('li')[1]!.firstChild!
    select(outer, 0, inner, 0)
    expect(addBtn()).toBeTruthy()
    fireEvent.click(addBtn()!)
    fireEvent.change(ta(), { target: { value: 'x' } })
    fireEvent.click(sendBtn())
    const range = onCreate.mock.calls[0]![0]
    expect(range.from).toBe(0)
    expect(range.to).toBe(17)
    r.remove()
  })
})
