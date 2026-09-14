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
