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

  // Nhãn ghi cứng theo packages/ui/src/i18n/catalog/shell.ts (nút sơ đồ tư duy, Trình chiếu, Sửa) và thanh định dạng (Ngắt slide).
  const labels = {
    vi: { mindmap: 'Sơ đồ', present: 'Trình chiếu', edit: 'Sửa', brk: 'nút Ngắt slide tại đây trên thanh định dạng' },
    en: { mindmap: 'Mind map', present: 'Present', edit: 'Edit', brk: 'the Break slide here button on the formatting toolbar' },
  } as const;

  for (const l of locales) {
    it(`${l} uses real UI button names`, () => {
      const md = welcomeMarkdown(l);
      for (const label of Object.values(labels[l])) expect(md).toContain(label);
      if (l === 'vi') expect(md).not.toContain('Mindmap');
      else expect(md).not.toContain('Mindmap');
      expect(md).not.toMatch(/margin|lề trang/);
    });
  }

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
