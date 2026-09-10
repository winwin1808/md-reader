# md-reader — Design (end-to-end)

Tài liệu design toàn sản phẩm. Đây là **nguồn chân lý về kiến trúc**; `CLAUDE.md`
chỉ tóm tắt và trỏ về đây. Spec từng phase do pipeline sinh ra trong
`docs/superpowers/specs/` phải nằm trong khuôn của tài liệu này.

Ngày: 2026-09-10 · Trạng thái: approved · Tác giả: haonq

---

## 1. Sản phẩm là gì

Chrome extension (MV3) để **đọc, trình bày, và về sau là cùng sửa** file
Markdown.

Hai đường vào, dùng chung một lõi:

```
*.md URL  ──content script──►  render tại chỗ, read-only
                               (view + theme + mermaid nếu CSP cho phép)

drag-drop / File System Access ──►  app page (tab riêng của extension)
                                    view · export · present · mindmap · edit
                                            │
                                    packages/core + packages/ui
```

Content script là "đọc nhanh cái đang mở". App page là "làm việc với tài liệu".
Mọi tính năng nặng sống ở app page vì ở đó CSP do mình kiểm soát.

### Không làm (non-goals)

- Không phải IDE hay thay thế Obsidian/Typora. Không plugin system.
- Không realtime trước phase 6. Không mobile. Không đồng bộ cloud storage
  (Drive/Dropbox) — file đến từ đĩa của người dùng hoặc từ URL.
- Không hỗ trợ Firefox/Safari trong phase 1-5. Code giữ portable (mọi lời gọi
  `chrome.*` gom trong `apps/extension`) nhưng không tốn công test.

---

## 2. Quyết định kiến trúc nền

### 2.1 Y.Doc là nguồn sự thật, không phải file

Đây là quyết định gốc, kéo theo gần hết phần còn lại.

```
Y.Doc
├─ Y.Text  "source"   markdown source — bản gốc thật sự
├─ Y.Map   "meta"     { title, formatVersion, originPath, originHash, createdAt }
└─ Y.Array "history"  append-only: { id, actor, ts, label, clientIds[] }
```

File `.md` trên đĩa là **cổng import/export**, không phải state. Mở file =
import vào `Y.Text`; lưu = serialize `Y.Text` ra file.

*Hệ quả phải xử lý, không được lờ đi:* Sau khi mở, file trên đĩa và Y.Doc có
thể lệch nhau. Chính sách (phase 5, nhưng `originHash` phải có từ phase 1):

- Lúc import, lưu `originHash` = SHA-256 của nội dung file.
- Trước khi ghi, hash lại file. Khớp → ghi đè. Lệch → **không ghi**, hiện
  diff ba chiều (đĩa / Y.Doc / tổ tiên chung) và bắt người dùng chọn.
- Không bao giờ tự merge im lặng nội dung từ đĩa vào Y.Doc.

**Vì sao Yjs ngay từ phase 1 dù phase 1 chưa có editor.** Phase 1 chỉ đọc, nên
Yjs lúc đó thuần overhead. Cái nó mua là: phase 5 (edit) và phase 6 (collab)
không phải viết lại doc-model, và mọi thứ đọc `Y.Text` ở phase 1 vẫn đúng
nguyên khi text bắt đầu thay đổi từ nhiều nguồn. Đổi lại phase 1 gánh ~40KB gz
và một lớp gián tiếp không sinh lợi ngay. Đây là đánh đổi đã chốt.

*Hướng đã loại:* **CodeMirror `ChangeSet`** — nhẹ hơn, đủ cho audit log, nhưng
multi-user phải tự viết tầng rebase, và đổi sang Yjs sau nghĩa là viết lại
doc-model đúng lúc codebase đã lớn nhất. **Snapshot + diff text** — rẻ nhất,
nhưng mất granularity actor, đúng thứ cần cho "trace ai sửa chỗ nào".

### 2.2 Persistence & provider

| Phase | Provider | Ghi ở đâu |
|---|---|---|
| 1-5 | `y-indexeddb` | IndexedDB trong extension origin |
| 6 | `y-indexeddb` + WebSocket provider tới `apps/api` | thêm Postgres phía server |

`packages/core` **không được biết provider nào đang chạy** — nó nhận vào một
`Y.Doc` đã bind sẵn. Việc chọn và gắn provider là của `apps/extension`
(phase 1-5) và `apps/web` (phase 6). Đây là thứ giữ cho phase 6 không phải
đụng vào core.

Ngoài Y.Doc, có một registry nhỏ trong IndexedDB: `docId → { name, originPath,
fileHandle?, lastOpenedAt }`, để app page liệt kê tài liệu gần đây và xin lại
quyền truy cập `FileSystemFileHandle`.

### 2.3 Attribution — "ai sửa chỗ nào"

Yjs cho sẵn `clientID` trên từng struct trong `Y.Text`. Ghép hai tầng:

- **Blame theo ký tự** — duyệt struct của `Y.Text`, map `clientID → actor` qua
  bảng trong `meta`. Cho ra các khoảng (range) kèm tác giả. Đây là dữ liệu
  luôn có sẵn, không cần ghi thêm gì.
- **Timeline theo mốc** — `Y.Array "history"` append một entry mỗi lần
  *checkpoint* (lưu file, hoặc khoảng lặng 30s sau chỉnh sửa), không phải mỗi
  phím gõ. Mỗi entry giữ `clientIds[]` xuất hiện trong khoảng đó.

Hai tầng vì blame trả lời "dòng này ai viết" còn timeline trả lời "hôm qua ai
đổi gì". Cả hai chỉ có UI ở phase 6; **schema phải đúng từ phase 1** vì đổi
schema Y.Doc sau khi có dữ liệu thật là migration đau.

Có `formatVersion` trong `meta` ngay từ đầu để migration về sau còn có chỗ bám.

### 2.4 Ranh giới package — ràng buộc cứng

```
packages/core       thuần TS. Được dùng yjs (chạy cả trên Node).
                    KHÔNG react · KHÔNG chrome.* · KHÔNG document/window
packages/ui         React. KHÔNG chrome.*
apps/extension      MV3. Lớp DUY NHẤT được dùng chrome.*
(phase 6) apps/api · apps/web
```

Ranh giới này tồn tại để phase 6 chạy được `packages/core` trên Node (render
preview cho share link) và `packages/ui` trong web app mà không viết lại.
Vi phạm là blocker cứng ở `review-before-ship`, không phải góp ý.

Import chéo package luôn bằng tên workspace (`@md-reader/core`), không bao giờ
bằng đường dẫn tương đối.

### 2.5 Parser: `unified` / `remark`

Cả bốn phase nội dung đều là biến đổi trên **cùng một mdast**:

| Tính năng | Biến đổi |
|---|---|
| View | mdast → hast → HTML |
| Auto-format | `remark-parse` → `remark-stringify` (round-trip) |
| Slide | cắt theo `thematicBreak` / `heading` depth N |
| Mindmap | cây từ node `heading` |
| DOCX | mdast → docx node |

`markdown-it` chỉ cho ra HTML nên bốn trong năm thứ trên phải parse lại. Chi
phí: remark chậm hơn ~2-3× — không đáng kể ở kích thước file .md.

GFM bật (`remark-gfm`): table, task list, strikethrough, autolink. Frontmatter
qua `remark-frontmatter`, đưa vào `meta`, không render.

**Không parse tăng tiến.** Re-parse toàn bộ, debounce 120ms sau mỗi thay đổi
`Y.Text`. Nếu benchmark ở phase 5 cho thấy file >500KB giật thì mới tối ưu —
YAGNI cho tới lúc đó.

Sanitize: `rehype-sanitize` với schema nới cho `<svg>` (mermaid, mindmap) và
class dùng cho highlight. Raw HTML trong markdown **mặc định tắt**, có toggle
"tin tài liệu này" lưu theo từng doc.

### 2.6 Theme

CSS custom properties, ba chế độ light / dark / system. Lưu
`chrome.storage.sync`. `packages/ui` chỉ đọc CSS var và không biết
`chrome.storage` tồn tại — `apps/extension` là lớp bơm giá trị vào.

Content script bọc **Shadow DOM** để CSS trang chủ không đè, đồng thời là dự
phòng cho vấn đề CSP ở mục 5.1.

---

## 3. Kiến trúc theo package

### `packages/core`

| Module | Trách nhiệm |
|---|---|
| `doc/` | Y.Doc schema, tạo/mở doc, import text→Y.Text, export Y.Text→text, `originHash`, history feed, blame |
| `parse/` | remark pipeline, mdast, frontmatter, sanitize schema |
| `render/` | mdast → hast → HTML string (dùng được cả trên Node cho phase 6) |
| `format/` | auto-format round-trip, config chuẩn hoá |
| `slides/` | mdast → `Slide[]` |
| `mindmap/` | mdast → `MindNode` tree |
| `export/` | HTML self-contained, mdast → docx |

Không module nào ở đây được biết mình đang chạy trong browser hay Node.

### `packages/ui`

`Viewer` · `Toc` · `ThemeProvider` · `MermaidBlock` · `ExcalidrawBlock` ·
`ExportDialog` · `Deck` + `SpeakerView` · `Mindmap` · `Editor` · `BlameGutter`
· `HistoryTimeline`.

Component nhận dữ liệu qua props, nhận `Y.Doc` qua context. Không component
nào tự đọc file, tự lưu, hay biết provider nào đang chạy.

### `apps/extension`

```
content/     bắt *.md, Shadow DOM, render read-only (KHÔNG dùng yjs)
app/         tab riêng: Y.Doc + y-indexeddb + toàn bộ UI
worker/      service worker: routing, chrome.storage, quản lý fileHandle
```

**Content script cố tình không dùng Yjs.** Nó chỉ đọc một lần và render — kéo
cả Yjs vào đó là gánh nặng vô ích trên mọi trang. Muốn làm gì hơn thì có nút
"Mở trong MD Reader" chuyển sang app page.

Manifest v3, permission tối thiểu: `storage`, content script match
`*://*/*.md`, `*://*/*.markdown`, `file:///*` (cần người dùng bật "Allow
access to file URLs"). Không `<all_urls>`. Không `declarativeNetRequest`.

---

## 4. Phases

Mỗi phase là một vòng `capture-intent → … → ship-and-handover` riêng, và phải
**ship được thứ dùng được** — không phase nào chỉ là hạ tầng.

### Phase 1 — Nền tảng & Trình đọc

Ship: *click link `.md` → đọc đẹp ngay; kéo file vào app page → đọc được và
lần sau mở lại vẫn còn.*

- Scaffold monorepo: pnpm workspace, tsconfig base, vitest, ba package rỗng
- `core/doc`: Y.Doc schema đầy đủ (source + meta + history), import/export
  text, `originHash`, `formatVersion` — **schema đúng ngay bây giờ**
- `core/parse` + `core/render`: remark + GFM + frontmatter + sanitize
- `core/format`: auto-format round-trip (chỉ preview, chưa ghi đè file)
- `ui`: `Viewer`, `Toc`, `ThemeProvider`, code highlight
- `extension/content`: Shadow DOM, render read-only, nút "Mở trong MD Reader"
- `extension/app`: drag-drop mở file, `y-indexeddb`, danh sách tài liệu gần đây
- `extension/worker`: theme qua `chrome.storage.sync`
- mermaid: lazy `import()`, render ở app page
- **SPIKE, task đầu tiên:** mermaid có sống nổi trong content script dưới CSP
  của trang chủ không (xem 5.1)

### Phase 2 — Export

Ship: *một tài liệu bất kỳ ra được HTML, PDF, Word.*

- HTML self-contained: inline CSS, SVG đã render, ảnh base64
- PDF: app page mở print view + `window.print()` với `@page` CSS. Không
  headless browser, không thư viện PDF
- Word: thư viện `docx`, map mdast→docx. Chart: SVG→canvas→PNG rồi nhúng
- `ExportDialog` trong `ui`; hàm export thuần trong `core/export` để phase 6
  gọi lại được từ server

### Phase 3 — Trình chiếu

Ship: *mở tài liệu, bấm Present, trình bày được.*

- `core/slides`: cắt theo `---` hoặc heading depth cấu hình được
- `Deck`: keyboard nav, progress, fullscreen
- `SpeakerView`: cửa sổ thứ hai, notes (`<!-- note: -->`), đồng hồ, slide kế
- Export deck → PDF dùng lại phase 2

### Phase 4 — Mindmap & Excalidraw

Ship: *nhìn cấu trúc tài liệu dạng cây, và xem được sơ đồ excalidraw nhúng.*

- `core/mindmap`: mdast heading → cây
- `Mindmap`: layout d3-hierarchy, zoom/pan, gập nhánh, click nhảy tới heading
- Excalidraw: `@excalidraw/excalidraw` `viewMode`, lazy, **chỉ ở app page**;
  content script chỉ hiện placeholder
- Xuất mindmap ra PNG/SVG, nối vào phase 2

### Phase 5 — Chỉnh sửa

Ship: *sửa file và lưu lại đĩa an toàn.*

- CodeMirror 6 + `y-codemirror.next` bind vào `Y.Text`
- `Y.UndoManager`
- File System Access: mở folder, Save, Save As; xin lại quyền cho handle cũ
- **Phát hiện lệch file theo `originHash`** (mục 2.1) — có diff ba chiều, không
  bao giờ tự merge
- Format-and-save
- Split view: source ↔ preview, cuộn đồng bộ
- History feed bắt đầu ghi checkpoint

### Phase 6 — Chia sẻ & cộng tác

Ship: *gửi link cho người khác xem; rồi cho họ sửa; rồi xem ai sửa chỗ nào.*

Chia làm ba lần ship nhỏ, theo thứ tự:

1. **Share read-only** — `apps/api` (NestJS + Postgres) lưu Y update binary;
   `apps/web` render read-only bằng chính `core/render` chạy trên Node; link
   có token, có hạn dùng.
2. **Sửa cộng tác** — WebSocket provider, `awareness` (con trỏ + presence),
   phân quyền view / comment / edit trên từng link.
3. **Trace** — `BlameGutter` (blame theo ký tự, mục 2.3) và
   `HistoryTimeline` (checkpoint feed), tua lại được từng mốc.

Danh tính: phase 6.1 dùng tên tự khai lưu trong link token. Auth thật chỉ đặt
ra khi có nhu cầu thực — không dựng account system trước.

---

## 5. Rủi ro

### 5.1 CSP chặn mermaid trong content script — rủi ro cao, chưa xác minh

Content script chạy isolated world, nhưng `<style>`, web font và
`<foreignObject>` mà mermaid bơm vào DOM trang chủ **vẫn chịu CSP của trang
đó**. Trang có `style-src 'self'` chặt là hỏng.

Xử lý theo thứ tự: (a) render trong Shadow DOM với style inline hoá; (b) nếu
vẫn bị chặn — phát hiện bằng cách đo kích thước SVG sau render — degrade sang
placeholder + nút "Mở trong MD Reader"; (c) không bao giờ để trang trắng.

**Spike bắt buộc, task đầu tiên của phase 1.** Không stage nào được giả định
mermaid chạy được trong content script trước khi spike xong.

### 5.2 File `.md` bị server trả về dạng download

`Content-Disposition: attachment` thì Chrome tải xuống, content script không
bao giờ chạy. Không sửa được. Chấp nhận; app page là đường vòng.

### 5.3 Ngân sách bundle

Yjs ~40KB gz, excalidraw ~1MB, mermaid ~500KB, CodeMirror ~200KB. Quy tắc:
**content script ≤ 60KB gz** (không yjs, không mermaid trừ khi spike 5.1 cho
phép, không excalidraw). App page lazy-load mọi thứ nặng theo route. Vượt
ngưỡng content script là blocker ở `review-before-ship`.

### 5.4 Đổi schema Y.Doc sau khi có dữ liệu

Vì thế schema ở 2.1 phải đúng ngay phase 1 và có `formatVersion`. Mọi thay đổi
schema về sau bắt buộc kèm hàm migration + test trên fixture doc phiên bản cũ.

### 5.5 File System Access và quyền

Handle mất quyền sau khi đóng trình duyệt; phải xin lại qua cử chỉ người dùng.
Thiết kế UI phase 5 với giả định "quyền sẽ mất", không phải trường hợp hiếm.

---

## 6. Test

| Nơi | Môi trường | Nội dung |
|---|---|---|
| `packages/core` | vitest, node | Gần hết logic nằm đây nên gần hết test nằm đây: snapshot mdast, round-trip auto-format, cắt slide, cây mindmap, output export, thao tác Y.Doc + hội tụ hai replica |
| `packages/ui` | vitest + testing-library, jsdom | Render, theme, tương tác |
| `apps/extension` | vitest | Chỉ logic thuần (URL matching, mapping storage). Không test `chrome.*` bằng mock sâu |
| E2E | Playwright load-unpacked | Từ phase 2 trở đi, một luồng khói mỗi phase |

Lệnh: `pnpm --filter core test` · `--filter ui` · `--filter extension`.

Với `core/doc`, mỗi tính năng phải có ít nhất một test **hội tụ**: hai Y.Doc
sửa rời nhau, đồng bộ, phải ra cùng một kết quả. Đây là thứ bắt lỗi doc-model
trước khi phase 6 tới.

---

## 7. Bảng tra quyết định

| Quyết định | Chốt | Loại bỏ |
|---|---|---|
| Nguồn sự thật | Y.Doc (Yjs) từ phase 1 | CM6 ChangeSet · snapshot diff |
| Parser | unified/remark | markdown-it |
| Persistence local | y-indexeddb | localStorage · chrome.storage |
| PDF | print CSS + `window.print()` | thư viện PDF · headless |
| Word | thư viện `docx` từ mdast | HTML→Word |
| Mindmap layout | d3-hierarchy | markmap trọn gói |
| Excalidraw | chỉ app page, viewMode, lazy | render trong content script |
| Editor | CodeMirror 6 + y-codemirror.next | Monaco · ProseMirror |
| Yjs trong content script | Không | Có |
