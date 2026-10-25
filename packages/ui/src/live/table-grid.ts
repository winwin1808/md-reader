import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { Annotation } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';

/** Doc offsets of a cell's TEXT (trimmed, inside the pipes). */
export interface CellRef {
  row: number;
  col: number;
  from: number;
  to: number;
  /** empty cell with no spare whitespace: insert needs a space on each side */
  pad?: boolean;
}

export const tableEdit = Annotation.define<boolean>();

export function escapeCell(text: string): string {
  return text.replace(/\r?\n|\r/g, ' ').replace(/\|/g, '\\|');
}

export function unescapeCell(text: string): string {
  return text.replace(/\\\|/g, '|');
}

export function cellChange(cell: CellRef, newText: string): { from: number; to: number; insert: string } {
  const t = escapeCell(newText);
  const isEmpty = cell.from === cell.to;
  return { from: cell.from, to: cell.to, insert: isEmpty && cell.pad !== false && t ? ` ${t} ` : t };
}

export function tableCells(state: EditorState, tableFrom: number, tableTo: number): CellRef[][] {
  const tree = ensureSyntaxTree(state, tableTo, 50) ?? syntaxTree(state);
  const rows: CellRef[][] = [];
  tree.iterate({
    from: tableFrom,
    to: tableTo,
    enter: (n) => {
      if (n.name !== 'TableHeader' && n.name !== 'TableRow') return;
      const delims: number[] = [];
      for (let c = n.node.firstChild; c; c = c.nextSibling) if (c.name === 'TableDelimiter') delims.push(c.from);
      const text = state.sliceDoc(n.from, n.to);
      const segs: Array<[number, number]> = [];
      let start = n.from;
      let i = 0;
      if (delims.length && delims[0] === n.from) {
        start = n.from + 1;
        i = 1;
      }
      for (; i < delims.length; i++) {
        segs.push([start, delims[i]!]);
        start = delims[i]! + 1;
      }
      if (start < n.to && text.slice(start - n.from).trim()) segs.push([start, n.to]);
      const row = rows.length;
      rows.push(
        segs.map(([a, b], col) => {
          const raw = state.sliceDoc(a, b);
          const lead = raw.length - raw.trimStart().length;
          if (!raw.trim()) {
            const at = a + Math.min(1, raw.length);
            return { row, col, from: at, to: at, pad: raw.length < 2 };
          }
          return { row, col, from: a + lead, to: b - (raw.length - raw.trimEnd().length) };
        }),
      );
      return false;
    },
  });
  return rows;
}

function findTable(state: EditorState, pos: number): { from: number; to: number } | null {
  let node = (ensureSyntaxTree(state, Math.min(state.doc.length, pos + 1), 50) ?? syntaxTree(state)).resolveInner(pos, 1);
  for (let n: typeof node | null = node; n; n = n.parent) if (n.name === 'Table') return { from: n.from, to: n.to };
  return null;
}

function setEditable(el: HTMLElement) {
  el.setAttribute('contenteditable', 'plaintext-only');
  if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
}

export class TableGridWidget extends WidgetType {
  dom: HTMLElement | null = null;
  constructor(readonly rows: string[][]) {
    super();
  }
  static fromState(state: EditorState, from: number, to: number): TableGridWidget {
    return new TableGridWidget(
      tableCells(state, from, to).map((r) => r.map((c) => unescapeCell(state.sliceDoc(c.from, c.to)))),
    );
  }
  eq(old: TableGridWidget) {
    const same = old.rows.length === this.rows.length && old.rows.every((r, i) => r.length === this.rows[i]!.length);
    if (!same) return false;
    if (old.dom) {
      const cells = old.dom.querySelectorAll<HTMLElement>('[data-r]');
      cells.forEach((c) => {
        const t = this.rows[Number(c.dataset.r)]?.[Number(c.dataset.c)];
        if (t !== undefined && c !== document.activeElement && c.textContent !== t) c.textContent = t;
      });
    }
    return true;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block-table';
    const table = document.createElement('table');
    table.className = 'cm-live-grid';
    const cellEl = (r: number, c: number) =>
      table.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
    this.rows.forEach((row, r) => {
      const tr = document.createElement('tr');
      row.forEach((text, c) => {
        const td = document.createElement(r === 0 ? 'th' : 'td');
        const div = document.createElement('div');
        div.className = 'cm-live-grid-cell';
        div.dataset.r = String(r);
        div.dataset.c = String(c);
        div.textContent = text;
        setEditable(div);
        td.appendChild(div);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    this.dom = wrap;

    const focusCell = (r: number, c: number) => {
      const el = cellEl(r, c);
      if (!el) return false;
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return true;
    };
    const cur = (el: HTMLElement) => ({ r: Number(el.dataset.r), c: Number(el.dataset.c) });

    wrap.addEventListener('input', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
      if (!el) return;
      const t = findTable(view.state, view.posAtDOM(wrap));
      if (!t) return;
      const { r, c } = cur(el);
      const ref = tableCells(view.state, t.from, t.to)[r]?.[c];
      if (!ref) return;
      view.dispatch({
        changes: cellChange(ref, el.textContent ?? ''),
        userEvent: 'input.table',
        annotations: [tableEdit.of(true)],
      });
    });
    wrap.addEventListener('keydown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
      if (!el) return;
      const { r, c } = cur(el);
      const cols = this.rows[0]?.length ?? 0;
      const rowsN = table.rows.length;
      let handled = true;
      if (e.key === 'Tab') {
        let nr = r;
        let nc = c + (e.shiftKey ? -1 : 1);
        if (nc >= cols) [nr, nc] = [r + 1, 0];
        if (nc < 0) [nr, nc] = [r - 1, cols - 1];
        focusCell(nr, nc);
      } else if (e.key === 'Enter') {
        if (r + 1 < rowsN) focusCell(r + 1, c);
      } else if (e.key === 'ArrowDown') {
        if (r + 1 < rowsN) focusCell(r + 1, c);
        else handled = false;
      } else if (e.key === 'ArrowUp') {
        if (r > 0) focusCell(r - 1, c);
        else handled = false;
      } else if (e.key === 'Escape') {
        const t = findTable(view.state, view.posAtDOM(wrap));
        el.blur();
        if (t) view.dispatch({ selection: { anchor: t.to }, scrollIntoView: true });
        view.focus();
      } else handled = false;
      if (handled) e.preventDefault();
    });
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}
