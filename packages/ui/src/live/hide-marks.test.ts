import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { computeDecorations } from './hide-marks';

function run(doc: string, cursor: number) {
  const state = EditorState.create({ doc, selection: { anchor: cursor }, extensions: [markdown({ base: markdownLanguage })] });
  ensureSyntaxTree(state, doc.length, 5000);
  const hidden: Array<[number, number]> = [];
  const lineCls: Record<number, string> = {};
  const set = computeDecorations(state);
  set.between(0, doc.length, (from, to, v) => {
    const spec = v.spec as { class?: string };
    if (to > from && !spec.class) hidden.push([from, to]);
    if (to === from && spec.class) lineCls[from] = spec.class;
  });
  return { hidden, lineCls };
}

describe('hideMarks', () => {
  it('hides ** off-cursor', () => {
    expect(run('**a** b', 7).hidden).toEqual([[0, 2], [3, 5]]);
  });
  it('reveals when cursor inside', () => {
    expect(run('**a** b', 3).hidden).toEqual([]);
  });
  it('hides heading mark and classes line', () => {
    const r = run('# T\nx', 5);
    expect(r.hidden).toEqual([[0, 2]]);
    expect(r.lineCls[0]).toContain('cm-live-h1');
  });
  it('link shows only text', () => {
    const h = run('[t](http://u) z', 15).hidden;
    const covered = new Set<number>();
    h.forEach(([a, b]) => { for (let i = a; i < b; i++) covered.add(i); });
    expect([...Array(13).keys()].filter((i) => !covered.has(i))).toEqual([1]);
  });
  it('hides backticks', () => {
    expect(run('`c` x', 5).hidden).toEqual([[0, 1], [2, 3]]);
  });
  it('does not hide the brackets of an alert tag link', () => {
    const doc = '> [!NOTE]\n> body\n\nz';
    expect(run(doc, doc.length).hidden.filter(([f]) => f >= 2 && f < 10)).toEqual([]);
  });
});
