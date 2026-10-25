import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension, Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { revealRanges } from './hide-marks';

const SAFE_SRC = /^(https?:|data:image\/|blob:)/i;
const ALERT_TITLES: Record<string, string> = {
  note: 'Ghi chú',
  tip: 'Mẹo',
  important: 'Quan trọng',
  warning: 'Cảnh báo',
  caution: 'Thận trọng',
};

export class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) {
    super();
  }
  eq(o: ImageWidget) {
    return o.src === this.src && o.alt === this.alt;
  }
  toDOM() {
    if (!SAFE_SRC.test(this.src)) {
      const s = document.createElement('span');
      s.className = 'cm-live-img-alt';
      s.textContent = this.alt;
      return s;
    }
    const img = document.createElement('img');
    img.className = 'cm-live-img';
    img.src = this.src;
    img.alt = this.alt;
    img.loading = 'lazy';
    img.style.maxWidth = '100%';
    return img;
  }
}

class TextWidget extends WidgetType {
  constructor(readonly tag: string, readonly cls: string, readonly text: string) {
    super();
  }
  eq(o: TextWidget) {
    return o.tag === this.tag && o.cls === this.cls && o.text === this.text;
  }
  toDOM() {
    const e = document.createElement(this.tag);
    e.className = this.cls;
    e.textContent = this.text;
    return e;
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) {
    super();
  }
  eq(o: CheckboxWidget) {
    return o.checked === this.checked && o.pos === this.pos;
  }
  toDOM(view: EditorView) {
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.className = 'cm-live-task';
    i.checked = this.checked;
    i.addEventListener('mousedown', (e) => e.preventDefault());
    i.addEventListener('click', (e) => {
      e.preventDefault();
      const at = this.pos + 1;
      const cur = view.state.doc.sliceString(at, at + 1);
      view.dispatch({
        changes: { from: at, to: at + 1, insert: cur === ' ' ? 'x' : ' ' },
        userEvent: 'input.toggle',
      });
    });
    return i;
  }
  ignoreEvent() {
    return false;
  }
}

const hidden = Decoration.replace({});
const ln = (c: string) => Decoration.line({ class: c });

export function computeWidgets(state: EditorState, ranges?: Array<{ from: number; to: number }>): DecorationSet {
  const reveal = revealRanges(state);
  const doc = state.doc;
  const inReveal = (from: number, to: number) => reveal.some((r) => from <= r.to && to >= r.from);
  const touchesSel = (from: number, to: number) => state.selection.ranges.some((r) => r.from <= to && r.to >= from);
  const decos: Range<Decoration>[] = [];
  for (const vr of ranges ?? [{ from: 0, to: doc.length }]) {
    syntaxTree(state).iterate({
      from: vr.from,
      to: vr.to,
      enter: (node) => {
        const { name, from, to } = node;
        if (name === 'Image') {
          if (inReveal(from, to)) return;
          const text = doc.sliceString(from, to);
          const m = /^!\[([^\]]*)\]/.exec(text);
          const url = node.node.getChild('URL');
          const src = url ? doc.sliceString(url.from, url.to) : '';
          decos.push(Decoration.replace({ widget: new ImageWidget(src, m ? (m[1] ?? '') : '') }).range(from, to));
        } else if (name === 'ListMark') {
          const t = doc.sliceString(from, to);
          if (t !== '-' && t !== '*' && t !== '+') return;
          if (touchesSel(from, to)) return;
          if (/^\s\[[ xX]\]/.test(doc.sliceString(to, to + 4))) return;
          decos.push(Decoration.replace({ widget: new TextWidget('span', 'cm-live-bullet', '\u2022') }).range(from, to));
        } else if (name === 'HorizontalRule') {
          if (touchesSel(from, to)) return;
          decos.push(Decoration.replace({ widget: new TextWidget('hr', 'cm-live-hr', '') }).range(from, to));
        } else if (name === 'TaskMarker') {
          if (touchesSel(from, to)) return;
          const checked = /x/i.test(doc.sliceString(from, to));
          decos.push(Decoration.replace({ widget: new CheckboxWidget(checked, from) }).range(from, to));
        } else if (name === 'FencedCode') {
          const first = doc.lineAt(from);
          const last = doc.lineAt(to);
          decos.push(ln('cm-live-fence-open').range(first.from));
          const info = node.node.getChild('CodeInfo');
          const lang = info ? doc.sliceString(info.from, info.to).trim() : '';
          const openRevealed = touchesSel(first.from, first.to);
          if (lang) {
            if (!openRevealed) {
              decos.push(hidden.range(first.from, first.to));
            }
            decos.push(
              Decoration.widget({ widget: new TextWidget('span', 'cm-live-lang', lang), side: 1 }).range(first.to),
            );
          } else if (!openRevealed && first.to > first.from) {
            decos.push(hidden.range(first.from, first.to));
          }
          if (last.number !== first.number && /^\s*(```|~~~)/.test(last.text)) {
            decos.push(ln('cm-live-fence-close').range(last.from));
            if (!touchesSel(last.from, last.to) && last.to > last.from) decos.push(hidden.range(last.from, last.to));
          }
        } else if (name === 'Blockquote') {
          const first = doc.lineAt(from);
          const m = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(first.text);
          if (!m) return;
          const type = (m[1] ?? 'note').toLowerCase();
          for (let l = first; ; l = doc.line(l.number + 1)) {
            decos.push(ln(`cm-live-alert cm-live-alert-${type}`).range(l.from));
            if (l.to >= to || l.number >= doc.lines) break;
          }
          const tagFrom = first.from + first.text.indexOf('[!');
          const tagTo = first.from + m[0].length;
          if (!inReveal(first.from, first.to)) {
            decos.push(
              Decoration.replace({ widget: new TextWidget('span', 'cm-live-alert-title', ALERT_TITLES[type] ?? '') }).range(
                tagFrom,
                tagTo,
              ),
            );
          }
        }
      },
    });
  }
  return Decoration.set(decos, true);
}

export function inlineWidgets(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = computeWidgets(view.state, view.visibleRanges as { from: number; to: number }[]);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged) {
          this.decorations = computeWidgets(u.state, u.view.visibleRanges as { from: number; to: number }[]);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
