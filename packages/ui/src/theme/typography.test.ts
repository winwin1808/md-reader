import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('typography.css proportional font scaling', () => {
  const cssPath = path.resolve(__dirname, './typography.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  it('multiplies .md-viewer font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s*\{[^}]*font-size:\s*calc\(0\.74375rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h1 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h1\s*\{[^}]*font-size:\s*calc\(1\.575rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h2 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h2\s*\{[^}]*font-size:\s*calc\(1\.225rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h3 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h3\s*\{[^}]*font-size:\s*calc\(0\.9625rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h4 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h4\s*\{[^}]*font-size:\s*calc\(0\.7875rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h5 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h5\s*\{[^}]*font-size:\s*calc\(0\.7rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h6 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h6\s*\{[^}]*font-size:\s*calc\(0\.6125rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
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
    'color-accent','md-hover','md-hover-bg','bg-hover','md-active-bg','bg-active','md-error','md-selection',
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

  it('declares each legacy alias exactly once', () => {
    for (const n of alias) {
      const count = tokens.match(new RegExp(`^\\s*--${n}:`, 'gm'))?.length ?? 0;
      expect(count, n).toBe(1);
    }
  });

  it('meets contrast requirements in every palette', () => {
    for (let i = 0; i < 4; i++) {
      const b = block(i);
      expect(contrast(hex(b, 'ink'), hex(b, 'paper'))).toBeGreaterThanOrEqual(7);
      expect(contrast(hex(b, 'pencil'), hex(b, 'paper'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex(b, 'hl-ink'), hex(b, 'hl'))).toBeGreaterThanOrEqual(7);
      expect(contrast(hex(b, 'accent'), hex(b, 'paper'))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('has focus-visible and reduced-motion rules', () => {
    expect(tokens).toContain(':focus-visible');
    expect(tokens).toContain('box-shadow: var(--focus)');
    expect(tokens).toContain('prefers-reduced-motion: reduce');
  });

  it('empties color-themes.css of declarations', () => {
    expect(read('./color-themes.css')).not.toMatch(/--[a-z]/);
  });

  it('a4.css no longer declares --md-doc-bg', () => {
    expect(read('./a4.css')).not.toMatch(/--md-doc-bg\s*:/);
  });
});
