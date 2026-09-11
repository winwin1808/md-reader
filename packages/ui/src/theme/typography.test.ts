import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const typographyCss = fs.readFileSync(
  path.resolve(__dirname, 'typography.css'),
  'utf-8'
);

describe('typography.css', () => {
  it('defines base .md-viewer font-size, line-height, and color', () => {
    expect(typographyCss).toMatch(/\.md-viewer\s*\{[^}]*font-size:\s*1\.0625rem/);
    expect(typographyCss).toMatch(/\.md-viewer\s*\{[^}]*line-height:\s*1\.7/);
    expect(typographyCss).toMatch(/\.md-viewer\s*\{[^}]*color:\s*var\(--md-fg\)/);
  });

  it('defines heading scales and styles', () => {
    // h1
    expect(typographyCss).toMatch(/h1\s*\{[^}]*font-size:\s*2\.25rem/);
    expect(typographyCss).toMatch(/h1\s*\{[^}]*line-height:\s*1\.2[;\s]/);
    expect(typographyCss).toMatch(/h1\s*\{[^}]*font-weight:\s*700/);
    expect(typographyCss).toMatch(/h1\s*\{[^}]*letter-spacing:\s*-0\.025em/);
    expect(typographyCss).toMatch(/h1\s*\{[^}]*margin-top:\s*2\.75rem/);
    expect(typographyCss).toMatch(/h1\s*\{[^}]*margin-bottom:\s*1rem/);

    // h2
    expect(typographyCss).toMatch(/h2\s*\{[^}]*font-size:\s*1\.75rem/);
    expect(typographyCss).toMatch(/h2\s*\{[^}]*line-height:\s*1\.25/);
    expect(typographyCss).toMatch(/h2\s*\{[^}]*font-weight:\s*650/);
    expect(typographyCss).toMatch(/h2\s*\{[^}]*letter-spacing:\s*-0\.02em/);
    expect(typographyCss).toMatch(/h2\s*\{[^}]*margin-top:\s*2\.25rem/);
    expect(typographyCss).toMatch(/h2\s*\{[^}]*margin-bottom:\s*0\.75rem/);
    expect(typographyCss).toMatch(/h2\s*\{[^}]*border-bottom:\s*1px solid var\(--md-border-subtle,\s*var\(--md-border\)\)/);
    expect(typographyCss).toMatch(/h2\s*\{[^}]*padding-bottom:\s*0\.35rem/);

    // h3
    expect(typographyCss).toMatch(/h3\s*\{[^}]*font-size:\s*1\.375rem/);
    expect(typographyCss).toMatch(/h3\s*\{[^}]*line-height:\s*1\.35/);
    expect(typographyCss).toMatch(/h3\s*\{[^}]*font-weight:\s*600/);
    expect(typographyCss).toMatch(/h3\s*\{[^}]*letter-spacing:\s*-0\.015em/);
    expect(typographyCss).toMatch(/h3\s*\{[^}]*margin-top:\s*1\.75rem/);
    expect(typographyCss).toMatch(/h3\s*\{[^}]*margin-bottom:\s*0\.5rem/);

    // h4
    expect(typographyCss).toMatch(/h4\s*\{[^}]*font-size:\s*1\.125rem/);
    expect(typographyCss).toMatch(/h4\s*\{[^}]*line-height:\s*1\.4[;\s]/);
    expect(typographyCss).toMatch(/h4\s*\{[^}]*font-weight:\s*600/);
    expect(typographyCss).toMatch(/h4\s*\{[^}]*margin-top:\s*1\.5rem/);
    expect(typographyCss).toMatch(/h4\s*\{[^}]*margin-bottom:\s*0\.5rem/);

    // h5
    expect(typographyCss).toMatch(/h5\s*\{[^}]*font-size:\s*1rem/);
    expect(typographyCss).toMatch(/h5\s*\{[^}]*line-height:\s*1\.5/);
    expect(typographyCss).toMatch(/h5\s*\{[^}]*font-weight:\s*600/);
    expect(typographyCss).toMatch(/h5\s*\{[^}]*text-transform:\s*uppercase/);
    expect(typographyCss).toMatch(/h5\s*\{[^}]*letter-spacing:\s*0\.05em/);
    expect(typographyCss).toMatch(/h5\s*\{[^}]*color:\s*var\(--md-fg-muted\)/);
    expect(typographyCss).toMatch(/h5\s*\{[^}]*margin-top:\s*1\.25rem/);
    expect(typographyCss).toMatch(/h5\s*\{[^}]*margin-bottom:\s*0\.35rem/);

    // h6
    expect(typographyCss).toMatch(/h6\s*\{[^}]*font-size:\s*0\.875rem/);
    expect(typographyCss).toMatch(/h6\s*\{[^}]*line-height:\s*1\.5/);
    expect(typographyCss).toMatch(/h6\s*\{[^}]*font-weight:\s*600/);
    expect(typographyCss).toMatch(/h6\s*\{[^}]*color:\s*var\(--md-fg-muted\)/);
    expect(typographyCss).toMatch(/h6\s*\{[^}]*margin-top:\s*1\.25rem/);
    expect(typographyCss).toMatch(/h6\s*\{[^}]*margin-bottom:\s*0\.25rem/);

    // scroll-margin-top on headings
    expect(typographyCss).toMatch(/h[1-6][^{}]*\{[^}]*scroll-margin-top:\s*80px/);

    // first-child reset
    expect(typographyCss).toMatch(/\.md-viewer\s*>\s*\*:first-child,\s*\.md-viewer\s*>\s*h1:first-child\s*\{[^}]*margin-top:\s*0\s*!important/);
  });

  it('defines paragraph rhythm', () => {
    expect(typographyCss).toMatch(/\.md-viewer\s+p\s*\{[^}]*margin-top:\s*0/);
    expect(typographyCss).toMatch(/\.md-viewer\s+p\s*\{[^}]*margin-bottom:\s*1\.5rem/);
  });

  it('defines pre and inline code styling', () => {
    // pre
    expect(typographyCss).toMatch(/\.md-viewer\s+pre\s*\{[^}]*padding:\s*1\.25rem\s+1\.5rem/);
    expect(typographyCss).toMatch(/\.md-viewer\s+pre\s*\{[^}]*line-height:\s*1\.6/);
    expect(typographyCss).toMatch(/\.md-viewer\s+pre\s*\{[^}]*border-radius:\s*10px/);
    expect(typographyCss).toMatch(/\.md-viewer\s+pre\s*\{[^}]*border:\s*1px\s+solid\s+var\(--md-border\)/);

    // inline code
    expect(typographyCss).toMatch(/\.md-viewer\s+code[^{]*\{[^}]*font-size:\s*0\.875em/);
    expect(typographyCss).toMatch(/\.md-viewer\s+code[^{]*\{[^}]*padding:\s*0\.2em\s+0\.45em/);
    expect(typographyCss).toMatch(/\.md-viewer\s+code[^{]*\{[^}]*border-radius:\s*5px/);
  });

  it('defines blockquote styling', () => {
    expect(typographyCss).toMatch(/\.md-viewer\s+blockquote\s*\{[^}]*margin:\s*1\.75rem\s+0/);
    expect(typographyCss).toMatch(/\.md-viewer\s+blockquote\s*\{[^}]*padding:\s*0\.85rem\s+1\.35rem/);
    expect(typographyCss).toMatch(/\.md-viewer\s+blockquote\s*\{[^}]*border-left:\s*3px\s+solid\s+var\(--md-link\)/);
    expect(typographyCss).toMatch(/\.md-viewer\s+blockquote\s*\{[^}]*background-color:\s*var\(--md-surface-subtle,\s*rgba\(125,\s*125,\s*125,\s*0\.05\)\)/);
    expect(typographyCss).toMatch(/\.md-viewer\s+blockquote\s*\{[^}]*border-radius:\s*0\s+8px\s+8px\s+0/);
  });

  it('defines table styling', () => {
    expect(typographyCss).toMatch(/\.md-viewer\s+table\s*\{[^}]*margin:\s*2rem\s+0/);
    expect(typographyCss).toMatch(/\.md-viewer\s+table\s*\{[^}]*border-spacing:\s*0/);
    expect(typographyCss).toMatch(/\.md-viewer\s+table\s*\{[^}]*border-collapse:\s*separate/);
    expect(typographyCss).toMatch(/\.md-viewer\s+table\s*\{[^}]*border-radius:\s*8px/);
    expect(typographyCss).toMatch(/\.md-viewer\s+table\s*\{[^}]*overflow:\s*hidden/);
    expect(typographyCss).toMatch(/\.md-viewer\s+table\s*\{[^}]*border:\s*1px\s+solid\s+var\(--md-border\)/);
    expect(typographyCss).toMatch(/\.md-viewer\s+table\s+(?:th,\s*\.md-viewer\s+table\s+td|td,\s*\.md-viewer\s+table\s+th|th,\s*td)\s*\{[^}]*padding:\s*11px\s+16px/);
  });

  it('defines list styling', () => {
    expect(typographyCss).toMatch(/\.md-viewer\s+(?:ul,\s*\.md-viewer\s+ol|ol,\s*\.md-viewer\s+ul|ul|ol)\s*\{[^}]*padding-left:\s*1\.75rem/);
    expect(typographyCss).toMatch(/\.md-viewer\s+(?:ul,\s*\.md-viewer\s+ol|ol,\s*\.md-viewer\s+ul|ul|ol)\s*\{[^}]*margin-bottom:\s*1\.5rem/);
    expect(typographyCss).toMatch(/\.md-viewer\s+li\s*\{[^}]*margin-bottom:\s*0\.45rem/);
    expect(typographyCss).toMatch(/\.md-viewer\s+li\s*\{[^}]*line-height:\s*1\.65/);
  });
});
