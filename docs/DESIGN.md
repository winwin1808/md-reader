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

## 4. Phase và phase con

Hai đơn vị khác nhau, đừng lẫn:

- **Phase** = đơn vị *giá trị người dùng*. Kết thúc phase là một MR vào `main`.
  Mỗi phase phải ship được thứ dùng được.
- **Phase con** = đơn vị *context và review*. Nó **không cần dùng được** —
  `1c` chỉ là "core parse được markdown ra HTML string", không ai xài trực tiếp.
  Nó tồn tại để một vòng plan→build→review vừa trong ngân sách context (§7).

Pipeline chạy: `capture-intent` + `design-from-intent` **một lần mỗi phase**;
`plan-from-design` → `build-from-plan` → `review-before-ship` **lặp lại theo
từng phase con**; `ship-and-handover` chạy một lần khi phase con cuối xong.

Quy tắc chia phase con — chia tới khi cả ba điều sau đúng:

- ≤ 5 file bị chạm
- ≤ 300 dòng diff dự kiến
- ≤ 1 file test mới

Không đạt thì chia tiếp. Đây không phải hướng dẫn, đây là điều kiện
`plan-from-design` phải kiểm trước khi ghi plan.

### Phase 1 — Nền tảng & Trình đọc

Ship: *click link `.md` → đọc đẹp ngay; kéo file vào app page → đọc được và
lần sau mở lại vẫn còn.*

Bảng dưới đã được `design-from-intent` chia lại (2026-09-10): sáu phase con
gốc — 1b, 1c, 1d, 1f, 1g, 1h — vượt rõ điều kiện sizing ở trên (1b một mình
đã ~19 file), nên chúng được tách thành các đơn vị ≤5 file. Chi tiết interface
từng phase con ở `docs/superpowers/specs/2026-09-10-phase-1-design.md`.

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 1a | Spike CSP/mermaid | Có câu trả lời thật, ghi vào §5.1. Harness vứt đi, không commit code sản phẩm |
| 1b1 | Root workspace & tooling | `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `vitest.workspace.ts`; `pnpm -r test` chạy được |
| 1b2 | `packages/core` skeleton | `@md-reader/core` + 1 test smoke (node), khai sẵn toàn bộ dep của core |
| 1b3 | `packages/ui` skeleton | `@md-reader/ui` + vitest jsdom + 1 test smoke import qua tên workspace |
| 1b4 | `apps/extension` skeleton | `@md-reader/extension` + `vite.config.ts` đa entry (app/worker/content) + 1 test smoke |
| 1c1 | `core/parse` | remark + GFM + frontmatter tách khỏi cây + `sanitizeSchema`, có snapshot test |
| 1c2 | `core/render` + ToC | mdast → hast → HTML string đã sanitize, highlight tập ngôn ngữ hạn chế, `extractToc` |
| 1d1 | `core/doc` schema | Ba key Y.Doc, `formatVersion`, import/export text, `originHash`, hook `migrateDoc` |
| 1d2 | `core/doc` history | `appendHistory` append-only, `sourceClientIds`, **test hội tụ 2 replica** |
| 1e | `core/format` | Auto-format round-trip ổn định (format 2 lần ra cùng kết quả), không mất nội dung |
| 1f1 | `ui` theme | `ThemeProvider` controlled + token CSS light/dark/system |
| 1f2 | `ui` Viewer + Toc | `Viewer` (HTML đã sanitize), `Toc` cây lồng, CSS highlight ăn token |
| 1g1 | Extension shell | Manifest MV3 quyền tối thiểu, service worker, routing thuần test được |
| 1g2 | App page shell | React root + Y.Doc + `y-indexeddb` + theme bridge `chrome.storage.sync`, debounce 120ms |
| 1g3 | Kéo-thả & recent | `DropZone`, registry IndexedDB, `RecentList`, mở file không ghi đè doc đã lưu |
| 1h1 | Content script | Match `.md`, Shadow DOM, render read-only, nút "Mở trong MD Reader", degrade khi CSS bị chặn |
| 1h2 | Cổng ngân sách | Đo gz thật của `content.js` trong build, **vượt 60KB thì fail build** |
| 1i | Mermaid | Lazy `import('mermaid')` ở app page + đường degrade; content script chỉ placeholder |

### Phase 2 — Export

Ship: *một tài liệu bất kỳ ra được HTML, PDF, Word.*

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 2a | HTML self-contained | Inline CSS, SVG đã render, ảnh base64; mở offline vẫn đúng |
| 2b | mdast → docx | Heading, đoạn, list, table, code, link, ảnh |
| 2c | SVG → PNG | Raster hoá chart để nhúng docx |
| 2d | Print CSS + PDF | `@page`, ngắt trang, `window.print()` |
| 2e | `ExportDialog` | Nối 4 đường trên vào UI |
| 2f | E2E khói | Playwright: mở file → xuất đủ 3 định dạng |

### Phase 3 — Trình chiếu

Ship: *mở tài liệu, bấm Present, trình bày được.*

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 3a | `core/slides` | mdast → `Slide[]`, cắt theo `---` hoặc heading depth cấu hình được |
| 3b | `Deck` | Render, keyboard nav, fullscreen, progress |
| 3c | `SpeakerView` | Parse `<!-- note: -->`, cửa sổ thứ hai, đồng hồ, slide kế |
| 3d | Deck → PDF | Dùng lại 2d |

### Phase 4 — Mindmap & Excalidraw

Ship: *nhìn cấu trúc tài liệu dạng cây, và xem được sơ đồ excalidraw nhúng.*

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 4a | `core/mindmap` | Heading → cây `MindNode`, có test cấu trúc |
| 4b | `Mindmap` render | Layout d3-hierarchy, zoom/pan |
| 4c | Tương tác | Gập nhánh, click nhảy tới heading trong Viewer |
| 4d | Excalidraw | `viewMode` lazy ở app page; placeholder ở content script |
| 4e | Xuất mindmap | PNG/SVG, nối vào phase 2 |

### Phase 5 — Chỉnh sửa

Ship: *sửa file và lưu lại đĩa an toàn.*

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 5a | Editor bind | CodeMirror 6 + `y-codemirror.next` vào `Y.Text`, `Y.UndoManager` |
| 5b | File System Access | Mở folder/file, registry IndexedDB, xin lại quyền handle cũ |
| 5c | Save / Save As | Ghi về đĩa, kiểm `originHash` trước khi ghi |
| 5d | Diff ba chiều | Khi hash lệch: đĩa / Y.Doc / tổ tiên chung, bắt người dùng chọn. Không tự merge |
| 5e | Format-and-save | Nối `core/format` vào luồng lưu |
| 5f | Split view | Source ↔ preview, cuộn đồng bộ |
| 5g | History checkpoint | Append `Y.Array "history"` lúc lưu / lặng 30s |

### Phase 6 — Chia sẻ & cộng tác

Ship: *gửi link cho người khác xem → cho họ sửa → xem ai sửa chỗ nào.*

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 6a | `apps/api` scaffold | NestJS + Postgres, lưu Y update binary, migration |
| 6b | Share link read-only | Token + hạn dùng; `apps/web` render bằng `core/render` chạy trên Node |
| 6c | WebSocket provider | Đồng bộ hai chiều thật giữa hai client |
| 6d | Awareness | Con trỏ + presence |
| 6e | Phân quyền | view / comment / edit theo từng link |
| 6f | `BlameGutter` | Blame theo ký tự từ `clientID` |
| 6g | `HistoryTimeline` | Feed checkpoint, tua lại được từng mốc |

Danh tính: 6b dùng tên tự khai lưu trong link token. Auth thật chỉ đặt ra khi
có nhu cầu thực — không dựng account system trước.

## 5. Rủi ro

### 5.1 CSP chặn mermaid trong content script — rủi ro cao, chưa xác minh

Content script chạy isolated world, nhưng `<style>`, web font và
`<foreignObject>` mà mermaid bơm vào DOM trang chủ **vẫn chịu CSP của trang
đó**. Trang có `style-src 'self'` chặt là hỏng.

Xử lý theo thứ tự: (a) render trong Shadow DOM với style inline hoá; (b) nếu
vẫn bị chặn — phát hiện bằng cách đo kích thước SVG sau render — degrade sang
placeholder + nút "Mở trong MD Reader"; (c) không bao giờ để trang trắng.

**Spike là phase con 1a, chạy trước cả scaffold.** Nó dùng **harness vứt đi**:
một MV3 tối giản viết tay (~30 dòng, không build, không test, không TypeScript)
nhét mermaid vào ít nhất 5 trang có chính sách CSP khác nhau — trong đó phải có
một trang `style-src 'self'` chặt và một trang `file:///`.

Harness sống ở `spike/csp-mermaid/`, **không nằm trong workspace**, và bị xoá ở
phase con 1b. Nó tồn tại vì câu hỏi phải được trả lời *trước khi* content script
định hình; đợi tới lúc có extension thật thì đã viết theo hướng có thể sai.

Đầu ra bắt buộc của 1a: một bảng 5 dòng (trang → CSP → mermaid render được?)
ghi thẳng vào chính mục này, cộng một câu kết luận chọn (a) hay (b). Không
stage nào được giả định mermaid chạy trong content script trước khi bảng đó có
số liệu thật.

**Kết quả spike 1a (1a.1 + 1a.2), đo tự động bằng Puppeteer + Chromium thật,
load unpacked extension, đọc `data-spike-result` từ `documentElement`. mermaid
là bản thật (vendor từ npm, không stub). 6/6 URL đo được, 0 dòng "không xác
định".**

| Trang | CSP quan sát được | Shadow DOM + style inline render đúng? | mermaid render đúng? | Ghi chú |
|---|---|---|---|---|
| /none | (không có header) | CÓ (42px) | CÓ (svg 85x174, fo 0px*) | mermaid thật; 0 securitypolicyviolation; *fo=0px ở mọi policy kể cả /none → không phải do CSP (không có violation), là chi tiết render của flowchart đơn giản này |
| /style-self | default-src 'self'; style-src 'self' | CÓ (42px) | CÓ (svg 85x174, fo 0px*) | mermaid thật; 0 securitypolicyviolation; *fo=0px ở mọi policy kể cả /none → không phải do CSP (không có violation), là chi tiết render của flowchart đơn giản này |
| /locked | default-src 'none'; script-src 'self'; style-src 'self'; font-src 'none'; img-src 'none' | CÓ (42px) | CÓ (svg 85x174, fo 0px*) | mermaid thật; 0 securitypolicyviolation; *fo=0px ở mọi policy kể cả /none → không phải do CSP (không có violation), là chi tiết render của flowchart đơn giản này |
| /style-nonce | style-src 'nonce-spike123' | CÓ (42px) | CÓ (svg 85x174, fo 0px*) | mermaid thật; 0 securitypolicyviolation; *fo=0px ở mọi policy kể cả /none → không phải do CSP (không có violation), là chi tiết render của flowchart đơn giản này |
| /style-inline | default-src 'self'; style-src 'self' 'unsafe-inline' | CÓ (42px) | CÓ (svg 85x174, fo 0px*) | mermaid thật; 0 securitypolicyviolation; *fo=0px ở mọi policy kể cả /none → không phải do CSP (không có violation), là chi tiết render của flowchart đơn giản này |
| file:///…/fixture.html | (không có — file://) | CÓ (42px) | CÓ (svg 85x174, fo 0px*) | mermaid thật; file:// không có CSP header (khác biệt cố ý so với 4 route http); extension chạy với --allow-file-access-from-files; 0 securitypolicyviolation |

**Giới hạn của bằng chứng này, đọc trước khi bám vào nó.** Probe chạy trên
**Chromium unbranded** (tải qua `@puppeteer/browsers`), không phải "Google
Chrome" branded: binary branded từ chối `--load-extension` /
`--disable-extensions-except` ("is not allowed in Google Chrome, ignoring"),
nên không tự động hoá được. Chromium và Chrome dùng cùng engine và cùng cách
thực thi CSP, nhưng đây vẫn là suy rộng chứ không phải đo trực tiếp trên bản
người dùng chạy. Phase con 1h1 phải xác nhận lại **một lần bằng tay** trên
Chrome branded trước khi coi nhánh (a) là chốt cho sản phẩm.

`adoptedStyleSheets` cũng render đúng ở cả 6 trang (24px, không có trong bảng
trên vì spec chỉ yêu cầu 5 cột). Không trang nào phát sinh
`securitypolicyviolation`, kể cả `/locked` với `default-src 'none'`.

**Kết luận: chọn nhánh (a) — render mermaid trong Shadow DOM với style inline
hoá.** Style inline trong Shadow DOM, `adoptedStyleSheets`, và SVG do mermaid
sinh ra đều không bị CSP của trang chủ chặn ở bất kỳ chính sách nào đã thử,
kể cả chính sách khoá chặt nhất (`default-src 'none'`). Nhánh (b) (degrade
sang placeholder) không cần kích hoạt cho các trang đã thử; vẫn giữ làm lưới
an toàn theo INVARIANTS vì spike chỉ phủ 5 chính sách CSP đại diện, không phải
mọi CSP có thể gặp trong thực tế.

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

## 7. Mô hình agent & ngân sách context

Pipeline chạy bằng **một coordinator (main loop) + các subagent dùng một lần**.
Lý do tồn tại: giữ context của coordinator phẳng bất kể phase con có bao nhiêu
task. Ngân sách: **không cửa sổ nào được vượt 30%**.

### Ai làm gì

| Agent | Model | Việc | Trả về |
|---|---|---|---|
| coordinator | main loop | Đọc plan, giao việc, tick ô, nối stage | — |
| `builder` | sonnet | Đúng **một** task TDD | ≤ 30 dòng |
| `spiker` | sonnet | Một câu hỏi spike | ≤ 30 dòng |
| `reviewer` | sonnet | Review diff một phase con | ≤ 40 dòng |
| `guard` | haiku | Kiểm ranh giới + bundle (thuần cơ học) | ≤ 15 dòng |

Mọi lần spawn **phải pin `model`** — không bao giờ để nó rơi về model của
coordinator.

### Luật context của coordinator

1. **Không bao giờ `Read` file dưới `packages/` hay `apps/`.** Muốn biết code
   thật thì spawn `guard` (haiku) hỏi một câu.
2. Chỉ đọc: file plan, và báo cáo của subagent.
3. Báo cáo subagent quá dài là lỗi của subagent — yêu cầu tóm lại, không nuốt
   nguyên.
4. Không chạy `git diff` đầy đủ. Chỉ `git diff --stat`. Diff thật là việc của
   `reviewer`.
5. Không chạy full test suite. `builder` chạy test của task nó;
   `reviewer` chạy suite.

Ước lượng: plan file ~3k token + 30 dòng × 12 task ~5k + overhead → dưới 30%
ngay cả với phase con lớn nhất.

### Envelope giao cho `builder`

Coordinator gửi đúng bảy mục này, **copy nguyên văn từ plan**, không tóm tắt:

```
TASK        <id> — <tiêu đề>
FILES       đường dẫn chính xác được phép tạo/sửa (không quá 5)
INTERFACES  chữ ký/type chính xác nó tiêu thụ và phải sinh ra
INVARIANTS  3-6 dòng ràng buộc liên quan, CHÉP SẴN vào đây
TEST        lệnh test chính xác
COMMIT      thông điệp commit
RETURN      định dạng báo cáo bắt buộc
```

`INVARIANTS` được chép sẵn là điểm mấu chốt: **`builder` bị cấm đọc
`DESIGN.md` và `CLAUDE.md`.** Hai file đó ~500 dòng; nhân với 12 builder là
đốt context vô ích. Cái nó cần chỉ là 3-6 dòng, và plan có sẵn.

### Luật của `builder`

- Chỉ được đọc file trong `FILES`, file test của chính nó, và file nó tạo ra.
- Cần một file không có trong `FILES` → **dừng, báo `BLOCKED: <lý do>`**.
  Không đi tự khám phá codebase. Thiếu file trong `FILES` là lỗi của plan, và
  phải sửa ở plan.
- Không `git diff` ngoài phạm vi task. Không chạy test của package khác.
- Báo cáo ≤ 30 dòng, đúng khuôn:

```
TASK <id> — DONE | BLOCKED
FILES   <danh sách file đã đổi>
TEST    <5 dòng cuối output test, có số pass/fail thật>
COMMIT  <hash>
NOTES   <≤3 dòng, chỉ ghi thứ task sau cần biết>
```

### Song song hay tuần tự

Mặc định **tuần tự** — task N thường tiêu thụ interface task N-1 sinh ra.
`plan-from-design` được phép đánh dấu `parallel-group: <tên>` cho các task
thật sự độc lập (không chung file, không chung interface); chỉ khi đó
coordinator mới spawn nhiều `builder` trong một lượt.

### Vì sao không dùng subagent cho design/plan

`design-from-intent` và `plan-from-design` cần **toàn bộ** DESIGN.md trong đầu
để không phá ràng buộc — đó chính là việc phải nuốt context, không phải việc
nên đẩy đi. Chúng chạy trong main loop. Chỉ `build` và `review` mới fan-out.

## 8. Git & MR

```
main
 └── phase-1                     ← branch tích hợp của cả phase
      ├── phase-1-1a-spike-csp   ← branch nhỏ, một phase con
      ├── phase-1-1b1-workspace
      └── …                      mỗi cái merge --no-ff vào phase-1 khi review xanh
```

Tên phase con dùng **gạch ngang**, không gạch chéo: git không cho tồn tại
đồng thời ref `phase-1` và `phase-1/<gì đó>` — một ref không thể vừa là file
vừa là thư mục. Bản nháp đầu ghi `phase-N/<id>` và không tạo được branch nào.

- `capture-intent` tạo `phase-N` từ `main`.
- `plan-from-design` tạo `phase-N-<id>-<slug>` từ `phase-N`.
- `review-before-ship` so diff với **điểm rẽ nhánh của phase con**, không phải
  với `main` — đây là lý do mỗi phase con có branch riêng.
- Review xanh → merge `--no-ff` vào `phase-N`, rồi vòng lại
  `plan-from-design` cho phase con kế tiếp.
- Phase con cuối xong → `ship-and-handover` mở **MR `phase-N` → `main`**.
  Không tự merge MR; đó là quyết định của người.

## 9. Bảng tra quyết định

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
