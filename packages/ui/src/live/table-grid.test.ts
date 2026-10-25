import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { cellChange, escapeCell, tableCells } from './table-grid';
import { blockWidgets } from './block-widgets';
import { insertRow, deleteRow, insertColumn, deleteColumn } from './table-ops';

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

const T = '| a | b |\n|:--|--:|\n| 1 | 2 |';
describe('table-ops', () => {
  it('insertRow', () => {
    expect(insertRow(T, 1)).toBe('| a | b |\n| :-- | --: |\n| 1 | 2 |\n|  |  |');
    expect(insertRow(T, 0)).toBe('| a | b |\n| :-- | --: |\n|  |  |\n| 1 | 2 |');
  });
  it('deleteRow protects header', () => {
    expect(deleteRow(T, 0)).toBe(T);
    expect(deleteRow(T, 1)).toBe('| a | b |\n| :-- | --: |');
  });
  it('insertColumn keeps alignment', () => {
    expect(insertColumn(T, 0)).toBe('| a |  | b |\n| :-- | --- | --: |\n| 1 |  | 2 |'.replace('| a |  | b |', '| a |  | b |'));
  });
  it('deleteColumn protects last', () => {
    expect(deleteColumn(T, 0)).toBe('| b |\n| --: |\n| 2 |');
    expect(deleteColumn('| a |\n|---|\n| 1 |', 0)).toBe('| a |\n|---|\n| 1 |');
  });
});

describe('table tools widget', () => {
  const mkView = (doc: string) => {
    const ext = [markdown({ base: markdownLanguage }), blockWidgets({ table: () => '', math: () => '', mermaid: async () => '' })];
    const state = EditorState.create({ doc, extensions: ext });
    ensureSyntaxTree(state, doc.length, 5000);
    return new EditorView({ state, parent: document.body });
  };
  const btn = (v: EditorView, label: string) =>
    [...v.dom.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(label))!;
  const cell = (v: EditorView, r: number, c: number) =>
    v.dom.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`)!;

  it('Thêm dòng adds a body row', () => {
    const v = mkView('| a | b |\n|---|---|\n| 1 | 2 |\n\nend');
    cell(v, 1, 0).focus();
    btn(v, 'Thêm dòng').click();
    expect(v.state.doc.toString().split('\n').slice(0, 4)).toEqual(['| a | b |', '| --- | --- |', '| 1 | 2 |', '|  |  |']);
    v.destroy();
  });
  it('Enter on last row adds a row and focuses it', () => {
    const v = mkView('| a | b |\n|---|---|\n| 1 | 2 |\n\nend');
    const el = cell(v, 1, 0);
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(v.state.doc.lines).toBe(6);
    expect(document.activeElement).toBe(cell(v, 2, 0));
    v.destroy();
  });
  it('renders inline when unfocused, raw when focused', () => {
    const v = mkView('| a | **b** |\n|---|---|\n| 1 | 2 |');
    const el = cell(v, 0, 1);
    expect(el.innerHTML).toContain('<strong>b</strong>');
    el.focus();
    expect(el.textContent).toBe('**b**');
    el.blur();
    expect(el.innerHTML).toContain('<strong>b</strong>');
    v.destroy();
  });
  it('Sửa mã bảng shows raw until selection leaves', () => {
    const v = mkView('| a | b |\n|---|---|\n| 1 | 2 |\n\nend');
    btn(v, 'Sửa mã bảng').click();
    expect(v.dom.querySelector('table')).toBeNull();
    expect(v.dom.textContent).toContain('| a | b |');
    v.dispatch({ selection: { anchor: v.state.doc.length } });
    expect(v.dom.querySelector('table')).not.toBeNull();
    v.destroy();
  });
});
