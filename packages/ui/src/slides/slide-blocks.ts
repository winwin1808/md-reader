import type { Slide, SlidePage } from '@md-reader/core';

const MEDIA_SELECTOR = 'img, svg, video, canvas, hr, table';

function isEmpty(el: HTMLElement): boolean {
  if (el.tagName === 'HR') return false;
  if ((el.textContent ?? '').trim() !== '') return false;
  return el.querySelector(MEDIA_SELECTOR) === null;
}

function isMermaidPre(el: Element | null): boolean {
  return !!el && el.tagName === 'PRE' && el.querySelector('code.language-mermaid') !== null;
}

export function splitBlockElements(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const child of Array.from(root.children) as HTMLElement[]) {
    if (isMermaidPre(child.previousElementSibling)) continue;
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
