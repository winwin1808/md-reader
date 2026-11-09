import type { Slide, SlidePage } from '@md-reader/core';

const MEDIA_SELECTOR = 'img, svg, video, canvas, hr, table';

function isEmpty(el: HTMLElement): boolean {
  if (el.tagName === 'HR') return false;
  if ((el.textContent ?? '').trim() !== '') return false;
  return el.querySelector(MEDIA_SELECTOR) === null;
}

export function splitBlockElements(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const child of Array.from(root.children) as HTMLElement[]) {
    if (child.hasAttribute('data-deck-mermaid')) continue;
    if (isEmpty(child)) continue;
    out.push(child);
  }
  return out;
}

export function pristineBlocks(html: string): HTMLElement[] {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const wrapper = document.createElement('div');
  wrapper.appendChild(tpl.content);
  return splitBlockElements(wrapper);
}

export function buildPagedSlides(source: Slide, elements: HTMLElement[], pages: SlidePage[]): Slide[] {
  if (pages.length <= 1) {
    const one: Slide = { ...source };
    if (pages[0] && pages[0].zoom < 1) one.zoom = pages[0].zoom;
    else delete one.zoom;
    return [one];
  }
  return pages.map((p, i) => {
    const slide: Slide = {
      ...source,
      id: `${source.id}-p${i}`,
      html: elements
        .slice(p.start, p.end)
        .map((e) => e.outerHTML)
        .join(''),
      part: { index: i, total: pages.length },
      notes: i === 0 ? source.notes : [],
    };
    if (i > 0) delete slide.title;
    if (p.zoom < 1) slide.zoom = p.zoom;
    else delete slide.zoom;
    return slide;
  });
}

function directChildren(el: HTMLElement, tag?: string): HTMLElement[] {
  const kids = Array.from(el.children) as HTMLElement[];
  return tag ? kids.filter((c) => c.tagName === tag) : kids;
}

function tableBody(el: HTMLElement): HTMLElement | null {
  if (directChildren(el, 'TFOOT').length > 0) return null;
  const bodies = directChildren(el, 'TBODY');
  return bodies.length === 1 ? (bodies[0] as HTMLElement) : null;
}

export function splittableChildren(el: HTMLElement): HTMLElement[] {
  if (el.tagName === 'UL' || el.tagName === 'OL') return directChildren(el, 'LI');
  if (el.tagName === 'TABLE') {
    const tbody = tableBody(el);
    return tbody ? directChildren(tbody, 'TR') : [];
  }
  return [];
}

export function groupOversizedChildren(
  el: HTMLElement,
  budget: number,
  measureChild: (c: HTMLElement, next: HTMLElement | null) => number,
): number[][] | null {
  if (budget <= 0) return null;
  const kids = splittableChildren(el);
  if (kids.length < 2) return null;
  const groups: number[][] = [];
  let cur: number[] = [];
  let sum = 0;
  kids.forEach((k, i) => {
    const h = measureChild(k, kids[i + 1] ?? null);
    if (cur.length > 0 && sum + h > budget) {
      groups.push(cur);
      cur = [];
      sum = 0;
    }
    cur.push(i);
    sum += h;
  });
  if (cur.length > 0) groups.push(cur);
  return groups.length < 2 ? null : groups;
}

export function cloneWithChildren(el: HTMLElement, group: number[]): HTMLElement {
  const out = el.cloneNode(false) as HTMLElement;
  const kids = splittableChildren(el);
  const picked = group.map((i) => (kids[i] as HTMLElement).cloneNode(true) as HTMLElement);
  if (el.tagName === 'TABLE') {
    for (const tag of ['CAPTION', 'COLGROUP', 'THEAD']) {
      for (const n of directChildren(el, tag)) out.appendChild(n.cloneNode(true));
    }
    const tbody = (tableBody(el) as HTMLElement).cloneNode(false);
    picked.forEach((r) => tbody.appendChild(r));
    out.appendChild(tbody);
    return out;
  }
  picked.forEach((c) => out.appendChild(c));
  if (el.tagName === 'OL') {
    const parsed = parseInt(el.getAttribute('start') ?? '', 10);
    const base = Number.isNaN(parsed) ? 1 : parsed;
    const start = base + (group[0] ?? 0);
    if (start === 1) out.removeAttribute('start');
    else out.setAttribute('start', String(start));
  }
  return out;
}
