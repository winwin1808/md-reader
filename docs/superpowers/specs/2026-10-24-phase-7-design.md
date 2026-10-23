# Design: Phase 7 — Giao diện Lề sách (+ logo app)
Author: haonq (coordinator: Claude Opus). Status: designed. Phase: 7
Intent: docs/superpowers/intent/2026-10-24-phase-7-le-sach.md
Mockup: docs/design/ui-redesign-options.html (option A · Lề sách) · Audit: docs/design/2026-10-23-ui-audit.md
Branch: `phase-7` from `phase-6` (stacked; phase 7 consumes phase-6 hooks: saveState, registry, banners).

## Approach chosen

**Token layer first, surfaces after.** Most audit findings are token findings, so 7b
replaces the token layer in one place (`packages/ui/src/theme/tokens.css`) and adds a
*legacy alias block* that maps every variable components already use (defined or not —
`--md-accent`, `--bg-secondary`, `--text-primary`, `--md-bg-editor`, …) onto the new
tokens. From that commit on the whole app is Lề sách-coloured and dark mode reaches the
editor / toolbar / conflict modal, before any component is touched. Each later
sub-phase then restyles one surface and fixes that surface's copy, icons and a11y.

Rejected:
- *Surface-by-surface with local tokens* — repeats today's problem (each component picks
  its own radius/shadow), and dark mode stays broken until the last sub-phase.
- *CSS-in-JS / a component library* — forbidden by the intent constraints and would
  break the "packages/ui reads only CSS vars" rule (DESIGN §2.6).

## Decisions on the intent's open questions

1. **The 5 colour themes are removed.** Replaced by *bảng màu*: Giấy (light), Than chì
   (dark), chosen by the existing `mode` ('light' | 'dark' | 'system'), plus a separate
   `contrast: 'standard' | 'high'` (Tương phản cao) that has a light and a dark variant.
   Stored `colorTheme` values are ignored and dropped on the next settings save. This
   keeps `mode` (used by export, mermaid, speaker view) unchanged.
2. **Body font default becomes Literata (serif).** `fontFamily` keeps 'sans' | 'serif' |
   'mono' (Plex Sans / Literata / Plex Mono). New `settingsVersion: 2`; when absent and
   `fontFamily === 'sans'` (the old default) it becomes 'serif' once.
3. **Content script in-place render: spike first (7n).** A throwaway probe bundles
   `@md-reader/core` render (parse + gfm + rehype + sanitize, no highlight, no math) as
   an IIFE and measures gz. If content.js stays ≤ 50 KB gz with it, 7o builds in-place
   render; otherwise 7o is replaced by a note in Deferred and the widget stays a tab.
4. **Logo:** a page in a dark rounded square, with a blue margin rule and one highlighter
   band — the two "Lề sách" ideas (structure in the margin, highlighter = you are here).
   Exact SVG in 7a1. A simplified 16 px variant drops the thin text lines.
5. **PNG icons** are rendered by a repo script using the Playwright Chromium already
   installed for e2e (`apps/extension/scripts/render-icons.mjs`), and the PNGs are
   committed. Generated binaries (PNGs, `pnpm-lock.yaml`) do not count toward the
   5-file sizing limit; every hand-written file does.
6. **Confetti stays**, default **off**, never runs under `prefers-reduced-motion`, colours
   from tokens (Dạ quang, Xanh mực, Mực) — no Tailwind rainbow.
7. **Fonts:** `@fontsource/literata`, `@fontsource/ibm-plex-sans`,
   `@fontsource/ibm-plex-mono` 5.3.0 as `packages/ui` dependencies, importing only the
   `latin`, `latin-ext` and `vietnamese` subset CSS for the weights used (Literata 400,
   400 italic, 600; Plex Sans 400, 500, 600; Plex Mono 400). Bundled by Vite into the
   app page. Never loaded in the content script, never fetched from the network. Export
   HTML uses the same family names with system fallbacks (no font embedding).
8. **Content widget CSS:** a dedicated `content.css` imported with Vite `?inline` and
   injected as a `<style>` in the shadow root; `app.css` leaves `web_accessible_resources`.

## Shared interfaces (produced early, consumed verbatim later)

### Tokens (7b1, `packages/ui/src/theme/tokens.css`)
```
--paper   page ground          Giấy  #F1F3F2 · Than chì #161C1B · HC light #FFFFFF · HC dark #000000
--surface raised / chrome      #E5EAE7 · #1F2726 · #F2F2F2 · #121212
--ink     body text            #1B2422 · #E3E8E6 · #000000 · #FFFFFF
--pencil  secondary text       #5E6A67 · #A3AFAC · #333333 · #D0D0D0
--rule    hairlines            #D3DAD7 · #2E3836 · #000000 · #FFFFFF
--hl      highlighter          #F3DE4A · #D9C640 · #FFE600 · #FFE600   (text on --hl is always --hl-ink)
--hl-ink  text on highlighter  #1B2422 · #161C1B · #000000 · #000000
--accent  links / focus        #23568C · #8DB6E8 · #0B3D91 · #9CC7FF
--danger  errors               #A2352B · #F08A7E · #8B0000 · #FF9C9C
--ok      success              #2F6B45 · #8CCB9F · #005A1F · #8CFFB0
--font-body  'Literata', 'Iowan Old Style', Georgia, serif
--font-ui    'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif
--font-code  'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace
--r-s 3px (inputs, chips) · --r-m 6px (buttons, menus) · --r-l 10px (modals, cards)
--elev-1  0 1px 2px color-mix(in srgb, var(--ink) 14%, transparent)
--elev-2  0 6px 24px color-mix(in srgb, var(--ink) 18%, transparent)
--focus   0 0 0 2px var(--paper), 0 0 0 4px var(--accent)
--dur-1 120ms · --dur-2 200ms · --ease cubic-bezier(.2,.7,.2,1)
--measure 68ch · --body-size 1.125rem (18px) · --body-lh 1.62
```
Selectors: `:root, [data-theme="light"]` = Giấy; `[data-theme="dark"]` = Than chì;
`[data-contrast="high"][data-theme="light"]` and `[data-contrast="high"][data-theme="dark"]`.
Global rules in the same file: `:focus-visible { outline: none; box-shadow: var(--focus) }`
for `a, button, input, select, textarea, [tabindex]`; `@media (prefers-reduced-motion: reduce)
{ *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1
!important; transition-duration: .01ms !important; scroll-behavior: auto !important } }`.
Legacy alias block (same file, marked `/* legacy aliases — remove in 7s */`): every custom
property used anywhere under `packages/ui/src` and `apps/extension/src` that is not a new
token is defined as `var(<new token>)`; the 7b1 builder gets the list from a grep in the
envelope.

### Theme (7c)
```ts
export type ThemeMode = 'light' | 'dark' | 'system'
export type Contrast = 'standard' | 'high'
interface ThemeProviderProps { mode: ThemeMode; contrast?: Contrast; onModeChange?(m: ThemeMode): void; children: React.ReactNode }
// sets on document.documentElement AND the wrapper div:
//   data-theme = resolved 'light' | 'dark' (system resolved via matchMedia, live)
//   data-contrast = contrast ?? 'standard'
//   style.colorScheme = resolved
export function useResolvedTheme(): 'light' | 'dark'   // context hook — added in 7q1 where it is first consumed
```
`ReaderSettings` gains `contrast: Contrast` (default 'standard') and `settingsVersion: number`
(2); `colorTheme` becomes optional/deprecated in 7c and is deleted in 7h2.

### Icon (7d, `packages/ui/src/components/Icon.tsx`)
```ts
export type IconName = 'book' | 'edit' | 'split' | 'present' | 'mindmap' | 'export' | 'settings'
  | 'search' | 'close' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'more' | 'open-file'
  | 'save' | 'check' | 'alert' | 'fullscreen' | 'zoom-in' | 'zoom-out' | 'expand-all'
  | 'collapse-all' | 'copy' | 'speaker' | 'toc' | 'font-smaller' | 'font-larger' | 'undo' | 'redo'
export function Icon(props: { name: IconName; size?: 16 | 20 | 24; label?: string }): JSX.Element
// 24×24 viewBox, stroke="currentColor" stroke-width 1.6, fill none, round caps/joins.
// label → role="img" + aria-label; no label → aria-hidden="true".
```

### Logo (7a1, `packages/ui/src/components/Logo.tsx`)
```ts
export function Logo(props: { size?: number; title?: string }): JSX.Element  // inline SVG = logo.svg
```

### Save status (7e, `TopToolbar` prop)
```ts
export type SaveStatus =
  | { kind: 'none' }                          // no file handle, nothing to say
  | { kind: 'dirty' }                         // "Chưa lưu"
  | { kind: 'saving' }                        // "Đang lưu…"
  | { kind: 'saved'; at: number }             // "Đã lưu 14:02" (HH:mm, vi-VN)
  | { kind: 'error'; onRetry(): void }        // "Không lưu được" + button "Thử lại"
  | { kind: 'needs-permission'; onGrant(): void } // "Cần cấp quyền ghi" + button "Cấp quyền"
```

## Sub-phases

Each lists FILES (hand-written, ≤5), what it proves, and its test. Copy is Vietnamese,
named by what the user does, sentence case, no ALL-CAPS labels, no emoji anywhere.

### 7a1 — logo, favicon, app title
FILES `apps/extension/public/icons/logo.svg` (new) · `packages/ui/src/components/Logo.tsx` (new) · `packages/ui/src/index.ts` (export) ·
`apps/extension/app.html` (title "MD Reader", `<link rel="icon" href="icons/logo.svg">`).
logo.svg (viewBox 0 0 128 128):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#1B2422"/>
  <path d="M32 20h50l16 16v72H32z" fill="#F1F3F2"/>
  <path d="M82 20v16h16z" fill="#D3DAD7"/>
  <rect x="44" y="20" width="5" height="88" fill="#23568C"/>
  <rect x="56" y="48" width="34" height="14" rx="2" fill="#F3DE4A"/>
  <rect x="59" y="53" width="26" height="4" rx="2" fill="#1B2422"/>
  <rect x="59" y="72" width="30" height="4" rx="2" fill="#5E6A67"/>
  <rect x="59" y="84" width="22" height="4" rx="2" fill="#5E6A67"/>
</svg>
```
logo-16.svg: same without the three 4 px text lines, page `M28 16h56l16 16v80H28z`,
margin rule width 8, band `x=54 y=50 w=38 h=20`. Test: `Logo` renders an svg with
`role="img"` and the title; no new test file beyond `Logo.test.tsx`.

### 7a2 — PNG icons and manifest
FILES `apps/extension/public/icons/logo-16.svg` (new, spec in 7a1) · `apps/extension/scripts/render-icons.mjs` (new) · `apps/extension/package.json`
(script `"icons": "node scripts/render-icons.mjs"`) · `apps/extension/public/manifest.json`
(`icons` 16/32/48/128 and `action.default_icon` 16/32) · generated
`apps/extension/public/icons/icon-{16,32,48,128}.png`.
Script: `chromium.launch()` from `@playwright/test` (already a devDependency), page with
the SVG inlined at the exact size on a transparent background, `page.screenshot({ omitBackground: true })`;
16 px uses logo-16.svg, others logo.svg. Proof: `pnpm --filter extension icons` writes 4
PNGs whose pixel size matches (`file` output); build copies them to `dist/icons/`; the
Playwright smoke still passes.

### 7b1 — Lề sách tokens, legacy aliases, focus, reduced motion
FILES `packages/ui/src/theme/tokens.css` · `packages/ui/src/theme/typography.test.ts`
(token presence assertions) · `apps/extension/src/app/app.css` (only: delete its local
colour/radius literals that duplicate tokens, use tokens).
Proves: every token above exists in all four palette blocks; every legacy name resolves;
`:focus-visible` and reduced-motion rules present (tests parse the CSS text).

### 7b2 — bundled fonts
FILES `packages/ui/package.json` (3 @fontsource deps 5.3.0) · `packages/ui/src/theme/fonts.css`
(new; `@import` of the subset files listed in decision 7) · `apps/extension/src/app/main.tsx`
(import `@md-reader/ui/fonts.css` — add the `exports` entry in ui package.json) · lockfile.
Proves: `dist/` contains woff2 for the three families incl. `vietnamese`; `content.js`
size unchanged; no `fonts.googleapis` string anywhere in `dist/`.

### 7b3 — reading typography and measure
FILES `packages/ui/src/theme/typography.css` · `packages/ui/src/theme/a4.css` ·
`packages/ui/src/theme/reading-mode.css` · `packages/ui/src/theme/typography.test.ts`.
Body `var(--font-body)` 18px/1.62, column `max-width: var(--measure)`; heading scale
1.25 ratio (h1 2.4em/600, h2 1.6em/600, h3 1.25em italic 400, h4 1.05em/600, h5–h6 1em/600
no uppercase, no letter-spacing); `fontFamily` setting maps `data-font="sans|serif|mono"`
to `--font-body` override. Font scale steps stay. Delete typography.css's own `--md-font-*` declarations (review 7b1: they override
the token aliases, so the bundled fonts would never apply). The A4 sheet: paper on `--surface`
ground, `--elev-1`, `--r-s`; on ≤ 720px the sheet loses its border and shadow.

### 7c — palettes and settings migration (split at plan time: 7c1 ThemeProvider · 7c2 settings v2)
FILES `packages/ui/src/theme/ThemeProvider.tsx` · `packages/ui/src/theme/ThemeProvider.test.tsx`
· `packages/ui/src/theme/color-themes.css` (delete) · `packages/ui/src/components/SettingsModal.tsx`
(type only: `contrast`, `settingsVersion`, `colorTheme?` deprecated) · `apps/extension/src/app/App.tsx`
(defaults `contrast: 'standard'`, `settingsVersion: 2`, `celebrationConfetti: false`, no
`colorTheme`; on load: v<2 and fontFamily 'sans' → 'serif'; pass `contrast` to ThemeProvider).
Set data-theme / data-contrast synchronously before first paint (useLayoutEffect, plus an initial
value computed from matchMedia) on BOTH documentElement and the wrapper (review 7b1: one-frame light flash,
wrapper re-declaring non-HC tokens). Interfaces: Theme above. Tests: data-theme resolves system via matchMedia mock and
updates on change; data-contrast set; old stored `{ fontFamily: 'sans' }` without
settingsVersion → 'serif'; with settingsVersion 2 → kept.

### 7d — one icon set
FILES `packages/ui/src/components/Icon.tsx` (new) · `Icon.test.tsx` (new) ·
`packages/ui/src/components/TopToolbar.tsx` · `Deck.tsx` · `MindmapModal.tsx` — every
emoji / Unicode glyph used as an icon (📖 ✍️ ◫ 🎙 🎨 ⚠️ ☑ ⊞ ⛶ ✕ ← → …) becomes `<Icon>`;
icon-only buttons get `aria-label` (Vietnamese). Paths: simple geometric line icons drawn
for this set (24 grid), not copied from a brand set. Test: each IconName renders a path;
label → role img; grep-style test that the three components contain no emoji
(regex `\p{Extended_Pictographic}`).

### 7e — app bar and save status
FILES `packages/ui/src/components/TopToolbar.tsx` · `TopToolbar.test.tsx` ·
`apps/extension/src/app/app.css` · `apps/extension/src/app/App.tsx` (map `fileSave.saveState`
+ dirty → `SaveStatus`; read-only reference: `hooks/useFileSave.ts`).
Bar 48px, `--surface`, hairline `--rule` bottom, `--font-ui` 14px. Left: logo 20 + title
(ellipsis) + save status text (`--pencil`; error in `--danger`). Right: view switch
(Đọc · Soạn · Chia đôi as a segmented control), then Tìm, Trình chiếu, Sơ đồ, Xuất, Cài đặt.
≤ 720px: only title, status, view switch and a "Thêm" (more) menu button holding the
rest (menu = `role="menu"`, arrow keys, Esc closes, focus returns). Font scale moves into
the menu at all widths ("Cỡ chữ" − 100% +). Test: each SaveStatus renders its text;
Thử lại / Cấp quyền call their callbacks; at 400px (matchMedia mock) secondary actions
are in the menu; Esc closes the menu.

### 7f — margin ToC with scroll-spy
FILES `packages/ui/src/Toc.tsx` · `packages/ui/src/Toc.test.tsx` · `packages/ui/src/Viewer.tsx`
(make `onActiveHeadingChange` fire from an IntersectionObserver on h1–h3, rootMargin
`0px 0px -70% 0px`, last heading above the line wins) · `apps/extension/src/app/App.tsx`
(wire it to `Toc activeId`) · `apps/extension/src/app/app.css` (ToC rail styles).
ToC: left margin column, `--font-ui` 14px, no title eyebrow (heading "Mục lục" as a
visually-hidden h2), active item = highlighter band (linear-gradient 18%→86% `--hl`,
text `--hl-ink`), `aria-current="location"`. ≤ 1080px: rail hidden, a "Mục lục" button
(icon toc) in the bar opens it as a left drawer (`role="dialog"`, Esc, focus trap, click
outside closes, choosing an item closes). Test: activeId marks the item; drawer opens,
Esc closes, focus returns; IntersectionObserver mock → callback with the id.

### 7g — reading surfaces: alerts in the margin, search, tables, code
FILES `packages/ui/src/theme/typography.css` (alerts + metadata card + blockquote) ·
`packages/ui/src/theme/table-enhanced.css` · `packages/ui/src/theme/search.css` ·
`packages/ui/src/Viewer.tsx` (code header copy "Sao chép" / "Đã chép", language label
lowercase, copy button aria-label "Sao chép mã") · `packages/ui/src/Viewer.test.tsx`.
Alerts ≥ 1100px: float right into the margin (`width 14.5rem; margin-right: -17rem`,
top hairline `--ink`, title in `--font-ui` 600, icon kept), document column reserves
the margin (`padding-right: 17rem` on the A4 sheet only when the doc has alerts — class
`has-sidenotes` set by Viewer); < 1100px: inline block with left rule. One zebra rule set
(delete the duplicate, no `!important`), header row `--surface`. Search hit = `--hl`
bg + `--hl-ink` text in all palettes; current hit has a 2px `--ink` outline. Metadata card
in tokens (works dark). Code: `--font-code` 13.5px on `--surface`.

### 7h1 — settings as one column of task groups
FILES `packages/ui/src/components/SettingsModal.tsx` · `packages/ui/src/theme/settings.css`
· `packages/ui/src/components/SettingsModal.test.tsx`.
Replace the 5 tabs with one scrolling column of sections, in this order and with these
headings: "Chữ và màu" (bảng màu, tăng tương phản, phông chữ thân, cỡ chữ) · "Nội dung
trong tài liệu" (frontmatter, metadata, math, mermaid, alerts + localize, typographer,
external links) · "Khi mở file .md" (alwaysOpenApp, autoFormatMd) · "Hỗ trợ đọc" (word
count, auto-hide, reading progress, confetti) · "Trình chiếu" (slide colours, font,
background image, opacity). Every label Vietnamese, with a one-line description in
`--pencil` where the effect isn't obvious. A left index of the 5 headings (anchor links)
at ≥ 900px. Modal = `role="dialog"`, aria-labelledby, Esc, focus trap. Remove settings.css `:focus { outline: none; box-shadow: rgba(9,105,218,…) }`
rules so the global outline focus ring applies (review 7b1). Same setting keys
and onChange calls as today (behaviour unchanged). Palette control here is temporary
radios for mode + checkbox contrast (7h2 makes it the picker).

### 7h2 — palette picker replaces ThemePicker; colorTheme deleted
FILES `packages/ui/src/components/ThemePicker.tsx` (rewritten as `PalettePicker`) ·
`ThemePicker.test.tsx` · `packages/ui/src/index.ts` · `SettingsModal.tsx` (use it; delete
`colorTheme` from the type) · `packages/ui/src/theme/ThemeProvider.tsx` (nothing named colorTheme remains).
`PalettePicker({ mode, contrast, onModeChange, onContrastChange })`: three swatch radios
(Giấy · Than chì · Theo hệ thống, each a mini page preview in its own tokens) + a
"Tăng tương phản" switch. Test: arrow keys move the radio; grep-style test: no
`colorTheme` / `data-color-theme` string under packages/ui/src.

### 7i1 — first screen: empty state, drop, recent files
FILES `apps/extension/src/app/App.tsx` (empty state) · `apps/extension/src/app/FileDrop.tsx`
· `apps/extension/src/app/RecentFiles.tsx` · `apps/extension/src/app/app.css` ·
`apps/extension/src/app/App.test.tsx`.
Empty state: Logo 56 + "Mở một tài liệu Markdown" + two actions ("Mở file…" primary,
"Kéo file vào đây" hint) + recent list ("Mở gần đây": title, origin as `--pencil` second
line, relative time "hôm qua", "3 ngày trước"). The whole window is the drop target
(dragover anywhere shows a full-window `--hl`-bordered overlay "Thả để mở"). Wrong type →
inline message "Chỉ mở được file .md, .markdown, .mdx hoặc .txt" in `--danger`, no `alert()`.
Test: drop of a .png shows the message and calls nothing; recent items render title + origin.

### 7i2 — export dialog that tells what it is doing
FILES `packages/ui/src/components/ExportModal.tsx` · `ExportModal.test.tsx` ·
`apps/extension/src/app/App.tsx` (pass `hasSlides` and an async `onExport` it awaits) ·
`apps/extension/src/app/hooks/useExport.ts` (return a promise per format).
The modal stays open while exporting ("Đang tạo file Word…"), closes on success, shows
the error text in place on failure with "Thử lại". "PDF trình chiếu" appears only when
`hasSlides`. Formats named by result: "Trang web (.html)", "PDF để in", "Word (.docx)",
"PDF trình chiếu". Test: pending state visible while the promise is open; rejection shows
error and keeps the modal; hasSlides false hides the slide option.

### 7i3 — conflict dialog in tokens, accessible
FILES `packages/ui/src/components/ConflictModal.tsx` · `ConflictModal.test.tsx` ·
`packages/ui/src/theme/conflict.css`.
Tokens only (dark works). Pane headings as real `h3` ("Bản trên đĩa", "Bản của bạn",
"Bản gốc chung"); change counts with aria-label ("12 dòng thêm, 3 dòng bỏ"); line markers
`+` / `−` as text (not only colour); buttons "Giữ bản của tôi và ghi đè" / "Lấy bản trên
đĩa" / "Để sau". (Deferred from 6.) Test: headings, aria-labels, markers present.

### 7j — editor, formatting bar, split view in tokens
FILES `packages/ui/src/theme/editor.css` · `packages/ui/src/theme/formatting-toolbar.css` ·
`packages/ui/src/theme/split-view.css` · `packages/ui/src/components/FormattingToolbar.tsx`
(Icon, Vietnamese aria-labels/titles with shortcut) · `FormattingToolbar.test.tsx`.
Editor `--font-code` 14px/1.6 on `--paper`, gutter `--pencil`, selection `--hl` 45%,
cursor `--ink`; `.cm-focused` gets an inset 2px `--accent` left edge instead of nothing.
Split divider: 1px `--rule`, 8px hit area, `role="separator"`.

### 7k — slides that fit the screen; readable speaker view
FILES `packages/ui/src/components/Deck.tsx` · `packages/ui/src/theme/deck.css` ·
`packages/ui/src/components/SpeakerView.tsx` · `packages/ui/src/theme/speaker-view.css` ·
`packages/ui/src/components/Deck.test.tsx`.
Slide = logical 1280×720 box scaled with `transform: scale(min(W/1280, H/720))` from a
ResizeObserver on the stage (centred, letterboxed on `--ink`). Default slide styles from
tokens (custom slide colours from settings still win). Copy "Trang 3 / 12". Speaker view:
clock 44px tabular, elapsed 32px, notes 22px/1.5 `--font-body`, labels sentence case
("Trang tiếp theo", "Ghi chú"). Test: scale computed for 1920×1080 → 1.5 and 800×800 → 0.625.

### 7l1 — mindmap in ink, not rainbow
FILES `packages/ui/src/components/MindmapModal.tsx` · `packages/ui/src/theme/mindmap.css` ·
`packages/ui/src/export/export-mindmap.ts` · `packages/ui/src/components/MindmapModal.test.tsx`.
Branch colours: root `--ink`, depth-1 branches cycle over 4 token tones (`--accent`,
`--ok`, `--danger`, `--pencil`) at 100% for the edge and 12% fill — never by sibling
index past 4. Node width from canvas `measureText` with the UI font (fallback 8.2px/char),
wrapped to ≤ 2 lines, ellipsis after. Drag vs click: pointer moved > 4px = pan, never a
jump. One close button (Icon close, top right). SVG/PNG export includes a `--paper`
background rect and resolved colours (not var()). Test: drag 10px then pointerup on a
node does not call onJump; export SVG has a background rect.

### 7l2 — mindmap by keyboard and touch
FILES `MindmapModal.tsx` · `MindmapModal.test.tsx` · `mindmap.css`.
Tree = `role="tree"`, nodes `role="treeitem"` with aria-expanded/level; roving tabindex;
↑↓ siblings, → expand/child, ← collapse/parent, Enter jumps to the heading, Space toggles;
+ / − zoom, 0 fit. Touch: one-finger pan, two-finger pinch zoom (pointer events). Focused
node ring `--focus`. Test: key sequence moves aria-selected and Enter calls onJump.

### 7m — content widget in Lề sách, own small CSS
FILES `apps/extension/src/content/content.css` (new) · `apps/extension/src/content/index.ts`
(inject `content.css?inline` as `<style>` into the shadow root; drop the app.css link) ·
`apps/extension/src/content/ContentApp.tsx` (classes instead of inline styles; Icon-free
inline SVG for book/close — no ui import; copy "Đọc trong MD Reader", "Ẩn") ·
`apps/extension/public/manifest.json` (remove the app.css WAR entry; keep WAR only if
still needed for icons) · `apps/extension/src/content/ContentApp.test.tsx`.
Widget = a tab on the right edge (mockup `.raw-tab`), collapsed state remembered in
`chrome.storage.local` key `mdr.widget.collapsed` (boolean). content.css ≤ 4 KB, uses
system UI fonts only. Proof: content.js gz still ≤ 60 KB (report number); Playwright smoke
passes; widget renders with styles (computed background ≠ transparent).

### 7n — SPIKE: cost of rendering Markdown in the content script
Spiker, throwaway under `spike/content-render/` (not in the workspace, deleted after).
Question: gz size of an IIFE bundling `parseMarkdown` + `renderToHtml` from
`@md-reader/core` with highlight and math disabled (and tree-shaken), plus current content
code. Report: bytes gz, top 5 contributors, and whether `renderToHtml` can be called
without pulling `rehype-highlight`/`katex` (import graph). Decision rule recorded in this
spec: ≤ 50 KB gz → 7o builds; otherwise 7o = Deferred to 8x.

### 7o — (conditional on 7n) in-place reading in the content script
FILES `apps/extension/src/content/index.ts` · `ContentApp.tsx` · `content.css` ·
`apps/extension/src/content/render.ts` (new; wraps core render without highlight/math) ·
`ContentApp.test.tsx`.
On a raw `.md` page: render the Markdown into the shadow root over the `<pre>` in
Lề sách reading typography (system fonts), with a bar "Đọc trong MD Reader" · "Xem bản
thô" (toggle back to the `<pre>`). Still no Yjs, no mermaid (placeholder), sanitized
output only. If 7n says no: this section is replaced by a Deferred line.

### 7p1 — exported HTML and print in Lề sách
FILES `packages/ui/src/export/css.ts` · `packages/ui/src/theme/print.css` ·
`packages/core/src/export/html.ts` (`lang` option default 'vi', highlight token colours
inlined) · `packages/core/src/export/html.test.ts` · `packages/ui/src/export/print.test.ts`.
Export CSS from the light Giấy tokens with literal values (no var() needed offline),
same type scale and measure. Print: `pre { white-space: pre-wrap }`, `break-inside: avoid`
only on figures/images/alerts and table rows (not whole `pre`/tables), `@page` margins equal
the on-screen A4 padding (20mm).

### 7p2 — Word styles
FILES `packages/core/src/export/docx.ts` · `packages/core/src/export/docx.test.ts`.
A `styles` block: Normal = Literata (fallback Georgia) 11pt, line 1.4; Heading1–3 in the
type scale, colour Mực; Quote = left border Xanh mực, not forced italic; code = Plex Mono
(fallback Consolas) 9.5pt on #E5EAE7. Test: generated document styles contain those fonts
and Quote has no italic run property by default.

### 7q1 — mermaid follows the palette and the setting everywhere
FILES `packages/ui/src/components/MermaidBlock.tsx` (`theme: 'default' | 'dark'` prop,
part of the cache key) · `MermaidBlock.test.tsx` · `packages/ui/src/Viewer.tsx` (pass
`useResolvedTheme()`) · `packages/ui/src/components/Deck.tsx` (honour the same `mermaid`
switch as Viewer — deferred from 6j2 — and pass the theme) · `packages/ui/src/theme/ThemeProvider.tsx`
(adds the `useResolvedTheme` context hook; ui-internal import, no index export needed).
Test: switching theme re-renders mermaid with the other theme; cache keeps both; Deck with
`mermaid={false}` mounts no MermaidBlock.

### 7q2 — excalidraw in tokens
FILES `packages/ui/src/components/ExcalidrawBlock.tsx` · `packages/ui/src/theme/excalidraw.css`
· `packages/ui/src/components/ExcalidrawBlock.test.tsx`.
Stroke `--ink`, fills from element colours mapped to token tones when they are the
excalidraw defaults, background transparent, text in `--font-ui`; works in Than chì.
Test: default black stroke renders as `var(--ink)`.

### 7r — reading aids in tokens
FILES `packages/ui/src/components/CelebrationConfetti.tsx` (token colours, skip under
reduced motion) · `WordCountBar.tsx` (Vietnamese "1.240 từ · 6 phút đọc", vi-VN number
format) · `ReadingProgress.tsx` (2px `--accent`) · `packages/ui/src/theme/reading-aids.css`
· `packages/ui/src/components/reading-aids.test.tsx`.
Test: reduced-motion matchMedia true → confetti renders nothing; word count text format.

### 7s1 — deferred from phase 6: e2e and registry
FILES `apps/extension/e2e-pw/smoke.spec.ts` (waitForTimeout → wait for a signal/selector)
· `apps/extension/e2e-pw/fixtures.ts` + `apps/extension/playwright.config.ts` (dist path
relative to the config file) · `apps/extension/src/app/doc-registry.ts` +
`doc-registry.test.ts` (legacy migration de-duplicated across tabs: a `migratedAt` marker
written in the same readwrite transaction that creates records; second tab sees it and skips).
Also: find and fix the unhandled IndexedDB `TransactionInactiveError` seen in ~1/10 full
extension-suite runs (phase 6l.3 note) — loop the suite, name the file, fix the teardown.
Also adds one Playwright case: the app page computed `body` background equals the Giấy
paper colour and `font-family` starts with Literata.

### 7s2 — remove legacy aliases; sweep
FILES `packages/ui/src/theme/tokens.css` (delete the legacy alias block) + up to 4 CSS/TSX
files still using a legacy name (guard lists them at plan time; if > 4, split 7s2/7s3).
Plus the redundant `expect(getBy…).toBeDefined()` sweep only inside files already touched
here; the rest stays a documented no-op (they are redundant, not wrong).

## Sub-phase queue
- 7a1: done
- 7a2: done
- 7b1: done
- 7b2: done
- 7b3: done
- 7c1: done   (ThemeProvider; split from 7c at plan time)
- 7c2: done   (settings v2 wiring)
- 7d: pending
- 7e: pending
- 7f: pending
- 7g: pending
- 7h1: pending
- 7h2: pending
- 7i1: pending
- 7i2: pending
- 7i3: pending
- 7j: pending
- 7k: pending
- 7l1: pending
- 7l2: pending
- 7m: pending
- 7n: pending
- 7o: pending
- 7p1: pending
- 7p2: pending
- 7q1: pending
- 7q2: pending
- 7r: pending
- 7s1: pending
- 7s2: pending

## Invariants copied into every envelope (pick the relevant 3-6)
- packages/core: pure TS — no react, chrome.*, document/window. packages/ui: no chrome.*.
- Cross-package imports by workspace name only (`@md-reader/core`, `@md-reader/ui`).
- No data, schema, storage-format or save-behaviour change (phase 7 is visual; the only
  new stored keys are settings `contrast`, `settingsVersion` and `mdr.widget.collapsed`).
- Content script: no Yjs, no ui package import, ≤ 60 KB gz; widget CSS from content.css only.
- No network fonts or assets; no new UI framework, CSS-in-JS or state manager.
- Copy in Vietnamese, sentence case, no emoji, icon-only buttons have aria-label.

## Deferred
- To 8: toolbar/presence slots for collaborators (8d) reuse the SaveStatus area.
- app.js main chunk is 408 kB gz after 6j (KaTeX CSS/JS in the main chunk) — lazy-load
  KaTeX when a doc contains math: candidate for 8x performance pass.
