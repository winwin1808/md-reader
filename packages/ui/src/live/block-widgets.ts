import { syntaxTree } from '@codemirror/language';
import { EditorState, StateField } from '@codemirror/state';
import type { Extension, Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { TableGridWidget } from './table-grid';

export interface BlockRenderers {
  table(src: string): string;
  math(tex: string): string;
  mermaid(code: string, theme: 'default' | 'dark'): Promise<string>;
}

type Kind = 'table' | 'math' | 'mermaid';

class BlockWidget extends WidgetType {
  constructor(
    readonly kind: Kind,
    readonly src: string,
    readonly from: number,
    readonly r: BlockRenderers,
    readonly theme: 'default' | 'dark',
  ) {
    super();
  }
  eq(o: BlockWidget) {
    return o.kind === this.kind && o.src === this.src && o.theme === this.theme;
  }
  toDOM(view: EditorView) {
    const el = document.createElement('div');
    el.className = `cm-live-block cm-live-block-${this.kind}`;
    if (this.kind === 'math') el.innerHTML = this.r.math(this.src);
    else {
      el.textContent = 'Đang vẽ sơ đồ…';
      this.r.mermaid(this.src, this.theme).then(
        (svg) => {
          if (el.isConnected) el.innerHTML = svg;
        },
        () => {
          const pre = document.createElement('pre');
          pre.textContent = this.src;
          el.replaceChildren(pre);
        },
      );
    }
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true });
      view.focus();
    });
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

function build(state: EditorState, r: BlockRenderers, theme: 'default' | 'dark'): DecorationSet {
  const out: Range<Decoration>[] = [];
  const sel = state.selection.ranges;
  const touched = (from: number, to: number) => sel.some((s) => s.from <= to && s.to >= from);
  const add = (kind: Kind, from: number, to: number, src: string) => {
    if (kind === 'table') {
      out.push(Decoration.replace({ block: true, widget: TableGridWidget.fromState(state, from, to) }).range(from, to));
      return;
    }
    if (touched(from, to)) return;
    out.push(
      Decoration.replace({ block: true, widget: new BlockWidget(kind, src, from, r, theme) }).range(from, to),
    );
  };
  const skip: Array<[number, number]> = [];
  syntaxTree(state).iterate({
    enter: (n) => {
      if (n.name === 'Table') {
        add('table', n.from, n.to, state.sliceDoc(n.from, n.to));
      } else if (n.name === 'FencedCode') {
        skip.push([n.from, n.to]);
        const info = n.node.getChild('CodeInfo');
        if (info && state.sliceDoc(info.from, info.to).trim() === 'mermaid') {
          const text = n.node.getChild('CodeText');
          add('mermaid', n.from, n.to, text ? state.sliceDoc(text.from, text.to) : '');
        }
      }
    },
  });
  const doc = state.doc;
  for (let i = 1; i <= doc.lines; i++) {
    const open = doc.line(i);
    if (open.text.trim() !== '$$') continue;
    if (skip.some(([a, b]) => open.from >= a && open.from <= b)) continue;
    let j = i + 1;
    while (j <= doc.lines && doc.line(j).text.trim() !== '$$') j++;
    if (j > doc.lines) break;
    const close = doc.line(j);
    const tex = j > i + 1 ? doc.sliceString(doc.line(i + 1).from, doc.line(j - 1).to) : '';
    add('math', open.from, close.to, tex);
    i = j;
  }
  return Decoration.set(out, true);
}

export function blockWidgets(r: BlockRenderers, opts?: { theme?: () => 'default' | 'dark' }): Extension {
  const theme = () => opts?.theme?.() ?? 'default';
  return StateField.define<DecorationSet>({
    create: (state) => build(state, r, theme()),
    update: (deco, tr) => (tr.docChanged || tr.selection ? build(tr.state, r, theme()) : deco),
    provide: (f) => EditorView.decorations.from(f),
  });
}
