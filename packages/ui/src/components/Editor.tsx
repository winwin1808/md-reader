import React, { useEffect, useRef } from 'react'
import type * as Y from 'yjs'
import { EditorState, Compartment, Prec } from '@codemirror/state'
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  placeholder as cmPlaceholder,
  keymap,
} from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  bracketMatching,
  syntaxHighlighting,
  HighlightStyle,
} from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import { applyFormat } from './markdown-commands'
import type { FormatAction } from './FormattingToolbar'
import { blameGutter, type LineAuthor } from './blame'
import { livePreview, createDefaultRenderers } from '../live'
import type { BlockRenderers } from '../live'
import '../theme/editor.css'
import '../theme/live.css'

export { livePreview, createDefaultRenderers }

export const lereSachHighlight = HighlightStyle.define([
  { tag: t.heading, color: 'var(--ink)', fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '600' },
  { tag: [t.link, t.url], color: 'var(--accent)' },
  { tag: t.monospace, color: 'var(--code-string)' },
  { tag: t.quote, color: 'var(--pencil)', fontStyle: 'italic', textDecoration: 'none' },
  { tag: [t.list, t.processingInstruction, t.punctuation], color: 'var(--pencil)' },
  { tag: t.keyword, color: 'var(--code-keyword)' },
  { tag: t.string, color: 'var(--code-string)' },
  { tag: t.comment, color: 'var(--code-comment)' },
  { tag: t.number, color: 'var(--code-number)' },
  { tag: t.meta, color: 'var(--code-meta)' },
])

// Wraps the pure applyFormat helper; dispatches only the changed range (Yjs-safe).
function formatCommand(action: FormatAction) {
  return (view: EditorView): boolean => {
    if (view.state.readOnly) return false
    const text = view.state.doc.toString()
    const { from, to } = view.state.selection.main
    const r = applyFormat(text, from, to, action)
    const a = text
    const b = r.newText
    let start = 0
    const max = Math.min(a.length, b.length)
    while (start < max && a[start] === b[start]) start++
    let endA = a.length
    let endB = b.length
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
      endA--
      endB--
    }
    view.dispatch({
      changes: { from: start, to: endA, insert: b.slice(start, endB) },
      selection: { anchor: r.newSelectionStart, head: r.newSelectionEnd },
    })
    return true
  }
}

export interface EditorProps {
  yText: Y.Text
  undoManager?: Y.UndoManager
  className?: string
  placeholder?: string
  readOnly?: boolean
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void
  onEditorReady?: (view: EditorView) => void
  awareness?: Parameters<typeof yCollab>[1]
  blame?: Array<LineAuthor | null> | null
  variant?: 'source' | 'live'
  renderers?: BlockRenderers
  live?: { theme?: () => 'default' | 'dark' }
  editorViewRef?: React.RefObject<EditorView | null> | React.MutableRefObject<EditorView | null>
}

export function Editor({
  yText,
  undoManager,
  className,
  placeholder,
  readOnly = false,
  onScroll,
  onEditorReady,
  editorViewRef,
  awareness,
  blame,
  variant = 'source',
  renderers,
  live: liveOpts,
}: EditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyCompartmentRef = useRef(new Compartment())
  const blameCompartmentRef = useRef(new Compartment())
  const blameRef = useRef(blame)
  blameRef.current = blame
  const liveThemeRef = useRef(liveOpts?.theme)
  liveThemeRef.current = liveOpts?.theme
  const onScrollRef = useRef(onScroll)
  onScrollRef.current = onScroll

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartmentRef.current.reconfigure(
          EditorState.readOnly.of(Boolean(readOnly))
        ),
      })
    }
  }, [readOnly])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: blameCompartmentRef.current.reconfigure(blame ? blameGutter(blame) : []),
    })
  }, [blame])

  useEffect(() => {
    if (!containerRef.current) return
    const live = variant === 'live'

    const extensions = [
      live ? markdown({ base: markdownLanguage }) : markdown(),
      ...(live ? [] : [lineNumbers(), highlightActiveLine()]),
      ...(live ? livePreview(renderers ?? createDefaultRenderers(), { theme: () => liveThemeRef.current?.() ?? 'default' }) : []),
      bracketMatching(),
      syntaxHighlighting(lereSachHighlight),
      Prec.high(
        keymap.of([
          { key: 'Mod-b', run: formatCommand('bold') },
          { key: 'Mod-i', run: formatCommand('italic') },
          { key: 'Mod-k', run: formatCommand('link') },
          ...yUndoManagerKeymap,
        ])
      ),
      yCollab(yText, awareness ?? null, undoManager !== undefined ? { undoManager } : undefined),
      readOnlyCompartmentRef.current.of(EditorState.readOnly.of(Boolean(readOnly))),
      blameCompartmentRef.current.of(blameRef.current ? blameGutter(blameRef.current) : []),
      EditorView.domEventHandlers({
        scroll: (_event, view) => {
          if (onScrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM
            onScrollRef.current(scrollTop, scrollHeight, clientHeight)
          }
        },
      }),
      ...(placeholder ? [cmPlaceholder(placeholder)] : []),
    ]

    const state = EditorState.create({
      doc: yText.toString(),
      extensions,
    })

    const view = new EditorView({
      parent: containerRef.current,
      state,
    })

    viewRef.current = view
    if (editorViewRef) {
      ;(editorViewRef as React.MutableRefObject<EditorView | null>).current = view
    }
    onEditorReady?.(view)

    return () => {
      view.destroy()
      viewRef.current = null
      if (editorViewRef) {
        ;(editorViewRef as React.MutableRefObject<EditorView | null>).current = null
      }
    }
  }, [yText, undoManager, awareness, variant, renderers])

  if (variant === 'live') {
    return (
      <div className="editor-live-pane">
        <div className="editor-live-sheet">
          <div ref={containerRef} className={['editor-live', className].filter(Boolean).join(' ')} />
        </div>
      </div>
    )
  }
  return <div ref={containerRef} className={className} style={{ height: '100%', minHeight: 0 }} />
}
