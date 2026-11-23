import { StateEffect, StateField, type Extension, type Range } from '@codemirror/state'
import { Decoration, EditorView, showTooltip, type DecorationSet, type Tooltip } from '@codemirror/view'
import type { CommentThread } from '@md-reader/core'
import { translateFacet } from './i18n-facet'

export interface EditorCommentsConfig {
  threads: CommentThread[]
  activeId: string | null
  onCreate(range: { from: number; to: number }): void
  onSelect(id: string): void
}

export const refreshComments = StateEffect.define<null>()

function build(cfg: EditorCommentsConfig, len: number): DecorationSet {
  const items: { from: number; to: number; id: string }[] = []
  for (const t of cfg.threads) {
    if (t.deleted || t.resolved || !t.range || !(t.range.from < t.range.to)) continue
    const from = Math.max(0, Math.min(len, t.range.from))
    const to = Math.max(0, Math.min(len, t.range.to))
    if (from < to) items.push({ from, to, id: t.id })
  }
  const ranges: Range<Decoration>[] = items.map((i) =>
    Decoration.mark({
      class: i.id === cfg.activeId ? 'cm-comment cm-comment-active' : 'cm-comment',
      attributes: { 'data-comment-id': i.id },
    }).range(i.from, i.to),
  )
  return Decoration.set(ranges, true)
}

export function commentsExtension(get: () => EditorCommentsConfig): Extension {
  const decoField = StateField.define<DecorationSet>({
    create: (state) => build(get(), state.doc.length),
    update(decos, tr) {
      if (tr.effects.some((e) => e.is(refreshComments))) return build(get(), tr.state.doc.length)
      return tr.docChanged ? decos.map(tr.changes) : decos
    },
    provide: (f) => EditorView.decorations.from(f),
  })

  const create = (view: EditorView) => {
    const dom = document.createElement('div')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-comment-add'
    btn.textContent = view.state.facet(translateFacet)('comments.add')
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', () => {
      const m = view.state.selection.main
      get().onCreate({ from: m.from, to: m.to })
    })
    dom.appendChild(btn)
    return { dom }
  }

  const tipFor = (state: import('@codemirror/state').EditorState, prev: Tooltip | null): Tooltip | null => {
    const main = state.selection.main
    if (main.empty || state.readOnly) return null
    if (prev && prev.pos === main.head) return prev
    return { pos: main.head, above: true, create }
  }

  const tipField = StateField.define<Tooltip | null>({
    create: (state) => tipFor(state, null),
    update: (v, tr) =>
      tr.docChanged || tr.selection || tr.startState.readOnly !== tr.state.readOnly || tr.reconfigured
        ? tipFor(tr.state, v)
        : v,
    provide: (f) => showTooltip.from(f),
  })

  const clicks = EditorView.domEventHandlers({
    click(e, view) {
      let el = e.target as HTMLElement | null
      while (el && view.contentDOM.contains(el)) {
        const id = el.getAttribute?.('data-comment-id')
        if (id) {
          get().onSelect(id)
          return false
        }
        el = el.parentElement
      }
      return false
    },
  })

  return [decoField, tipField, clicks]
}
