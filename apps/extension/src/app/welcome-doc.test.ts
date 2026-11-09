import { describe, it, expect } from 'vitest';
import { parseMarkdown, splitIntoSlides } from '@md-reader/core';
import { WELCOME_ORIGIN, welcomeMarkdown } from './welcome-doc';

const locales = ['vi', 'en'] as const;

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('welcomeMarkdown', () => {
  it('exposes origins', () => {
    expect(WELCOME_ORIGIN.vi).toBe('mdr://welcome/vi');
    expect(WELCOME_ORIGIN.en).toBe('mdr://welcome/en');
  });

  it('vi and en share the same structure', () => {
    const vi = welcomeMarkdown('vi');
    const en = welcomeMarkdown('en');
    expect(count(vi, /^# /gm)).toBe(count(en, /^# /gm));
    expect(count(vi, /^## /gm)).toBe(count(en, /^## /gm));
    expect(count(vi, /^### /gm)).toBe(count(en, /^### /gm));
    expect(count(vi, /^---$/gm)).toBe(count(en, /^---$/gm));
    expect(count(vi, /^# /gm)).toBe(1);
  });

  for (const l of locales) {
    describe(l, () => {
      const md = welcomeMarkdown(l);
      it('parses', () => {
        expect(() => parseMarkdown(md)).not.toThrow();
      });
      it('has rich blocks', () => {
        expect(md).toContain('```mermaid');
        expect(md).toContain('$$');
        expect(md).toContain('> [!TIP]');
        expect(md).toMatch(/^\|.*\|$/m);
        expect(md).toMatch(/<!-- note:/);
      });
      it('splits into >= 5 slides', () => {
        expect(splitIntoSlides(md).length).toBeGreaterThanOrEqual(5);
      });
      it('has no external urls', () => {
        expect(md).not.toMatch(/https?:\/\//);
      });
    });
  }
});
