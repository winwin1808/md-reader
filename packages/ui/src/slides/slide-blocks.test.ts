// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { Slide } from '@md-reader/core';
import { splitBlockElements, pristineBlocks, buildPagedSlides } from './slide-blocks';

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
