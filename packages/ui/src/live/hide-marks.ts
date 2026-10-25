import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension, Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

const INLINE = new Set(['Emphasis', 'StrongEmphasis', 'InlineCode', 'Link', 'Image', 'Strikethrough']);
const MARKS = new Set(['EmphasisMark', 'StrikethroughMark', 'HeaderMark', 'QuoteMark', 'LinkMark']);

export function revealRanges(state: EditorState): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  const tree = syntaxTree(state);
  for (const r of state.selection.ranges) {
    for (const pos of new Set([r.from, r.to])) {
      for (const side of [-1, 1] as const) {
        for (let n: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, side); n; n = n.parent) {
          if (INLINE.has(n.name)) out.push({ from: n.from, to: n.to });
          else if (/^(ATX|Setext)Heading\d?$/.test(n.name) || n.name === 'Blockquote') {
            const a = state.doc.lineAt(Math.max(n.from, Math.min(r.from, n.to)));
            const b = state.doc.lineAt(Math.max(n.from, Math.min(r.to, n.to)));
            out.push({ from: a.from, to: b.to });
          }
        }
      }
    }
  }
  return out;
}

const hidden = Decoration.replace({});
const mk = (c: string) => Decoration.mark({ class: c });
const ln = (c: string) => Decoration.line({ class: c });

export function computeDecorations(state: EditorState, ranges?: Array<{ from: number; to: number }>): DecorationSet {
  const reveal = revealRanges(state);
  const inReveal = (from: number, to: number) => reveal.some((r) => from <= r.to && to >= r.from);
  const decos: Range<Decoration>[] = [];
  const doc = state.doc;
  const lines = (from: number, to: number, cls: string) => {
    for (let l = doc.lineAt(from); ; l = doc.line(l.number + 1)) {
      decos.push(ln(cls).range(l.from));
      if (l.to >= to || l.number >= doc.lines) break;
    }
  };
  const hide = (from: number, to: number) => {
    if (to > from && !inReveal(from, to)) decos.push(hidden.range(from, to));
  };
  for (const vr of ranges ?? [{ from: 0, to: doc.length }]) {
    syntaxTree(state).iterate({
      from: vr.from,
      to: vr.to,
      enter: (node) => {
        const name = node.name;
        const h = /^ATXHeading([1-6])$/.exec(name);
        if (h) lines(node.from, node.to, `cm-live-h${h[1]}`);
        else if (name === 'Blockquote') lines(node.from, node.to, 'cm-live-quote');
        else if (name === 'ListItem') lines(node.from, node.to, 'cm-live-li');
        else if (name === 'FencedCode') lines(node.from, node.to, 'cm-live-code');
        else if (name === 'StrongEmphasis') decos.push(mk('cm-live-strong').range(node.from, node.to));
        else if (name === 'Emphasis') decos.push(mk('cm-live-em').range(node.from, node.to));
        else if (name === 'InlineCode') decos.push(mk('cm-live-icode').range(node.from, node.to));
        else if (name === 'Strikethrough') decos.push(mk('cm-live-del').range(node.from, node.to));
        else if (name === 'Link') {
          const first = node.node.firstChild;
          const closing = node.node.getChildren('LinkMark')[1];
          if (first && closing && closing.from > first.to) {
            decos.push(mk('cm-live-link').range(first.to, closing.from));
          }
        } else if (name === 'CodeMark') {
          if (node.node.parent?.name === 'InlineCode') hide(node.from, node.to);
        } else if (MARKS.has(name)) {
          if (name === 'LinkMark') {
            if (node.node.parent?.name === 'Link') hide(node.from, node.to);
          } else {
            let to = node.to;
            if ((name === 'HeaderMark' || name === 'QuoteMark') && doc.sliceString(to, to + 1) === ' ') to += 1;
            if (name !== 'HeaderMark' || node.node.parent?.name?.startsWith('ATX')) hide(node.from, to);
          }
        } else if (name === 'URL' || name === 'LinkTitle') {
          if (node.node.parent?.name === 'Link') hide(node.from, node.to);
        }
      },
    });
  }
  return Decoration.set(decos, true);
}

export function hideMarks(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = computeDecorations(view.state, view.visibleRanges as { from: number; to: number }[]);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged) {
          this.decorations = computeDecorations(u.state, u.view.visibleRanges as { from: number; to: number }[]);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
