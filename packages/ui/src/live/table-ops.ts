/** Pure text ops on a GFM table's source. Grid row 0 = header; delimiter line is not a row. */

function splitCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '\\|';
      i++;
    } else if (s[i] === '|') {
      out.push(cur.trim());
      cur = '';
    } else cur += s[i];
  }
  out.push(cur.trim());
  return out;
}

const join = (cells: string[]) => `| ${cells.join(' | ')} |`;

function parse(src: string): string[][] {
  return src.split('\n').map(splitCells);
}
const emit = (rows: string[][]) => rows.map((r) => join(r)).join('\n');
const lineOf = (row: number) => (row === 0 ? 0 : row + 1);

export function insertRow(src: string, afterRow: number): string {
  const rows = parse(src);
  const cols = rows[0]!.length;
  const at = Math.max(0, Math.min(afterRow, rows.length - 2));
  rows.splice(lineOf(at) + 1 + (at === 0 ? 1 : 0), 0, Array.from({ length: cols }, () => ''));
  return emit(rows);
}

export function deleteRow(src: string, row: number): string {
  const rows = parse(src);
  if (row <= 0 || row >= rows.length - 1) return src;
  rows.splice(lineOf(row), 1);
  return emit(rows);
}

export function insertColumn(src: string, afterCol: number): string {
  const rows = parse(src);
  const at = Math.max(-1, Math.min(afterCol, rows[0]!.length - 1)) + 1;
  rows.forEach((r, i) => r.splice(at, 0, i === 1 ? '---' : ''));
  return emit(rows);
}

export function deleteColumn(src: string, col: number): string {
  const rows = parse(src);
  if (rows[0]!.length <= 1 || col < 0 || col >= rows[0]!.length) return src;
  rows.forEach((r) => r.splice(col, 1));
  return emit(rows);
}
