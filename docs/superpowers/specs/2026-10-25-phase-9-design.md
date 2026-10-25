# Design: Phase 9 — Soạn ngay trên trang đọc (+ hoàn thiện chia sẻ)
Author: haonq (coordinator: Claude Opus). Status: shipped. Phase: 9
Intent: docs/superpowers/intent/2026-10-25-phase-9-soan-tren-trang.md

## Approach chosen

**CodeMirror 6 live preview trên `Y.Text "source"`**: một bộ extension CM6 (ViewPlugin + `Decoration.replace/mark/line/widget`
dựa trên cây cú pháp Lezer markdown) ẩn dấu Markdown khi selection không chạm nút cú pháp đó, và đặt kiểu chữ Lề sách lên chính
editor. Bind Yjs vẫn là `y-codemirror.next` như `Editor` hiện tại — cộng tác, undo, awareness, blame giữ nguyên.

Rejected:
- *ProseMirror/Milkdown/Tiptap + y-prosemirror*: cần `Y.XmlFragment` → đổi schema (ràng buộc #1) và chuyển đổi hai chiều
  md↔doc làm lệch ký tự; Milkdown dùng remark nhưng vẫn mất round-trip chính xác.
- *contenteditable trên HTML của Viewer, map ngược về offset nguồn*: map hast position → source khó đúng với alert/footnote/
  typographer, dễ hỏng khi gõ, không có cộng tác con trỏ.

**Copy link đã tạo**: giải phía client. Máy chủ giữ nguyên (chỉ lưu hash). Extension lưu token đầy đủ lúc tạo trong
`chrome.storage.local`, khóa theo `room` + `tokenPrefix`. Rejected: lưu token mã hoá trên server bằng ownerToken — đổi API +
migration D1 cho lợi ích nhỏ (ownerToken cũng chỉ nằm trên một máy).

## Decisions on the intent's open questions

- Ẩn dấu **theo nút cú pháp** (HeaderMark, EmphasisMark, CodeMark, LinkMark/URL, StrikethroughMark, QuoteMark, ListMark…):
  dấu hiện khi `selection.ranges` chạm `[node.from, node.to]` của nút cha (ATXHeading, Emphasis, StrongEmphasis, InlineCode,
  Link, Image, Strikethrough). Dòng đề mục hiện `#` khi con trỏ trên dòng đó.
- Chuyển Đọc ↔ Soạn trên trang giữ vị trí theo **heading gần nhất trên đỉnh khung nhìn** (`id` heading ↔ dòng nguồn qua slug).
- Extension mở file ở chế độ **Đọc**; nhớ chế độ cuối **theo tài liệu** (`DocRecord.viewMode`, additive).
- Khối nặng (mermaid, `$$…$$`, excalidraw, bảng) = widget render khi con trỏ ở ngoài; con trỏ vào trong (bàn phím hoặc click) →
  hiện mã. Alert hiện inline có viền tông (không margin notes trong chế độ soạn).
- Web: link `edit` mở **Soạn trên trang**, nút **Xem** chuyển sang `Viewer` chỉ đọc; link `view` chỉ có Viewer.

## Shared interfaces

### `@md-reader/ui` — `src/live/` (exported only through the lazy subpath `@md-reader/ui/editor`)

```ts
// live/hide-marks.ts (9b1)
export function hideMarks(): Extension                 // ViewPlugin; decorations recomputed on docChanged|selectionSet|viewportChanged
export function revealRanges(state: EditorState): Array<{ from: number; to: number }>  // exported for tests
// live/theme.ts (9b1)
export const livePreviewTheme: Extension               // EditorView.theme using only Lề sách var(--…) tokens
// live/widgets.ts (9b2)
export function inlineWidgets(): Extension            // images, hr, task checkbox, code-fence chrome, alert line classes
// live/block-widgets.ts (9b3)
export interface BlockRenderers {
  table(src: string): string                           // sanitized HTML (caller: renderToHtml from core)
  math(tex: string): string                            // KaTeX HTML or the tex in <code> on failure
  mermaid(code: string, theme: 'default' | 'dark'): Promise<string>   // svg (renderMermaidToSvg)
}
export function blockWidgets(r: BlockRenderers): Extension
// live/index.ts (9b4)
export function livePreview(r: BlockRenderers): Extension[]   // [hideMarks(), inlineWidgets(), blockWidgets(r), livePreviewTheme]
```

`Editor` (9b4) gains `variant?: 'source' | 'live'` (default `'source'`) and `renderers?: BlockRenderers` (required when live).
`createDefaultRenderers(opts: { theme: 'default'|'dark' }): BlockRenderers` lives in `live/renderers.ts` and uses
`@md-reader/core` `renderToHtml` + KaTeX plugin + `renderMermaidToSvg` (all already app-page/web deps; never content script).

### `@md-reader/ui` — `ShareModal` (9a2)

```ts
interface ShareLinkView extends ShareLink { copyable: boolean }   // token !== ''
ShareModalProps += {
  onRecreate(link: ShareLink): Promise<void>     // create a new link with same role + label + remaining preset, then revoke the old one
}
```
Groups "Link xem" / "Link sửa"; per row: label, role, "còn N ngày" / "Hết hạn" / "Đã thu hồi", **Sao chép** (copyable) or
**Tạo lại link** (not copyable, active only), **Thu hồi**. Toast `role="status"` "Đã sao chép" 2 s.

### `apps/extension` — link cache (9a1)

```ts
// src/app/collab/link-cache.ts
export async function saveLinkToken(room: string, prefix: string, token: string): Promise<void>
export async function getLinkTokens(room: string): Promise<Record<string, string>>   // prefix -> token
export async function forgetLinkToken(room: string, prefix: string): Promise<void>
// key: `mdr.links.<room>` in chrome.storage.local
```
`useShare` fills `link.token` from the cache when the server returns `''`; `createLink` saves; `revoke` forgets.

### `apps/extension` — view modes (9c1)

`ViewMode = 'reading' | 'live' | 'editor' | 'split'` (`editor` labelled "Mã nguồn"). `DocRecord.viewMode?: ViewMode`.
`export function nearestHeadingAtTop(container: HTMLElement): string | null` and
`export function lineOfHeading(source: string, headingId: string): number | null` in `apps/extension/src/app/view-anchor.ts`.

## Sub-phases

### 9a1 — link token cache (extension)
FILES `apps/extension/src/app/collab/link-cache.ts` (new) · `link-cache.test.ts` (new) · `apps/extension/src/app/collab/useShare.ts`
· `useShare.test.ts`. Interfaces above. Errors: storage failure → links stay non-copyable, no throw. Tests: save→get round trip
per room; useShare merges cached token into a listed link with `token: ''`; revoke forgets.

### 9a2 — ShareModal finished
FILES `packages/ui/src/components/ShareModal.tsx` · `ShareModal.test.tsx` · `packages/ui/src/theme/share.css` (new or existing
modal css) · `apps/extension/src/app/collab/useShare.ts` (`recreate`) · `apps/extension/src/app/App.tsx` (wire `onRecreate`).
Tests: rows grouped by role; copy writes the full URL and shows "Đã sao chép"; non-copyable active row shows "Tạo lại link" and
calls onRecreate; revoked/expired rows show no copy and no recreate.

### 9b1 — hide marks + live theme
FILES `packages/ui/src/live/hide-marks.ts` · `live/theme.ts` · `live/hide-marks.test.ts` · `packages/ui/package.json` (only if
`@lezer/markdown`/`@codemirror/lang-markdown` must be declared — they are already transitive deps of the editor).
Tests (EditorState only, no DOM): `**a** b` with cursor at end → the two `**` ranges are replaced; cursor inside `a` → none;
`# T` cursor elsewhere → `# ` hidden, line class `cm-live-h1`; link `[t](u)` → only `t` visible.

### 9b2 — inline widgets
FILES `packages/ui/src/live/widgets.ts` · `live/widgets.test.ts` · `live/theme.ts`. Images (`![a](src)` → `<img>` widget, src
must be http(s)/data:image/blob:, else alt text), `---` → hr widget, `- [ ]`/`- [x]` → checkbox that dispatches the one-char
change, fenced code → line classes + language badge, `> [!NOTE]` → alert line classes. Tests: checkbox click changes `[ ]`→`[x]`
in the doc; javascript: image src never rendered.

### 9b3 — block widgets
FILES `packages/ui/src/live/block-widgets.ts` · `live/block-widgets.test.ts` · `live/renderers.ts`. Block replace decorations
(StateField, since they span lines) for Table, `$$` math, ```mermaid fences; skipped when selection is inside the block; mermaid
async → placeholder then re-dispatch. Tests with fake renderers: table replaced when cursor outside, source when inside; mermaid
placeholder then svg.

### 9b4 — Editor variant 'live'
FILES `packages/ui/src/components/Editor.tsx` · `live/index.ts` · `packages/ui/src/editor.ts` (subpath entry: export
`livePreview`, `createDefaultRenderers`) · `Editor.test.tsx` · `packages/ui/src/theme/live.css` (sheet frame: same container,
measure and padding as `.a4-document-container`). Tests: `variant="live"` mounts with `cm-live` class; typing still writes Y.Text.

### 9c1 — extension modes
FILES `packages/ui/src/components/SplitViewContainer.tsx` (mode type + live branch renders editor full width in the sheet frame)
· `packages/ui/src/components/TopToolbar.tsx` (4 segments) · `apps/extension/src/app/App.tsx` · `apps/extension/src/app/view-anchor.ts`
(new) · `apps/extension/src/app/view-anchor.test.ts` (new). FormattingToolbar shows in live/editor/split. Remember mode in
`DocRecord.viewMode` (doc-registry one-line allowed). Tests: anchor helpers; mode persisted and restored.

### 9d1 — web share pages in Lề sách
FILES `apps/web/src/EditPage.tsx` · `apps/web/src/SharePage.tsx` · `apps/web/src/web.css` (new) · `apps/web/src/main.tsx` ·
`apps/web/src/EditPage.test.tsx`. ThemeProvider + fonts + tokens; header (Logo, title, PresenceBar, status text, Xem/Soạn
toggle for edit links); name form styled; edit role → `Editor variant="live"` + FormattingToolbar; "Xem" → Viewer. Tests: edit
link defaults to live editor, toggle shows Viewer; view link has no toggle.

### 9e — e2e
FILES `apps/extension/e2e-pw/live.spec.ts` (new) · `apps/extension/e2e-pw/fixtures.ts`. Open a doc, switch to "Soạn trên trang",
type `**x**` elsewhere → asterisks hidden off-cursor, saved source contains `**x**`; ShareModal copy against a stubbed API.

### 9f — ship kit
FILES `apps/extension/public/manifest.json` + `package.json` (1.2.0) · `docs/store/listing.md` (mention Soạn trên trang).

**Change 2026-10-25 (user):** extension has only two modes — Đọc · Sửa (live). Mã nguồn and Chia đôi are removed.

## Sub-phase queue
- 9a1: done
- 9a2: done
- 9b1: done
- 9b2: done
- 9b3: done
- 9b4: done
- 9c1: done
- 9d1: done
- 9e: done
- 9f: merged into 9e
- 9g1: done
- 9g2: done
- 9h1: done      (relative images resolve against the document origin; dir permission for opened files)
- 9h2: planned      (api: D1 assets + asset_chunks (1 MB chunks), POST /api/rooms/:room/assets edit/owner only, GET /api/a/:id, png/jpeg/gif/webp, ≤2 MiB, 50 MB/room)
- 9h3: pending      (paste/drop: shared → D1 upload; unshared + dir access → assets/; else data:; privacy policy line)
- 9h4: pending      (deploy worker + D1 migration + smoke upload/read)
