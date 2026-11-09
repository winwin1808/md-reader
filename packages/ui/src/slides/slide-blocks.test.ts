// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { Slide } from '@md-reader/core';
import {
  splitBlockElements,
  pristineBlocks,
  buildPagedSlides,
  splittableChildren,
  groupOversizedChildren,
  cloneWithChildren,
} from './slide-blocks';

function root(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

const source: Slide = {
  id: 's1',
  index: 3,
  rawMarkdown: '# raw',
  html: '<h1>T</h1><p>a</p><p>b</p><p>c</p>',
  notes: ['n1'],
  title: 'T',
};

describe('splitBlockElements', () => {
  it('drops empty elements but keeps hr and img', () => {
    const els = splitBlockElements(root('<p>a</p><p>  </p><hr><div><img src="x.png"></div><div></div>'));
    expect(els.map((e) => e.tagName)).toEqual(['P', 'HR', 'DIV']);
  });

  it('drops the div after a mermaid pre and keeps the pre', () => {
    const els = splitBlockElements(
      root('<pre><code class="language-mermaid">graph TD</code></pre><div data-deck-mermaid>svg drawn</div><p>x</p>'),
    );
    expect(els.map((e) => e.tagName)).toEqual(['PRE', 'P']);
  });

  it('keeps a plain div after a mermaid pre', () => {
    const els = splitBlockElements(
      root('<pre><code class="language-mermaid">g</code></pre><div>real</div>'),
    );
    expect(els.map((e) => e.tagName)).toEqual(['PRE', 'DIV']);
  });

  it('keeps <pre mermaid><p> and adjacent mermaid pres', () => {
    const m = '<pre><code class="language-mermaid">a</code></pre>';
    expect(splitBlockElements(root(m + '<p>after</p>')).map((e) => e.tagName)).toEqual(['PRE', 'P']);
    expect(splitBlockElements(root(m + m)).map((e) => e.tagName)).toEqual(['PRE', 'PRE']);
  });

  it('displayed DOM matches pristineBlocks of the original html', () => {
    const html = '<h1>T</h1><pre><code class="language-mermaid">a</code></pre><p>after</p>';
    const dom = root(html);
    const pre = dom.querySelector('pre') as HTMLElement;
    const added = document.createElement('div');
    added.dataset.deckMermaid = '';
    pre.after(added);
    expect(splitBlockElements(dom).map((e) => e.tagName)).toEqual(pristineBlocks(html).map((e) => e.tagName));
  });
});

describe('pristineBlocks', () => {
  it('carries no style even if the DOM had it', () => {
    const els = pristineBlocks('<p>a</p><p>b</p>');
    expect(els).toHaveLength(2);
    expect(els.every((e) => !e.hasAttribute('style'))).toBe(true);
    expect(els.map((e) => e.outerHTML).join('')).toBe('<p>a</p><p>b</p>');
  });
});

describe('buildPagedSlides', () => {
  const els = () => pristineBlocks(source.html);

  it('single page keeps id and html', () => {
    const out = buildPagedSlides(source, els(), [{ start: 0, end: 4, zoom: 1 }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('s1');
    expect(out[0]!.html).toBe(source.html);
    expect(out[0]!.zoom).toBeUndefined();
  });

  it('single page and empty pages drop inherited zoom', () => {
    const z = { ...source, zoom: 0.7 };
    expect(buildPagedSlides(z, els(), [{ start: 0, end: 4, zoom: 1 }])[0]!.zoom).toBeUndefined();
    expect(buildPagedSlides(z, els(), [])[0]!.zoom).toBeUndefined();
  });

  it('single page adds zoom when < 1', () => {
    const out = buildPagedSlides(source, els(), [{ start: 0, end: 4, zoom: 0.8 }]);
    expect(out[0]!.zoom).toBe(0.8);
  });

  it('multi page: ids, part, slicing, notes/title only first, zoom only < 1', () => {
    const out = buildPagedSlides(source, els(), [
      { start: 0, end: 2, zoom: 1 },
      { start: 2, end: 4, zoom: 0.9 },
    ]);
    expect(out.map((s) => s.id)).toEqual(['s1-p0', 's1-p1']);
    expect(out.map((s) => s.part)).toEqual([
      { index: 0, total: 2 },
      { index: 1, total: 2 },
    ]);
    expect(out[0]!.html).toBe('<h1>T</h1><p>a</p>');
    expect(out[1]!.html).toBe('<p>b</p><p>c</p>');
    expect(out[0]!.notes).toEqual(['n1']);
    expect(out[0]!.title).toBe('T');
    expect(out[1]!.notes).toEqual([]);
    expect(out[1]!.title).toBeUndefined();
    expect(out[0]!.zoom).toBeUndefined();
    expect(out[1]!.zoom).toBe(0.9);
    expect(out.every((s) => s.rawMarkdown === '# raw' && s.index === 3)).toBe(true);
    expect(out.map((s) => s.html).join('')).toBe(source.html);
  });
});

function el(html: string): HTMLElement {
  return root(html).firstElementChild as HTMLElement;
}
const TABLE =
  '<table><caption>Cap</caption><thead><tr><th>H</th></tr></thead><tbody><tr><td>1</td></tr><tr><td>2</td></tr><tr><td>3</td></tr></tbody></table>';

describe('splittableChildren', () => {
  it('returns li for lists, tbody tr for tables, [] otherwise', () => {
    expect(splittableChildren(el('<ul><li>a</li><li>b<ul><li>n</li></ul></li></ul>')).length).toBe(2);
    expect(splittableChildren(el(TABLE)).map((r) => r.tagName)).toEqual(['TR', 'TR', 'TR']);
    expect(splittableChildren(el('<p>x</p>'))).toEqual([]);
  });
});

describe('groupOversizedChildren', () => {
  const ul = '<ul><li>a</li><li>b</li><li>c</li><li>d</li></ul>';
  it('groups greedily within budget', () => {
    expect(groupOversizedChildren(el(ul), 100, () => 40)).toEqual([[0, 1], [2, 3]]);
  });
  it('subtracts the thead height for tables', () => {
    const m = (c: HTMLElement) => (c.tagName === 'THEAD' ? 50 : 40);
    expect(groupOversizedChildren(el(TABLE), 100, m)).toEqual([[0], [1], [2]]);
  });
  it('puts an oversized child in its own group', () => {
    const heights = [10, 500, 10, 10];
    const m = (c: HTMLElement) => heights[Array.from(c.parentElement!.children).indexOf(c)] ?? 0;
    expect(groupOversizedChildren(el(ul), 100, m)).toEqual([[0], [1], [2, 3]]);
  });
  it('returns null when not splittable or only one group', () => {
    expect(groupOversizedChildren(el('<p>x</p>'), 100, () => 1)).toBeNull();
    expect(groupOversizedChildren(el('<ul><li>a</li></ul>'), 100, () => 1)).toBeNull();
    expect(groupOversizedChildren(el(ul), 1000, () => 10)).toBeNull();
  });
});

describe('cloneWithChildren', () => {
  it('sets OL start from original start plus first index', () => {
    const o = el('<ol start="5"><li>a</li><li>b</li><li>c</li><li>d</li></ol>');
    const c = cloneWithChildren(o, [3 - 1 + 0, 3]);
    expect(c.getAttribute('start')).toBe('7');
    const c2 = cloneWithChildren(o, [3]);
    expect(c2.getAttribute('start')).toBe('8');
    expect(c2.querySelectorAll('li').length).toBe(1);
  });
  it('does not set start when result is 1 and UL has none', () => {
    expect(cloneWithChildren(el('<ol><li>a</li><li>b</li></ol>'), [0]).hasAttribute('start')).toBe(false);
    expect(cloneWithChildren(el('<ul><li>a</li><li>b</li></ul>'), [1]).hasAttribute('start')).toBe(false);
  });
  it('keeps caption and thead in every table part', () => {
    const t = el(TABLE);
    for (const g of [[0], [1, 2]]) {
      const c = cloneWithChildren(t, g);
      expect(c.querySelector('caption')?.textContent).toBe('Cap');
      expect(c.querySelector('thead')).not.toBeNull();
      expect(c.querySelectorAll('tbody tr').length).toBe(g.length);
    }
  });
  it('keeps nested lists whole and leaves the original untouched', () => {
    const o = el('<ul><li>a<ul><li>n1</li><li>n2</li></ul></li><li>b</li></ul>');
    const before = o.outerHTML;
    const c = cloneWithChildren(o, [0]);
    expect(c.children.length).toBe(1);
    expect(c.querySelectorAll('li').length).toBe(3);
    expect(o.outerHTML).toBe(before);
  });
});
