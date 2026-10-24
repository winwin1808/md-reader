import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as Y from 'yjs'
import type { EditorView } from '@codemirror/view'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Editor, lereSachHighlight } from './Editor'

// jsdom lacks layout APIs CodeMirror's scroll-into-view measurement uses
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}

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

  it('populates and clears editorViewRef on mount and unmount', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('codemirror')
    const ref = { current: null as EditorView | null }

    const { unmount } = render(<Editor yText={yText} editorViewRef={ref} />)
    expect(ref.current).not.toBeNull()

    unmount()
    expect(ref.current).toBeNull()
  })

  function keydown(view: EditorView, key: string) {
    const ev = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true })
    view.contentDOM.dispatchEvent(ev)
  }

  it('Mod-b wraps selection in ** via transaction and Mod-z undoes it', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('source')
    yText.insert(0, 'hello world')
    const undoManager = new Y.UndoManager(yText)
    let view: EditorView | undefined
    render(<Editor yText={yText} undoManager={undoManager} onEditorReady={(v) => { view = v }} />)
    view!.dispatch({ selection: { anchor: 0, head: 5 } })
    keydown(view!, 'b')
    expect(yText.toString()).toBe('**hello** world')
    keydown(view!, 'z')
    expect(yText.toString()).toBe('hello world')
  })

  it('Mod-i and Mod-k wrap selection', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('source')
    yText.insert(0, 'abc')
    let view: EditorView | undefined
    render(<Editor yText={yText} onEditorReady={(v) => { view = v }} />)
    view!.dispatch({ selection: { anchor: 0, head: 3 } })
    keydown(view!, 'i')
    expect(yText.toString()).toBe('*abc*')
    view!.dispatch({ selection: { anchor: 1, head: 4 } })
    keydown(view!, 'k')
    expect(yText.toString()).toBe('*[abc](url)*')
  })

  it('exports lereSachHighlight using CSS variables and editor.css has no .tok- rules', () => {
    expect(lereSachHighlight).toBeDefined()
    expect(lereSachHighlight.module).toBeTruthy()
    const css = readFileSync(resolve(process.cwd(), 'src/theme/editor.css'), 'utf8')
    expect(css).not.toContain('.tok-')
  })

  it('mounts with awareness and typing still updates yText', () => {
    const ydoc = new Y.Doc()
    const yText = ydoc.getText('codemirror')
    yText.insert(0, 'abc')
    const listeners = new Map<string, Set<(...a: unknown[]) => void>>()
    const states = new Map<number, Record<string, unknown>>()
    states.set(1, { user: { name: 'An', color: '#f00', colorLight: '#f003' }, cursor: { anchor: Y.createRelativePositionFromTypeIndex(yText, 1), head: Y.createRelativePositionFromTypeIndex(yText, 2) } })
    const awareness = {
      doc: ydoc,
      clientID: 2,
      states,
      getLocalState: () => states.get(2) ?? null,
      setLocalState: (st: Record<string, unknown> | null) => { if (st) states.set(2, st); else states.delete(2) },
      setLocalStateField: (k: string, v: unknown) => { states.set(2, { ...(states.get(2) ?? {}), [k]: v }) },
      getStates: () => states,
      on: (n: string, f: (...a: unknown[]) => void) => { (listeners.get(n) ?? listeners.set(n, new Set()).get(n)!).add(f) },
      off: (n: string, f: (...a: unknown[]) => void) => { listeners.get(n)?.delete(f) },
    }
    let view: EditorView | undefined
    const { container } = render(
      <Editor yText={yText} awareness={awareness as never} onEditorReady={(v) => { view = v }} />
    )
    expect(container.querySelector('.cm-editor')).not.toBeNull()
    view!.dispatch({ changes: { from: 3, insert: 'd' } })
    expect(yText.toString()).toBe('abcd')
  })
})
