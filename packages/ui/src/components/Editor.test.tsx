import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as Y from 'yjs'
import type { EditorView } from '@codemirror/view'
import { Editor } from './Editor'

describe('Editor', () => {
  it('renders CodeMirror container with .cm-editor on mount', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('codemirror')
    yText.insert(0, '# Hello World')

    const { container } = render(<Editor yText={yText} />)
    const cmEditor = container.querySelector('.cm-editor')
    expect(cmEditor).not.toBeNull()
  })

  it('synchronizes content between yText and editor', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('codemirror')
    yText.insert(0, 'Initial text')

    let editorView: EditorView | undefined
    render(
      <Editor
        yText={yText}
        onEditorReady={(view) => {
          editorView = view
        }}
      />
    )

    expect(editorView).toBeDefined()
    expect(editorView!.state.doc.toString()).toBe('Initial text')

    // Update yText -> editor state updates
    yText.insert(12, ' added')
    expect(editorView!.state.doc.toString()).toBe('Initial text added')

    // Dispatch edit to editorView -> yText updates
    editorView!.dispatch({
      changes: { from: 0, to: 7, insert: 'Updated' },
    })
    expect(yText.toString()).toBe('Updated text added')
  })

  it('undoManager can undo edits', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('codemirror')
    const undoManager = new Y.UndoManager(yText)

    let editorView: EditorView | undefined
    render(
      <Editor
        yText={yText}
        undoManager={undoManager}
        onEditorReady={(view) => {
          editorView = view
        }}
      />
    )

    expect(editorView).toBeDefined()

    // Perform an edit through CodeMirror view
    editorView!.dispatch({
      changes: { from: 0, insert: 'Hello' },
    })
    expect(yText.toString()).toBe('Hello')

    // Undo via undoManager
    undoManager.undo()
    expect(yText.toString()).toBe('')
    expect(editorView!.state.doc.toString()).toBe('')
  })

  it('destroys view cleanly on unmount', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('codemirror')

    let editorView: EditorView | undefined
    const { unmount } = render(
      <Editor
        yText={yText}
        onEditorReady={(view) => {
          editorView = view
        }}
      />
    )

    expect(editorView).toBeDefined()
    const destroySpy = vi.spyOn(editorView!, 'destroy')

    unmount()
    expect(destroySpy).toHaveBeenCalledTimes(1)
  })

  it('supports readOnly configuration', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('codemirror')

    let editorView: EditorView | undefined
    const { rerender } = render(
      <Editor
        yText={yText}
        readOnly={false}
        onEditorReady={(view) => {
          editorView = view
        }}
      />
    )

    expect(editorView!.state.readOnly).toBe(false)

    rerender(
      <Editor
        yText={yText}
        readOnly={true}
        onEditorReady={(view) => {
          editorView = view
        }}
      />
    )

    expect(editorView!.state.readOnly).toBe(true)
  })

  it('reports onScroll when editor scrolls', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('codemirror')
    const handleScroll = vi.fn()

    let editorView: EditorView | undefined
    render(
      <Editor
        yText={yText}
        onScroll={handleScroll}
        onEditorReady={(view) => {
          editorView = view
        }}
      />
    )

    expect(editorView).toBeDefined()
    editorView!.scrollDOM.dispatchEvent(new Event('scroll'))
    expect(handleScroll).toHaveBeenCalled()
  })
})
