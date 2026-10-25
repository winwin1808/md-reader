import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { computeWidgets } from './widgets';

function mkState(doc: string, cursor: number) {
  const state = EditorState.create({ doc, selection: { anchor: cursor }, extensions: [markdown({ base: markdownLanguage })] });
  ensureSyntaxTree(state, doc.length, 5000);
  return state;
}
function collect(doc: string, cursor: number) {
  const set = computeWidgets(mkState(doc, cursor));
  const out: Array<{ from: number; to: number; dom?: HTMLElement; cls?: string }> = [];
  set.between(0, doc.length, (from, to, v) => {
    const w = (v.spec as { widget?: { toDOM(view: EditorView): HTMLElement } }).widget;
    out.push({ from, to, dom: w?.toDOM({} as EditorView), cls: (v.spec as { class?: string }).class });
  });
  return out;
}

describe('inlineWidgets', () => {
  it('renders safe image', () => {
    const d = '![a](https://x/y.png)\n\nz';
    const imgs = collect(d, d.length).filter((x) => x.dom instanceof HTMLImageElement);
    expect(imgs).toHaveLength(1);
    expect((imgs[0]!.dom as HTMLImageElement).src).toBe('https://x/y.png');
  });
  it('unsafe image shows alt only', () => {
    const d = '![a](javascript:alert(1))\n\nz';
    const r = collect(d, d.length);
    expect(r.some((x) => x.dom instanceof HTMLImageElement)).toBe(false);
    expect(r.some((x) => x.dom?.textContent === 'a')).toBe(true);
  });
  it('checkbox toggles doc', () => {
    const d = '- [ ] t';
    const view = new EditorView({ state: mkState(d, 7), parent: document.body });
    const set = computeWidgets(view.state);
    let input: HTMLInputElement | undefined;
    set.between(0, d.length, (_f, _t, v) => {
      const w = (v.spec as { widget?: { toDOM(v: EditorView): HTMLElement } }).widget;
      if (w) input = w.toDOM(view) as HTMLInputElement;
    });
    expect(input?.type).toBe('checkbox');
    input!.click();
    expect(view.state.doc.toString()).toBe('- [x] t');
    view.destroy();
  });
  it('code fence badge and hidden fences', () => {
    const d = '```ts\nx\n```\n\nz';
    const r = collect(d, d.length);
    expect(r.some((x) => x.dom?.textContent === 'ts')).toBe(true);
    expect(r.some((x) => x.from === 0 && x.to === 5 && !x.dom && !x.cls)).toBe(true);
    expect(r.some((x) => x.from === 8 && x.to === 11)).toBe(true);
  });
  it('alert classes and title', () => {
    const d = '> [!NOTE]\n> a\n\nz';
    const r = collect(d, d.length);
    expect(r.some((x) => x.cls?.includes('cm-live-alert-note'))).toBe(true);
    expect(r.some((x) => x.dom?.textContent === 'Ghi chú')).toBe(true);
  });
});
