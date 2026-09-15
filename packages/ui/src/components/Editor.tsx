import React, { useEffect, useRef } from 'react'
import type * as Y from 'yjs'
import { EditorState, Compartment } from '@codemirror/state'
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import {
  bracketMatching,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language'
import { yCollab } from 'y-codemirror.next'
import '../theme/editor.css'

export interface EditorProps {
  yText: Y.Text
  undoManager?: Y.UndoManager
  className?: string
  placeholder?: string
  readOnly?: boolean
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void
  onEditorReady?: (view: EditorView) => void
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
}: EditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyCompartmentRef = useRef(new Compartment())
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
    if (!containerRef.current) return

    const extensions = [
      markdown(),
      lineNumbers(),
      highlightActiveLine(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle),
      yCollab(yText, null, undoManager !== undefined ? { undoManager } : undefined),
      readOnlyCompartmentRef.current.of(EditorState.readOnly.of(Boolean(readOnly))),
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
  }, [yText, undoManager])

  return <div ref={containerRef} className={className} />
}
