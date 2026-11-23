# Design: Phase 23 — Bình luận + AI xử lý góp ý
Author: winwin1808. Status: in-progress. Phase: 23

Intent: docs/superpowers/intent/2026-11-23-phase-23-binh-luan-ai.md
Brainstorm: docs/superpowers/intent/2026-11-23-phase-23-binh-luan-ai-va-xuat-nhe-brainstorm.md

Ship: *chọn chữ → bình luận; bình luận đồng bộ cho chủ, link sửa, link xem (cả web); AI qua MCP đọc bình luận,
sửa nội dung, trả lời và resolve.* Phiên bản: extension 1.6.0, `le-sach-mcp` 1.4.0.

## Sub-phase queue

- 23a1 — done — core: mô hình bình luận + neo
- 23a2 — done — core: `formatVersion` 3, migration, làm gọn giữ bình luận
- 23a3 — done — core: `data-sp` trong render + ánh xạ vùng chọn → source
- 23b1 — done — ui: `CommentsPanel`
- 23b2 — done — ui: `CommentLayer` cho Viewer (chọn chữ, tô, mốc lề)
- 23b3 — done — ui: bình luận trong editor live preview
- 23c — done — extension: `useComments` + gắn App
- 23d1 — done — api: luật peer-guard cho bình luận
- 23d2 — done — api: kết nối link xem được gửi update bình luận
- 23e — done — web: bình luận ở `/s/:token` (xem + sửa)
- 23f1 — done — core bridge + `le-sach-mcp`: ba tool bình luận
- 23f2 — done — extension: thực thi tool bình luận
- 23g1 — done — e2e cộng tác + MCP thật
- 23g2 — done — docs, ROADMAP, phiên bản
- 23h1 — done — site: trang ghi chú phát hành `changelog.html`
- 23h2 — done — extension: "Có gì mới" trỏ tới trang phát hành + test đồng bộ phiên bản
- 23i1 — done — ui: độ rộng "Rộng" = ~80% bề ngang màn hình (Đọc + Sửa)
- 23i2 — done — extension: nút toolbar bật/tắt chế độ rộng
- 23i3 — done — ui/extension: sửa sau review 23i
- 23j1 — pending — core: `DocStyle` + Word theo kiểu tài liệu
- 23j2 — pending — ui: `docStyleCss` + export HTML theo kiểu
- 23j3 — pending — ui: chọn kiểu tài liệu trong Cài đặt
- 23j4 — pending — extension: áp kiểu tài liệu cho đọc, sửa, PDF, HTML, Word

## Approach chosen

**Bình luận là một root `Y.Map "comments"` phẳng trong cùng Y.Doc, mỗi khoá là một mục JSON bất biến
(ContentAny), neo bằng `Y.RelativePosition` trên `Y.Text "source"`.** Đồng bộ, lưu IDB, lưu DO, sao lưu `.zip`
đều đi theo cơ chế sẵn có; peer-guard kiểm được "chỉ ghi phần của mình" bằng khoá + clientID của struct.

Đã loại:
- **Bảng D1 + REST riêng cho bình luận** — không realtime, thêm hạn mức/đọc-ghi D1 trên gói Free, tách nguồn sự
  thật khỏi Y.Doc (trái §2.1), intent cấm.
- **Subdoc Yjs cho bình luận** — `y-partyserver` + peer-guard + y-indexeddb chưa từng xử lý subdoc trong repo;
  thêm rủi ro đồng bộ mà lợi ích (tách tải) không cần ở cỡ tài liệu Markdown.
- **Neo theo số dòng / heading** — trôi khi sửa phía trên; `RelativePosition` bám đúng ký tự qua mọi sửa đổi CRDT.
- **Y.Map lồng cho từng thread** — peer-guard phải đi sâu nhiều tầng parent; mục phẳng bất biến đơn giản hơn để kiểm.

## Quyết định cho câu hỏi mở (giả định đã chốt)

1. Cấu trúc: `Y.Map "comments"` cấp gốc, khoá phẳng (xem 23a1). Không lồng.
2. Neo: `Y.RelativePosition` (assoc start = 0, end = -1) mã hoá base64. Chế độ Đọc ánh xạ vùng chọn DOM → offset
   source qua thuộc tính `data-sp` trên khối (23a3). Không cần spike: mdast đã có `position.start/end.offset`.
3. Đoạn neo bị xoá hết (from ≥ to sau khi resolve) → thread "mồ côi": `range: null`, hiện cuối panel kèm `quote`
   lưu lúc tạo, vẫn trả lời/resolve được.
4. Danh tính: extension dùng tên hiển thị trong Cài đặt → Cộng tác (`displayName` đang dùng cho presence); web
   dùng `readName()` của `EditPage` (dời ra `apps/web/src/name.ts` dùng chung cho `SharePage`); chưa có tên → ô
   nhập tên ngay trong hộp bình luận. Tên chỉ là tự khai, như presence (§8 phase 8).
5. Thu hồi link **không** xoá bình luận đã viết qua link đó.
6. `restoreCheckpoint` **không** đụng bình luận (đã đúng: chỉ ghi `source`). Bình luận có neo trong đoạn bị
   khôi phục mất chữ sẽ thành mồ côi — chấp nhận.
7. Không sửa nội dung bình luận (xoá rồi viết lại). Không @mention, không reaction, không thông báo.
8. Chủ tài liệu (extension, tài liệu cục bộ hoặc kết nối chủ) xoá được mọi bình luận (kiểm duyệt). Link sửa:
   resolve/mở lại mọi thread, chỉ xoá bình luận của mình. Link xem: viết bình luận/trả lời, resolve/mở lại và xoá
   **chỉ** mục của chính link đó.
9. Bình luận không vào export (HTML/PDF/Word/slide) và không vào content script.

---

## 23a1 — core: mô hình bình luận + neo

**Package:** `packages/core` (thuần TS + yjs — đúng §2.4). Files: `src/comments/comments.ts` (mới),
`src/comments/comments.test.ts` (mới), `src/index.ts`.

Khoá trong `Y.Map "comments"`:
- `c:<clientID>:<rand8>` → `CommentEntry` (bình luận gốc hoặc trả lời). `<clientID>` = `doc.clientID` lúc ghi,
  `<rand8>` = 8 ký tự `[a-z0-9]`.
- `s:<threadId>` → `CommentState` (trạng thái resolve của thread; ghi đè = last-writer-wins của Y.Map).

```ts
export const COMMENTS_ROOT = 'comments'
export const COMMENT_BODY_MAX = 4000
export const COMMENT_QUOTE_MAX = 300
export const COMMENT_AUTHOR_MAX = 40

export interface CommentAnchor { start: string; end: string; quote: string } // start/end: base64 Y.RelativePosition
export interface CommentEntry {
  v: 1
  thread: string | null        // null = bình luận gốc; khác null = id thread gốc (trả lời)
  author: string
  clientId: number             // = clientID trong khoá; peer-guard kiểm khớp struct
  ts: number
  body: string
  anchor?: CommentAnchor       // chỉ bình luận gốc
}
export interface CommentState { resolved: boolean; by: string; clientId: number; ts: number }

export interface CommentReply { id: string; author: string; clientId: number; ts: number; body: string }
export interface CommentThread {
  id: string; author: string; clientId: number; ts: number; body: string
  quote: string
  range: { from: number; to: number } | null   // null = mồ côi
  resolved: boolean; resolvedBy: string | null
  deleted: boolean                              // gốc đã xoá nhưng còn trả lời
  replies: CommentReply[]                       // theo ts tăng dần
}

export function getComments(doc: Y.Doc): Y.Map<unknown>
export function addComment(doc: Y.Doc, input: { author: string; body: string; from: number; to: number; now?: number }): string
export function replyComment(doc: Y.Doc, threadId: string, input: { author: string; body: string; now?: number }): string
export function setResolved(doc: Y.Doc, threadId: string, resolved: boolean, by: string, now?: number): void
export function deleteComment(doc: Y.Doc, id: string): void
export function listThreads(doc: Y.Doc): CommentThread[]
export function commentKeyClient(key: string): number | null       // 'c:123:ab' → 123; 's:c:123:ab' → 123; khác → null
export function validateCommentValue(key: string, value: unknown): string | null  // null = hợp lệ, còn lại = mã lỗi
```

Hành vi:
- `addComment`: `from < to`, cả hai trong `[0, source.length]`, `body.trim()` không rỗng; cắt `body` ở
  `COMMENT_BODY_MAX`, `author` ở `COMMENT_AUTHOR_MAX`, `quote` = `source.slice(from,to)` cắt ở `COMMENT_QUOTE_MAX`.
  Sai → `throw new RangeError('comment_range' | 'comment_empty')`. Trả id.
- `replyComment`: thread không tồn tại → `RangeError('comment_thread')`. Trả lời của trả lời không có (thread luôn trỏ gốc).
- `deleteComment(id)` xoá khoá `id`; nếu là gốc không còn trả lời thì xoá cả `s:<id>`.
- `listThreads`: gom theo `thread`; gốc đã xoá nhưng còn trả lời → `deleted: true`, `body: ''`. Sắp: có `range`
  theo `range.from` rồi `ts`; mồ côi cuối, theo `ts`. Mục sai dạng (`validateCommentValue` ≠ null) bị bỏ qua, không throw.
- `validateCommentValue`: khoá `c:` → `CommentEntry` đúng kiểu, `v === 1`, `clientId === commentKeyClient(key)`,
  độ dài trong trần, `anchor` có ⇔ `thread === null`, `anchor.start/end` là base64 ≤ 128 ký tự. Khoá `s:` →
  `CommentState` đúng kiểu, `threadId` sau `s:` có dạng khoá `c:`. Khoá khác → `'comment_key'`.
- Mọi ghi trong một `doc.transact`.

Test phải chứng minh: thêm/trả lời/resolve/xoá; neo bám đúng khi chèn/xoá chữ trước, trong, sau vùng; xoá hết
vùng → `range: null`; **hội tụ** hai replica (cùng thêm bình luận, cùng resolve khác giá trị → cùng kết quả);
`validateCommentValue` từ chối từng trường sai (clientId lệch khoá, body quá dài, anchor ở trả lời, khoá lạ).

## 23a2 — core: `formatVersion` 3, migration, làm gọn giữ bình luận

**Package:** `packages/core`. Files: `src/doc/schema.ts`, `src/doc/doc.ts`, `src/doc/compact.ts`,
`src/doc/migrate.test.ts`, `src/doc/fixtures/v2-doc.json` (fixture mới, không phải file test).

- `FORMAT_VERSION = 3`. `schema.ts` thêm `'comments'` vào danh sách root.
- `migrateDoc`: v2 → v3 chỉ đặt `meta.formatVersion = 3` (root `comments` tạo lười). v1 → v3 đi qua v2 như cũ.
  Trả `{ from, to }` như hiện tại.
- Fixture `v2-doc.json` = `{ "update": "<base64 Y.encodeStateAsUpdate của doc v2 có source + history + actors>" }`;
  test: nạp fixture → `migrateDoc` → `{from:2,to:3}`, `source`/`history`/`actors` nguyên vẹn, `listThreads` = `[]`.
- Peer qua link (web) **không** chạy migrate (đã đúng: chỉ extension gọi); hàm bình luận chạy trên doc mọi version.
- `compact.ts` (Làm gọn tài liệu): trước khi dựng doc mới, `listThreads` lấy `range` tuyệt đối; sau khi chép
  `source`, ghi lại mỗi mục `c:` với `anchor.start/end` tạo từ offset trên `Y.Text` mới (giữ id, author, ts, body,
  quote); mồ côi giữ anchor cũ (vẫn mồ côi); chép nguyên các mục `s:`. Test trong file test compact hiện có
  (không thêm file test mới ngoài `migrate.test.ts` đã có).

## 23a3 — core: `data-sp` trong render + ánh xạ vùng chọn → source

**Package:** `packages/core`. Files: `src/render/render.ts`, file sanitize schema (cùng thư mục render/parse đang
khai `rehype-sanitize`), `src/comments/anchor-map.ts` (mới), `src/comments/anchor-map.test.ts` (mới), `src/index.ts`.

```ts
// RenderOptions thêm:
sourcePositions?: boolean   // mặc định false → output y hệt hiện tại (content script, export không đổi)

export interface SourceBlock { start: number; end: number }   // đọc từ data-sp="start:end"
export function parseSourcePos(attr: string | null): SourceBlock | null
export function selectionToSourceRange(
  source: string, block: SourceBlock, selectedText: string, occurrence: number,
): { from: number; to: number; exact: boolean }
```

- Bật `sourcePositions`: mỗi phần tử hast sinh từ node mdast khối (`paragraph`, `heading`, `listItem`,
  `blockquote`, `code`, `table`, `tableRow`, `thematicBreak`, `math`, `html` đã sanitize) có
  `data-sp="<position.start.offset>:<position.end.offset>"`. Schema sanitize cho phép `dataSp` trên các thẻ đó
  (chỉ khớp `^\d+:\d+$`).
- `selectionToSourceRange`: tìm lần xuất hiện thứ `occurrence` (0-based) của `selectedText` trong
  `source.slice(block.start, block.end)` → `exact: true`. Không thấy → so khớp bỏ qua khác biệt khoảng trắng và
  ký tự đánh dấu Markdown (`*_~\``, `[`, `](…)`); vẫn không thấy → trả cả khối `{from: block.start, to: block.end, exact: false}`.
- Test: đoạn thường, chữ trong `**đậm**`, link, mục danh sách, ô bảng, chữ lặp hai lần (occurrence 1), không khớp
  → cả khối; render với `sourcePositions: false` khớp snapshot HTML cũ.

## 23b1 — ui: `CommentsPanel`

**Package:** `packages/ui` (React, không `chrome.*`). Files: `src/components/CommentsPanel.tsx` (mới),
`src/components/CommentsPanel.test.tsx` (mới), `src/theme/comments.css` (mới, import từ `viewer.css` đầu file
như `tour.css`), `src/i18n/catalog/shell.ts`, `src/index.ts`.

```ts
export interface CommentsPanelProps {
  threads: CommentThread[]
  me: { clientIds: number[]; canModerate: boolean; canResolveAll: boolean }
  activeId: string | null
  onSelect(id: string): void
  onReply(threadId: string, body: string): void
  onResolve(threadId: string, resolved: boolean): void
  onDelete(id: string): void
  onClose(): void
  now?: () => number
}
export function CommentsPanel(props: CommentsPanelProps): JSX.Element
```

- Lọc "Đang mở (n)" / "Đã xong (n)" (mặc định Đang mở). Mỗi thread: đoạn trích (italic, cắt 2 dòng), tác giả,
  thời gian tương đối, nội dung (văn bản thuần, `white-space: pre-wrap`, **không** render Markdown/HTML), trả lời,
  ô trả lời (Enter gửi, Shift+Enter xuống dòng), nút Resolve/Mở lại, Xoá (chỉ hiện khi được phép).
- Được resolve: `canResolveAll` hoặc `clientId` gốc ∈ `me.clientIds`. Được xoá: `canModerate` hoặc `clientId` ∈ `me.clientIds`.
- Mồ côi: nhóm "Đoạn chữ đã bị xoá" cuối danh sách. Rỗng: lời nhắc "Chọn một đoạn chữ rồi bấm Bình luận".
- Phong cách như panel Lịch sử (cùng token, cùng kiểu drawer phải), bàn phím: ↑/↓ giữa thread, Enter chọn, Esc đóng.
- i18n vi + en cho mọi chuỗi (`comments.*`).
- Test: lọc, quyền nút, trả lời gửi đúng, nội dung chứa `<img onerror>` hiện dạng chữ, mồ côi, bàn phím.

## 23b2 — ui: `CommentLayer` cho Viewer

**Package:** `packages/ui`. Files: `src/components/CommentLayer.tsx` (mới), `src/components/CommentLayer.test.tsx`
(mới), `src/theme/comments.css`, `src/index.ts`. **Không sửa `Viewer.tsx`** (Viewer có trong bundle content script —
giữ content.js không đổi).

```ts
export interface CommentLayerProps {
  container: HTMLElement | null           // phần tử gốc của Viewer
  source: string
  threads: CommentThread[]
  activeId: string | null
  enabled: boolean                        // false: không nút, không tô (ví dụ đang xem mốc lịch sử)
  onCreate(range: { from: number; to: number }, body: string, author?: string): void
  onSelect(id: string): void
  askName: boolean                        // true: hộp bình luận có ô "Tên của bạn"
}
export function CommentLayer(props: CommentLayerProps): JSX.Element | null
```

- Chọn chữ trong `container` → nút nổi "Bình luận" cạnh vùng chọn → hộp nhập (textarea, Gửi/Huỷ, Ctrl/Cmd+Enter gửi).
  Ánh xạ: khối gần nhất có `data-sp` của đầu và cuối vùng chọn; cùng khối → `selectionToSourceRange` với
  `occurrence` = số lần `selectedText` xuất hiện trong `textContent` khối trước vùng chọn; khác khối → `from` = ánh
  xạ đầu, `to` = `end` của khối cuối.
- Tô: thread mở có `range` → tìm khối giao `range`, trong đó tìm `quote` ở `textContent` để tạo `Range` → đăng ký
  `CSS.highlights.set('mdr-comment', new Highlight(...))` và `'mdr-comment-active'`; không tìm thấy quote → viền trái
  khối. Trình duyệt không có `CSS.highlights` → chỉ viền khối.
- Mốc lề: chấm + số thread ở lề phải của khối đầu mỗi thread (lớp tuyệt đối trên container, cập nhật bằng
  `ResizeObserver`); bấm mốc → `onSelect`. Bấm chữ đang tô → `onSelect`.
- Test (jsdom, stub `CSS.highlights`): chọn chữ → nút → gửi gọi `onCreate` đúng range; khác khối; `enabled=false`
  không hiện nút; mốc lề gọi `onSelect`.

## 23b3 — ui: bình luận trong editor live preview

**Package:** `packages/ui`. Files: `src/live/comments.ts` (mới), `src/live/comments.test.ts` (mới),
`src/live/index.ts`, `src/components/Editor.tsx`.

```ts
export interface EditorCommentsConfig {
  threads: CommentThread[]
  activeId: string | null
  onCreate(range: { from: number; to: number }): void   // mở hộp bình luận ở host
  onSelect(id: string): void
}
// EditorProps thêm: comments?: EditorCommentsConfig
export function commentsExtension(get: () => EditorCommentsConfig): Extension
```

- Decoration mark `cm-comment` (và `cm-comment-active`) cho thread mở có `range`; cập nhật khi `threads` đổi
  (StateEffect), không dựng lại view.
- Có vùng chọn khác rỗng → tooltip CM6 "Bình luận" → `onCreate({from,to})` (offset CM = offset `source` vì CM
  bind trực tiếp `Y.Text`). Host (extension/web) dùng cùng hộp nhập với 23b2 (`CommentComposer` export từ
  `CommentLayer.tsx`).
- Bấm vào chữ có decoration → `onSelect`.
- Test: decoration đúng vị trí, cập nhật khi threads đổi, tooltip gọi `onCreate`.

## 23c — extension: `useComments` + gắn App

**Package:** `apps/extension`. Files: `src/app/hooks/useComments.ts` (mới), `src/app/hooks/useComments.test.ts`
(mới), `src/app/App.tsx`, `src/app/app.css`, `packages/ui/src/i18n/catalog/ext.ts`.

```ts
export function useComments(doc: Y.Doc | null, actor: string, opts: { shared: boolean }): {
  threads: CommentThread[]; openCount: number
  activeId: string | null; setActive(id: string | null): void
  create(range: { from: number; to: number }, body: string): void
  reply(threadId: string, body: string): void
  resolve(threadId: string, resolved: boolean): void
  remove(id: string): void
  me: CommentsPanelProps['me']
}
```

- Quan sát `getComments(doc)` + `source` (deep observe, debounce 120 ms như re-parse) → `listThreads`.
- `me`: `clientIds` = mọi clientID của máy này đã ghi trong `meta.actors` dưới `actor` cộng `doc.clientID`;
  `canModerate: true`, `canResolveAll: true` (chủ tài liệu).
- App: mục menu "Bình luận" (icon mới, phím tắt Cmd/Ctrl+Shift+M) mở drawer `CommentsPanel` (loại trừ lẫn nhau với
  drawer Lịch sử); badge số thread mở trên nút; `renderHtmlFor` bật `sourcePositions: true`; `CommentLayer` trên
  Viewer chế độ Đọc; `comments` config cho Editor chế độ Sửa; chọn thread → cuộn khối/đưa con trỏ CM tới
  `range.from`. Đang xem mốc lịch sử → `enabled: false`.
- Test hook: tạo/trả lời/resolve/xoá qua hook cập nhật `threads`; đổi doc reset `activeId`.

## 23d1 — api: luật peer-guard cho bình luận

**Package:** `apps/api` (import `validateCommentValue`, `commentKeyClient`, `COMMENTS_ROOT` từ `@md-reader/core`).
Files: `src/peer-guard.ts`, `src/peer-guard.test.ts`.

```ts
export type PeerRole = 'view' | 'edit'
export function peerUpdateViolation(update: Uint8Array, doc: Y.Doc, own: PeerOwnership, role: PeerRole): string | null
```

Luật (thêm vào luật hiện có, kiểm trước khi áp như phase 14):
- Struct mới có parent là root `comments` (Y.Map, `parentSub` = khoá):
  - content phải là ContentAny một phần tử, `validateCommentValue(key, value) === null`.
  - khoá `c:` → `commentKeyClient(key)` = clientID của struct **và** clientID đó thuộc `own`.
  - khoá `s:` → `edit`: mọi thread; `view`: chỉ khi `commentKeyClient(threadId)` thuộc `own`.
- Xoá (delete set) item trong `comments`: được khi người gửi được phép ghi khoá đó theo luật trên (ghi đè `s:` của
  người khác bởi `edit` hợp lệ); xoá `c:` chỉ khi khoá thuộc `own`.
- Role `view`: mọi struct/xoá ngoài `comments` (kể cả `source`, `meta.actors`) → vi phạm `'view_write'`. Tức link
  xem **không** ghi `meta.actors`; tên tác giả nằm trong `CommentEntry.author`.
- Role `edit`: luật cũ cho `source` + `meta.actors` giữ nguyên + luật `comments`.
- Test: mỗi luật một ca hợp lệ + một ca vi phạm; `view` ghi `source` → vi phạm; giả clientId trong value → vi
  phạm; `view` resolve thread người khác → vi phạm; `edit` resolve thread người khác → hợp lệ; body 4001 ký tự →
  vi phạm; xoá bình luận người khác → vi phạm.

## 23d2 — api: kết nối link xem gửi được update bình luận

**Package:** `apps/api`. Files: `src/room.ts`, `src/room.test.ts`.

- `room.ts:230` hiện chặn toàn bộ `step2`/`update` của kết nối read-only. Đổi: kết nối `view` gửi `update` →
  qua `peerUpdateViolation(..., 'view')` như đường `edit` (cùng chỗ gọi `room.ts:253`, cùng `owner:<clientID>`
  gắn theo link prefix, cùng trần message/phòng, cùng đóng 4403 khi vi phạm). `step2` từ `view` vẫn bị bỏ (client
  view không là nguồn đồng bộ đầy đủ).
- Link xem hết hạn/thu hồi: giữ nguyên kiểm mỗi message (phase 11c).
- Kết nối chủ (không qua token link) giữ nguyên hành vi hiện tại.
- Test: view gửi update bình luận hợp lệ → được áp + phát cho peer khác; view gửi update `source` → 4403, không
  phát, không lưu; view đã thu hồi → bị từ chối như cũ.

## 23e — web: bình luận ở `/s/:token`

**Package:** `apps/web`. Files: `src/SharePage.tsx`, `src/EditPage.tsx`, `src/name.ts` (mới — dời `readName`/
`writeName` từ `EditPage`), `src/web.css`, `src/comments.test.tsx` (mới).

- Cả hai trang: render với `sourcePositions: true`; nút "Bình luận (n)" mở `CommentsPanel`; `CommentLayer` trên
  Viewer; EditPage chế độ Sửa truyền `comments` cho Editor.
- `me`: `clientIds` = clientID của doc phiên hiện tại; `canModerate: false`; `canResolveAll` = trang Sửa.
  (Bình luận viết ở phiên trước qua cùng link vẫn được peer-guard coi là "của mình" nhờ `owner:<clientID>`;
  UI web chỉ nhận diện phiên hiện tại — chấp nhận: không hiện nút Xoá cho mục phiên cũ.)
- SharePage dùng provider hiện có, cho phép gửi update cục bộ (chỉ mục bình luận được tạo qua API core).
  Bị đóng 4403 → `Notice` "Không gửi được bình luận" và nối lại ở chế độ chỉ đọc.
- Chưa có tên → `askName: true`; tên lưu bằng `writeName`.
- Phòng đầy (phase 14, `full`) → nút Bình luận vô hiệu, tooltip giải thích.
- Test: SharePage hiện panel + tạo bình luận ghi vào doc; EditPage resolve thread của người khác; nội dung HTML
  hiện dạng chữ.

## 23f1 — core bridge + `le-sach-mcp`: ba tool bình luận

**Package:** `packages/core` (bridge) + `packages/mcp`. Files: `packages/core/src/bridge/protocol.ts`, test
protocol hiện có, `packages/mcp/src/tools.ts`, `packages/mcp/src/tools.test.ts`, `packages/mcp/package.json`.

```ts
// BridgeTool thêm: 'list_comments' | 'reply_comment' | 'resolve_comment'
// args:
list_comments   { docId: string; status?: 'open' | 'all' }                 // mặc định 'open'
reply_comment   { docId: string; threadId: string; body: string }          // body 1..4000
resolve_comment { docId: string; threadId: string; reply?: string }        // reply tuỳ chọn, gửi trước rồi resolve
// kết quả:
list_comments   → { comments: Array<{ threadId: string; quote: string; currentText: string | null;
                    line: number | null; status: 'open' | 'resolved'; author: string; ts: string;  // ISO
                    body: string; replies: Array<{ author: string; ts: string; body: string }> }> }
reply_comment   → { ok: true; id: string }
resolve_comment → { ok: true }
```

- `validateToolArgs` kiểm như tool cũ. `BRIDGE_PROTOCOL` giữ 2 (thêm tool không đổi giao thức).
- Mô tả tool cho AI (tiếng Anh) nói rõ luồng: `list_comments` → sửa bằng `update_doc` (dùng `currentText`/`line`
  để định vị) → `resolve_comment` với `reply` ngắn mô tả điều đã sửa.
- Extension cũ (≤ 1.5.1) không biết tool → lỗi `unknown_tool` hoặc hết giờ chờ: tool trả lỗi
  "This needs MD Reader extension 1.6.0 or newer".
- `le-sach-mcp` 1.4.0 (`package.json` + `VERSION`).
- Test: args hợp lệ/không hợp lệ cho cả ba; MCP chuyển đúng tool sang bridge; thông báo lỗi bản cũ.

## 23f2 — extension: thực thi tool bình luận

**Package:** `apps/extension` + một hàm core. Files: `apps/extension/src/app/bridge-executor.ts`, test executor
hiện có, `packages/core/src/doc/apply-as.ts`, `packages/core/src/index.ts`.

```ts
// core/doc/apply-as.ts
export function commentAsActor<T>(doc: Y.Doc, actorClientId: number, fn: (d: Y.Doc) => T): T
```

- `commentAsActor` theo đúng khuôn `applyTextChangeAsActor`: thực hiện `fn` trên doc tạm có `clientID` của tác giả
  AI rồi áp update vào `doc`, để mục `c:<clientID AI>:…` mang clientID AI (blame/tác giả đúng, peer-guard của
  phòng chủ không áp vì là kết nối chủ).
- `list_comments`: `listThreads` → map sang kết quả 23f1; `currentText` = `source.slice(range)` (null nếu mồ côi),
  `line` = số dòng 1-based của `range.from`.
- `reply_comment` / `resolve_comment`: tác giả = tên client MCP đã ghép (như `update_doc`); **không** hỏi xác nhận
  (quyết định người dùng); chờ ghi IDB như `update_doc`; thread không tồn tại → lỗi `comment_thread`.
- Test: ba tool trên doc có bình luận; tác giả là tên client AI; thread sai → lỗi; resolve kèm reply tạo trả lời trước.

## 23g1 — e2e cộng tác + MCP thật

Files: `apps/extension/e2e-pw/comments.spec.ts` (mới), kịch bản collab trong bộ e2e:collab hiện có (một file),
helper e2e nếu cần (≤ 3 file tổng thêm).
- Collab (`wrangler dev`): chủ chia sẻ link xem + link sửa; trang web link xem chọn chữ → bình luận → chủ thấy
  trong panel; link sửa resolve → link xem thấy "Đã xong"; link xem thử ghi `source` bằng update giả → bị đóng 4403.
- MCP thật: tài liệu cục bộ có bình luận → `list_comments` trả đúng → `update_doc` + `resolve_comment` với reply →
  panel extension hiện resolved + trả lời của client AI.

## 23g2 — docs, ROADMAP, phiên bản

Files: `docs/MCP.md`, `docs/MCP.en.md`, `docs/ROADMAP.md`, `docs/ROADMAP.en.md`, `apps/extension` manifest/
package.json + `release-notes.ts` (1.6.0, `showOnUpdate: true`), `MCP_PACKAGE_SPEC` = `le-sach-mcp@1.4.0`,
privacy (`docs/store/privacy-policy.md`, `site/privacy.html`): bình luận được lưu cùng tài liệu chia sẻ trên máy chủ,
người có link xem viết được bình luận. Có thể tách 23g2a (docs) / 23g2b (phiên bản) lúc plan nếu > 5 file.

---

## Rủi ro

- **Spam bình luận qua link xem công khai.** Giới hạn hiện có: 16 MiB/message, 64 MiB/phòng, 4 clientID mới/kết
  nối, báo cáo nội dung. Chưa thêm hạn mức riêng; ghi vào nợ nếu e2e/smoke thấy cần.
- **Peer-guard mở thêm đường ghi cho role `view`.** Đây là thay đổi bảo mật lớn nhất phase; 23d1 làm pure function có
  test âm cho từng luật, 23d2 chỉ nối dây. Review 23d* phải kiểm bằng update tự dựng (không qua API core).
- **Client cũ (≤ 1.5.1) mở tài liệu `formatVersion` 3**: banner "phiên bản mới hơn" (phase 13) — đọc/sửa vẫn được,
  bình luận bị bỏ qua, không hỏng dữ liệu.
- **Ánh xạ vùng chọn ở chế độ Đọc không chính xác** với cú pháp phức tạp → rơi về cả khối (`exact: false`); vẫn
  bình luận được, chỉ neo rộng hơn.

## Kiểm cuối phase

`pnpm --filter core test` · `--filter ui` · `--filter extension` · `--filter web` · `--filter api` ·
`--filter le-sach-mcp`; typecheck/build 0; content.js gz không tăng so với 13.66 KB; e2e + e2e:collab xanh.


## 23h — Trang ghi chú phát hành (bổ sung 2026-11-23, theo yêu cầu người dùng, vào cùng MR #25)

Người dùng cần một trang công khai thông báo tính năng mới mỗi lần đưa bản mới lên store. Đã có sẵn trang "Có gì mới" TRONG extension
(`app.html?whatsnew=1`, `WhatsNewPage`, dữ liệu `apps/extension/src/shared/release-notes.ts`, tự mở một lần khi cập nhật có `showOnUpdate: true`).
Thiếu: trang công khai (link được từ store listing, README, GitHub Release) và đường nối giữa hai trang.

- **23h1 — site:** `site/changelog.html` tĩnh, song ngữ vi/en theo khuôn `privacy.html` (cùng `style.css`, `lang.js`, header/nav, script chọn ngôn ngữ).
  Mỗi phiên bản một `<section id="v<x.y.z>">` (1.6.0 → 1.3.0, lấy từ `CHANGELOG.md` + `release-notes.ts`), 1.6.0 mở đầu bằng khối nổi bật
  (bình luận, AI xử lý góp ý). Link "Có gì mới / What's new" trong nav của `index.html` và `privacy.html`. Deploy theo workflow Pages có sẵn (`site/**`).
- **23h2 — extension:** `RELEASE_NOTES_URL = 'https://winwin1808.github.io/md-reader/changelog.html'` cạnh `HELP_URL`; `WhatsNewPage` thêm link
  "Xem toàn bộ ghi chú phát hành" → `RELEASE_NOTES_URL#v<phiên bản mới nhất>`; test đồng bộ: mọi `version` trong `RELEASE_NOTES` có `id="v<version>"`
  trong `site/changelog.html` (quên cập nhật trang khi ra bản mới → test đỏ).
- Ngoài phạm vi: tag `v1.6.0` + GitHub Release (làm sau khi merge vào `main`, trỏ về trang này).


## 23i — Chế độ rộng ~80% bề ngang (bổ sung 2026-11-23, theo yêu cầu người dùng, vào MR #25)

Đã có `pageWidth: 'narrow'|'medium'|'wide'|'full'` (Cài đặt → Hiển thị), áp qua `data-width` trên `.app-container`; `wide` hiện chỉ là
`--measure: 104ch`, còn bị `max-width` của `.a4-document-container` / `.editor-live-sheet` / `.app-layout` giới hạn. Quyết định: **đổi nghĩa
`wide` thành tờ giấy rộng tối đa 80vw** (không thêm giá trị mới → không đổi kiểu `PageWidth`, không cần migration cài đặt), nhãn "Rộng (80%)".
Thêm nút toolbar bật/tắt nhanh, nhớ độ rộng trước đó để tắt thì quay lại. Web `/s/:token` giữ 820px (ngoài phạm vi).

## 23j — Kiểu tài liệu business / academic / technical (bổ sung 2026-11-23, theo yêu cầu người dùng, vào MR #25)

Mục ROADMAP v1.4 "Thêm giao diện tài liệu". Thêm cài đặt `docStyle: 'lesach' | 'business' | 'academic' | 'technical'` (mặc định `lesach` = giao diện
hiện tại), áp cho trang đọc, editor live, PDF (in trang sống), export HTML và Word. Chỉ dùng phông đã đóng gói (Literata, IBM Plex Sans/Mono) — không
tải phông ngoài. Kiểu `DocStyle` ở core (Word cần); CSS sinh bởi `docStyleCss(style, root)` ở ui, một nguồn cho app và export HTML. Kiểu khác `lesach`
quyết định phông thân bài → nhóm "Phông chữ" bị khoá kèm ghi chú. Slide/Present không đổi; web `/s/:token` hoãn. `print.css` vẫn ép chữ đen khi in.

- **23j1 — core:** `DocStyle`, `DOC_STYLES`, `isDocStyle`; `ExportDocxOptions.docStyle?` chọn bộ tham số Word (phông, màu heading, căn đều, giãn dòng, viền bảng).
- **23j2 — ui:** `docStyleCss(style, root)` + `getDefaultExportCss(style?)`.
- **23j3 — ui:** nhóm radio "Kiểu tài liệu" ở Cài đặt → Hiển thị, khoá nhóm phông khi khác `lesach`.
- **23j4 — extension:** `data-doc-style` + `<style>` chèn trong `.app-container`, `useExport` truyền `docStyle` cho HTML/Word.
