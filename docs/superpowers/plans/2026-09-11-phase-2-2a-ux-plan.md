# Plan: Phase 2 — Sub-phase 2a-ux
Author: Antigravity. Status: built. Phase: 2. Sub-phase: 2a-ux
Spec: docs/superpowers/specs/2026-09-11-phase-2-design.md
BranchPoint: HEAD

## Invariants
- Typography base size is 1.0625rem (17px) with 1.7 line-height.
- Reading column max-width is 740px. Bottom overscroll padding is 180px.
- ToC is a modern navigation rail without bullet points, with depth indentation and active indicator.
- Settings modal has backdrop blur (8px), rounded corners (16px), and high-contrast theme swatches.
- All existing tests in `@md-reader/ui` and `@md-reader/extension` must pass.

## Tasks

### [x] 2a-ux-1 — Typography Scale & Reading Rhythm
FILES       packages/ui/src/theme/typography.css
INTERFACES
- `.md-viewer`: `font-size: 1.0625rem` (17px), `line-height: 1.7`, `color: var(--md-fg)`.
- Headings:
  - `h1`: `font-size: 2.25rem` (36px), `line-height: 1.2`, `font-weight: 700`, `letter-spacing: -0.025em`, `margin-top: 2.75rem`, `margin-bottom: 1rem`.
  - `h2`: `font-size: 1.75rem` (28px), `line-height: 1.25`, `font-weight: 650`, `letter-spacing: -0.02em`, `margin-top: 2.25rem`, `margin-bottom: 0.75rem`, `border-bottom: 1px solid var(--md-border-subtle, var(--md-border))`, `padding-bottom: 0.35rem`.
  - `h3`: `font-size: 1.375rem` (22px), `line-height: 1.35`, `font-weight: 600`, `letter-spacing: -0.015em`, `margin-top: 1.75rem`, `margin-bottom: 0.5rem`.
  - `h4`: `font-size: 1.125rem` (18px), `line-height: 1.4`, `font-weight: 600`, `margin-top: 1.5rem`, `margin-bottom: 0.5rem`.
  - `h5`: `font-size: 1rem` (16px), `line-height: 1.5`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.05em`, `color: var(--md-fg-muted)`, `margin-top: 1.25rem`, `margin-bottom: 0.35rem`.
  - `h6`: `font-size: 0.875rem` (14px), `line-height: 1.5`, `font-weight: 600`, `color: var(--md-fg-muted)`, `margin-top: 1.25rem`, `margin-bottom: 0.25rem`.
  - All headings have `scroll-margin-top: 80px`.
  - `.md-viewer > *:first-child, .md-viewer > h1:first-child { margin-top: 0 !important; }`.
- Paragraphs: `margin-top: 0`, `margin-bottom: 1.5rem` (24px).
- Pre / code: pre padding `1.25rem 1.5rem`, `line-height: 1.6`, `border-radius: 10px`, `border: 1px solid var(--md-border)`; inline code `font-size: 0.875em`, `padding: 0.2em 0.45em`, `border-radius: 5px`.
- Blockquote: `margin: 1.75rem 0`, `padding: 0.85rem 1.35rem`, `border-left: 3px solid var(--md-link)`, `background-color: var(--md-surface-subtle, rgba(125, 125, 125, 0.05))`, `border-radius: 0 8px 8px 0`.
- Table: `margin: 2rem 0`, `border-spacing: 0`, `border-collapse: separate`, `border-radius: 8px`, `overflow: hidden`, `border: 1px solid var(--md-border)`, th/td `padding: 11px 16px`.
- Lists: `padding-left: 1.75rem`, `margin-bottom: 1.5rem`, li `margin-bottom: 0.45rem`, `line-height: 1.65`.
TEST        `pnpm --filter @md-reader/ui test`
COMMIT      feat(ui): upgrade typography scale to 17px base with golden heading hierarchy

### [x] 2a-ux-2 — Layout Spacing & Modern ToC Navigation Rail
FILES       apps/extension/src/app/app.css, packages/ui/src/Toc.tsx, packages/ui/src/Toc.test.tsx
INTERFACES
- `app.css`:
  - `.app-layout`: `display: grid; grid-template-columns: minmax(0, 740px) 260px; justify-content: center; column-gap: 56px; max-width: 1200px; margin: 0 auto; padding: 56px 32px 180px; align-items: start;`.
  - `.app-layout.single-column`: `grid-template-columns: minmax(0, 740px);`.
  - `.main-content`: `min-width: 0; width: 100%;`.
  - `.sidebar-toc`: `position: sticky; top: 56px; max-height: calc(100vh - 100px); overflow-y: auto; padding-left: 12px; border-left: 1px solid var(--md-border-subtle, var(--md-border));`.
  - `.md-toc`: `font-size: 0.8125rem; line-height: 1.5;`.
  - `.md-toc-title`: `font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--md-fg-muted); margin-bottom: 12px; padding-left: 8px;`.
  - `.md-toc ul`: `list-style: none; margin: 0; padding: 0;`.
  - `.md-toc li`: `margin: 2px 0;`.
  - `.md-toc li a`: `display: block; padding: 6px 10px; color: var(--md-fg-muted); text-decoration: none; border-radius: 6px; border-left: 2px solid transparent; transition: all 0.15s ease; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`.
  - `.md-toc li a:hover`: `color: var(--md-fg); background-color: var(--md-hover-bg, rgba(125, 125, 125, 0.08));`.
  - `.md-toc li a[aria-current="true"]`: `color: var(--md-link); font-weight: 600; background-color: var(--md-active-bg, rgba(125, 125, 125, 0.08)); border-left-color: var(--md-link);`.
  - `@media (max-width: 1080px)`: `grid-template-columns: minmax(0, 740px); padding: 32px 20px 120px;`, hide `.sidebar-toc`.
- `Toc.tsx`:
  - Thêm tiêu đề Mục lục (ví dụ `<div className="md-toc-title">Mục lục</div>`).
  - Thụt lề theo `entry.depth` (ví dụ `style={{ paddingLeft: \`\${(entry.depth - 1) * 12 + 8}px\` }}`).
  - Giữ nguyên cấu trúc thẻ `<nav className="md-toc">` và `<ul><li><a ...>` để không làm gãy test.
TEST        `pnpm --filter @md-reader/ui test src/Toc.test.tsx && pnpm --filter @md-reader/extension test src/app/App.test.tsx`
COMMIT      feat(ui): style modern ToC rail and expand layout with 740px measure and 180px bottom padding

### [x] 2a-ux-3 — Settings Modal & Theme Swatches Polish
FILES       packages/ui/src/components/SettingsModal.tsx, packages/ui/src/components/ThemePicker.tsx, packages/ui/src/components/SettingsModal.test.tsx, packages/ui/src/components/ThemePicker.test.tsx
INTERFACES
- `SettingsModal.tsx`:
  - Trigger button: thêm styling bóng đổ nhẹ `boxShadow: '0 4px 12px rgba(0,0,0,0.08)'`, border-radius `10px`, `backdropFilter: 'blur(8px)'`, cursor pointer.
  - Backdrop: `backgroundColor: 'rgba(0, 0, 0, 0.45)'`, `backdropFilter: 'blur(8px)'`, `WebkitBackdropFilter: 'blur(8px)'`.
  - Modal container: `borderRadius: '16px'`, `border: '1px solid var(--md-border)'`, `boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)'`, `padding: '24px 28px'`, `minWidth: '340px'`.
- `ThemePicker.tsx`:
  - Swatch size: tăng lên `30px` x `30px` (thay vì 24px).
  - Ring active: `boxShadow: currentTheme === theme ? '0 0 0 2px var(--md-bg), 0 0 0 4px var(--md-link)' : 'none'`.
TEST        `pnpm --filter @md-reader/ui test src/components/SettingsModal.test.tsx && pnpm --filter @md-reader/ui test src/components/ThemePicker.test.tsx`
COMMIT      feat(ui): polish settings modal with backdrop blur and 30px theme swatches
