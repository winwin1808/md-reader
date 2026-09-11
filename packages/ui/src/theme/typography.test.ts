import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('typography.css proportional font scaling', () => {
  const cssPath = path.resolve(__dirname, './typography.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  it('multiplies .md-viewer font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s*\{[^}]*font-size:\s*calc\(1\.0625rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h1 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h1\s*\{[^}]*font-size:\s*calc\(2\.25rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h2 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h2\s*\{[^}]*font-size:\s*calc\(1\.75rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h3 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h3\s*\{[^}]*font-size:\s*calc\(1\.375rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h4 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h4\s*\{[^}]*font-size:\s*calc\(1\.125rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h5 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h5\s*\{[^}]*font-size:\s*calc\(1rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });

  it('multiplies .md-viewer h6 font-size by --md-font-scale-ratio', () => {
    expect(css).toMatch(/\.md-viewer\s+h6\s*\{[^}]*font-size:\s*calc\(0\.875rem\s*\*\s*var\(--md-font-scale-ratio,\s*1\)\);/);
  });
});
