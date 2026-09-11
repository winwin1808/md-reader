import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('app.css reviewer fixes', () => {
  const cssPath = path.resolve(__dirname, './app.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  it('defines --md-font-scale-ratio CSS variables for data-font-scale attributes', () => {
    expect(css).toMatch(/\[data-font-scale="sm"\]\s*\{\s*--md-font-scale-ratio:\s*0\.85;\s*\}/);
    expect(css).toMatch(/\[data-font-scale="md"\]\s*\{\s*--md-font-scale-ratio:\s*1;\s*\}/);
    expect(css).toMatch(/\[data-font-scale="lg"\]\s*\{\s*--md-font-scale-ratio:\s*1\.15;\s*\}/);
    expect(css).toMatch(/\[data-font-scale="xl"\]\s*\{\s*--md-font-scale-ratio:\s*1\.3;\s*\}/);
  });

  it('does not define duplicate .exit-reading-mode-btn with bottom: 24px', () => {
    expect(css).not.toContain('.exit-reading-mode-btn');
    expect(css).not.toContain('bottom: 24px');
  });
});
