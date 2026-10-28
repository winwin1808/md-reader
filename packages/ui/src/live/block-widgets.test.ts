import { describe, expect, it, vi } from 'vitest';
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { blockWidgets } from './block-widgets';
import type { BlockRenderers } from './block-widgets';

function setup(doc: string, cursor: number, r: BlockRenderers) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage }), blockWidgets(r)],
  });
  ensureSyntaxTree(state, doc.length, 5000);
  const view = new EditorView({ state, parent: document.body });
  // re-create after parse so field sees the tree
  view.setState(EditorState.create({ doc, selection: { anchor: cursor }, extensions: state.facet(EditorView.decorations) ? [markdown({ base: markdownLanguage }), blockWidgets(r)] : [] }));
  return view;
}
function widgets(view: EditorView) {
  const out: Array<{ from: number; w: any }> = [];
  for (const set of view.state.facet(EditorView.decorations)) {
    const s = typeof set === 'function' ? set(view) : set;
    s.between(0, view.state.doc.length, (from, _t, v) => { if ((v.spec as any).widget) out.push({ from, w: (v.spec as any).widget }); });
  }
  return out;
}
const fake = (): BlockRenderers => ({
  table: vi.fn(() => '<table></table>'),
  math: vi.fn(() => '<span>m</span>'),
  mermaid: vi.fn(async () => '<svg id="x"></svg>'),
});
const T = '| a |\n|---|\n| 1 |';

describe('blockWidgets', () => {
  it('table widget when cursor outside', () => {
    const r = fake();
    const doc = `${T}\n\nafter`;
    const v = setup(doc, doc.length, r);
    const ws = widgets(v);
    expect(ws).toHaveLength(1);
    expect(ws[0]!.w.toDOM(v).querySelector('table.cm-live-grid')).not.toBeNull();
  });
  it('table stays a grid even when cursor inside', () => {
    expect(widgets(setup(`${T}\n\nafter`, 3, fake()))).toHaveLength(1);
  });
  it('math widget', () => {
    const r = fake();
    const doc = '$$\nx^2\n$$\n\nend';
    const v = setup(doc, doc.length, r);
    const ws = widgets(v);
    expect(ws).toHaveLength(1);
    ws[0]!.w.toDOM(v);
    expect(r.math).toHaveBeenCalledWith('x^2');
  });
  it('mermaid placeholder then svg', async () => {
    const r = fake();
    const doc = '```mermaid\ngraph TD\n```\n\nend';
    const v = setup(doc, doc.length, r);
    const ws = widgets(v);
    expect(ws).toHaveLength(1);
    const el = ws[0]!.w.toDOM(v) as HTMLElement;
    document.body.appendChild(el);
    expect(el.textContent).toContain('Đang vẽ');
    await Promise.resolve(); await Promise.resolve();
    expect(el.querySelector('svg')).not.toBeNull();
  });
  it('eq same source', () => {
    const r = fake();
    const doc = `${T}\n\nafter`;
    const a = widgets(setup(doc, doc.length, r))[0]!.w;
    const b = widgets(setup(doc, doc.length, r))[0]!.w;
    expect(a.eq(b)).toBe(true);
  });
});

describe('math lazy katex', () => {
  it('redraws when katex loads, unsubscribes on destroy', () => {
    let fire: () => void = () => {};
    const unsub = vi.fn();
    let ready = false;
    let html = 'TeX x^2';
    const r: BlockRenderers = {
      ...fake(),
      math: vi.fn(() => `<div>${html}</div>`),
      mathReady: () => ready,
      onMathReady: (cb) => { fire = cb; return unsub; },
    };
    const doc = '$$\nx^2\n$$\n\nend';
    const v = setup(doc, doc.length, r);
    const w = widgets(v)[0]!.w;
    const el = w.toDOM(v) as HTMLElement;
    expect(el.textContent).toBe('TeX x^2');
    ready = true; html = '<span class="katex">k</span>';
    fire();
    expect(el.querySelector('.katex')).not.toBeNull();
    const el2 = w.toDOM(v) as HTMLElement;
    (w as any).destroy(el2);
  });
  it('default renderers draw .katex after the real plugin loads', async () => {
    const { createDefaultRenderers } = await import('./renderers');
    const r = createDefaultRenderers();
    const doc = '$$\nx^2\n$$\n\nend';
    const v = setup(doc, doc.length, r);
    const el = widgets(v)[0]!.w.toDOM(v) as HTMLElement;
    await vi.waitFor(() => expect(el.querySelector('.katex')).not.toBeNull(), { timeout: 5000 });
  });
});
