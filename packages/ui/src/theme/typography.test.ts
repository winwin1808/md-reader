import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('typography.css proportional font scaling', () => {
  const css = fs.readFileSync(path.resolve(__dirname, './typography.css'), 'utf-8');

  it('multiplies .md-viewer font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s*\{[^}]*font-size:\s*calc\(var\(--body-size\)\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('keeps the scale ratio on every rem/px font-size', () => {
    const sizes = css.match(/font-size:\s*[^;]*(?:rem|px)[^;]*;/g) ?? [];
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toContain('--md-font-scale-ratio');
  });

  it('uses the Literata body, measure and token fonts', () => {
    expect(css).toMatch(/\.md-viewer\s*\{[^}]*var\(--font-body\)/);
    expect(css).toMatch(/\.md-viewer\s*\{[^}]*var\(--body-size\)/);
    expect(css).toMatch(/\.md-viewer\s*\{[^}]*var\(--measure\)/);
  });

  it('has no --md-font-sans declaration, no !important in font-family rules, no uppercase', () => {
    expect(css).not.toContain('--md-font-sans:');
    const rules = css.match(/\[data-font-family[^{]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBe(3);
    for (const r of rules) expect(r).not.toContain('!important');
    expect(css).not.toContain('uppercase');
    expect(css).not.toContain('letter-spacing');
  });

  it('a4.css max-width uses --measure', () => {
    const a4 = fs.readFileSync(path.resolve(__dirname, './a4.css'), 'utf-8');
    expect(a4).toMatch(/max-width:\s*calc\(var\(--measure\)/);
  });
});

describe('tokens.css Lề sách token layer', () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, f), 'utf-8');
  const tokens = read('./tokens.css');
  const alias = [
    'md-bg','md-doc-bg','md-bg-editor','md-mindmap-bg','md-workspace-bg','md-bg-secondary','md-bg-subtle',
    'md-surface-subtle','bg-secondary','bg-subtle','bg-surface','md-bg-card','md-controls-bg','md-code-bg',
    'md-table-alt','md-fg','md-text','text-primary','md-code-fg','md-fg-muted','md-muted','text-muted',
    'md-blockquote-fg','md-border','md-border-subtle','border-color','md-quote-border','md-link','md-accent',
    'color-accent','md-hover','md-hover-bg','bg-hover','md-active-bg','bg-active','md-error',
    'md-doc-shadow','md-font-sans','md-font-serif','md-font-mono','md-hljs-keyword','md-hljs-doctag',
    'md-hljs-meta-string','md-hljs-string','md-hljs-regexp','md-hljs-comment','md-hljs-number',
    'md-hljs-function','md-hljs-type','md-hljs-tag','md-hljs-attr','md-hljs-meta','md-hljs-link',
  ];
  const colours = ['paper','surface','ink','pencil','rule','hl','hl-ink','accent','danger','ok'];
  const codes = ['keyword','string','comment','number','function','type','attr','meta'].map((c) => `code-${c}`);
  const selectors: string[] = [
    ':root,\n[data-theme="light"] {',
    '[data-theme="dark"] {',
    '[data-contrast="high"][data-theme="light"]',
    '[data-contrast="high"][data-theme="dark"] {',
  ];
  const block = (i: number) => {
    const s = tokens.indexOf(selectors[i]!);
    expect(s).toBeGreaterThanOrEqual(0);
    return tokens.slice(s, tokens.indexOf('}', s));
  };
  const hex = (b: string, n: string) => {
    const m = b.match(new RegExp(`--${n}:\\s*(#[0-9A-Fa-f]{6})`));
    expect(m, `--${n}`).toBeTruthy();
    return m![1]!;
  };
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const contrast = (a: string, b: string) => {
    const hi = Math.max(lum(a), lum(b));
    const lo = Math.min(lum(a), lum(b));
    return (hi + 0.05) / (lo + 0.05);
  };

  it('declares all colour and code tokens in all four palettes', () => {
    for (let i = 0; i < 4; i++) {
      const b = block(i);
      for (const n of [...colours, ...codes]) expect(hex(b, n)).toMatch(/^#/);
    }
  });

  it('declares no legacy alias', () => {
    for (const n of alias) {
      const count = tokens.match(new RegExp(`^\\s*--${n}:`, 'gm'))?.length ?? 0;
      expect(count, n).toBe(0);
    }
  });

  it('meets contrast requirements in every palette', () => {
    for (let i = 0; i < 4; i++) {
      const b = block(i);
      expect(contrast(hex(b, 'ink'), hex(b, 'paper'))).toBeGreaterThanOrEqual(7);
      expect(contrast(hex(b, 'pencil'), hex(b, 'paper'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex(b, 'hl-ink'), hex(b, 'hl'))).toBeGreaterThanOrEqual(7);
      expect(contrast(hex(b, 'accent'), hex(b, 'paper'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex(b, 'ink'), hex(b, 'surface'))).toBeGreaterThanOrEqual(7);
      for (const n of ['pencil', 'accent', 'danger', 'ok', ...codes]) {
        for (const bg of ['paper', 'surface']) {
          expect(contrast(hex(b, n), hex(b, bg)), `${n} vs ${bg} in palette ${i}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('declares --md-selection in each palette, once overall per palette', () => {
    expect(tokens.match(/^\s*--md-selection:/gm)?.length).toBe(4);
    for (let i = 0; i < 4; i++) expect(block(i)).toMatch(/--md-selection:/);
  });

  it('Than chi selection keeps ink readable', () => {
    const b = block(1);
    const mix = (a: string, p: string, pct: number) => '#' + [1, 3, 5].map((k) => {
      const x = parseInt(a.slice(k, k + 2), 16), y = parseInt(p.slice(k, k + 2), 16);
      return Math.round(x * pct + y * (1 - pct)).toString(16).padStart(2, '0');
    }).join('');
    const sel = mix(hex(b, 'accent'), hex(b, 'paper'), 0.3);
    expect(contrast(hex(b, 'ink'), sel)).toBeGreaterThanOrEqual(4.5);
    expect(b).toContain('--md-selection: color-mix(in srgb, var(--accent) 30%, var(--paper))');
  });

  it('selection uses solid highlighter and its ink', () => {
    expect(tokens).toMatch(/::selection\s*\{\s*background:\s*var\(--hl\);\s*color:\s*var\(--hl-ink\);/);
  });

  it('has focus-visible and reduced-motion rules', () => {
    expect(tokens).toContain(':focus-visible');
    expect(tokens).toContain('outline: 2px solid var(--accent)');
    expect(tokens).toContain('--focus:');
    expect(tokens).toContain('prefers-reduced-motion: reduce');
  });

  it('a4.css no longer declares --md-doc-bg', () => {
    expect(read('./a4.css')).not.toMatch(/--md-doc-bg\s*:/);
  });
});

describe('fonts.css local font imports', () => {
  const css = fs.readFileSync(path.resolve(__dirname, './fonts.css'), 'utf-8');

  it('imports all three families', () => {
    expect(css).toContain('@fontsource/literata/');
    expect(css).toContain('@fontsource/ibm-plex-sans/');
    expect(css).toContain('@fontsource/ibm-plex-mono/');
  });

  it('includes the vietnamese subset for every family', () => {
    for (const fam of ['literata', 'ibm-plex-sans', 'ibm-plex-mono']) {
      expect(css).toContain(`@fontsource/${fam}/vietnamese-`);
    }
  });

  it('uses no network fonts', () => {
    expect(css).not.toMatch(/googleapis|gstatic|https?:/);
  });
});
