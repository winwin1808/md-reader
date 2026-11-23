import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { CommentLayer, type CommentLayerProps } from './CommentLayer'

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
