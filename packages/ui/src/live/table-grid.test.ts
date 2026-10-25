import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { cellChange, escapeCell, tableCells } from './table-grid';
import { blockWidgets } from './block-widgets';

const DOC = '| a | b |\n|---|---|\n| 1 |  |';
const mk = (doc: string) => {
  const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
  ensureSyntaxTree(state, doc.length, 5000);
  return state;
};

describe('tableCells', () => {
  it('header + rows, delimiter skipped, empty cell addressable', () => {
    const s = mk(DOC);
    const rows = tableCells(s, 0, DOC.length);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.map((c) => s.sliceDoc(c.from, c.to)))).toEqual([['a', 'b'], ['1', '']]);
  });
  it('cellChange on empty cell', () => {
    const s = mk(DOC);
    const c = tableCells(s, 0, DOC.length)[1]![1]!;
    const ch = cellChange(c, 'x');
    expect(s.update({ changes: ch }).state.doc.toString()).toBe('| a | b |\n|---|---|\n| 1 | x |');
  });
  it('escapeCell', () => {
    expect(escapeCell('a|b')).toBe('a\\|b');
    expect(escapeCell('a\nb')).toBe('a b');
  });
});

describe('TableGridWidget in a view', () => {
  const setup = () => {
    const state = EditorState.create({
      doc: `${DOC}\n\nend`,
      extensions: [markdown({ base: markdownLanguage }), blockWidgets({ table: () => '', math: () => '', mermaid: async () => '' })],
    });
    ensureSyntaxTree(state, state.doc.length, 5000);
    const view = new EditorView({ state, parent: document.body });
    view.setState(EditorState.create({ doc: state.doc.toString(), extensions: state.facet(EditorView.decorations) ? [markdown({ base: markdownLanguage }), blockWidgets({ table: () => '', math: () => '', mermaid: async () => '' })] : [] }));
    return view;
  };
  const cell = (v: EditorView, r: number, c: number) =>
    v.dom.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`)!;

  it('typing changes only that cell and keeps the DOM node', () => {
    const v = setup();
    const el = cell(v, 1, 1);
    const table = v.dom.querySelector('table')!;
    el.textContent = 'x|y';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    expect(v.state.doc.toString()).toBe('| a | b |\n|---|---|\n| 1 | x\\|y |\n\nend');
    expect(v.dom.querySelector('table')).toBe(table);
    expect(cell(v, 1, 1)).toBe(el);
    expect(el.textContent).toBe('x|y');
    el.textContent = 'xz';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    expect(v.state.doc.toString()).toBe('| a | b |\n|---|---|\n| 1 | xz |\n\nend');
  });
  it('Tab moves to next cell', () => {
    const v = setup();
    cell(v, 0, 0).focus();
    cell(v, 0, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(cell(v, 0, 1));
  });
});
