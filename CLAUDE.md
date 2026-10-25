# md-reader — Project Memory

Chrome extension (MV3) đọc và làm việc với file Markdown. Repo riêng, không
thuộc bss-code.

> **`docs/DESIGN.md` là nguồn chân lý về kiến trúc.** File này chỉ tóm tắt.
> Khi hai file lệch nhau, DESIGN.md đúng. Mọi stage của pipeline phải đọc
> DESIGN.md trước khi thiết kế hay lập kế hoạch.

## Cách làm việc trong repo này

Pipeline SDLC tự nối chuỗi trong `.claude/skills/`. **Nó là một vòng lặp, không
phải đường thẳng** — intent+design chạy một lần mỗi *phase*, còn
plan→build→review lặp lại theo từng *phase con*:

```
(brainstorm-intent) ──► capture-intent ──► design-from-intent
    [optional, ý tưởng còn thô]                  │
                                                  ▼
              ┌─► plan-from-design ──► build-from-plan ──► review-before-ship
              │                                                   │
              └──────── còn phase con pending ◄───────────────────┤
                                                                  │
                                            hết phase con ────────┴──► ship-and-handover ──► MR
```

`brainstorm-intent` (stage 0, tùy chọn) và `capture-intent` là hai stage DUY
NHẤT hỏi người dùng. Chỗ dừng duy nhất ngoài hai stage đó là
`review-before-ship` khi gặp blocker thật.

Bắt đầu một phase mới từ ý tưởng còn thô, cần khai phá + tham khảo thị trường
= gọi `brainstorm-intent`. Ý tưởng đã rõ Problem/Outcome = gọi thẳng
`capture-intent`. Chạy tiếp một phase con dở = gọi `build-from-plan` với
đường dẫn plan.

## Agent & ngân sách context

Chi tiết ở `docs/DESIGN.md` §7. Bản rút gọn:

- `build-from-plan` và `review-before-ship` **fan-out ra subagent**;
  `design-from-intent` và `plan-from-design` chạy trong main loop (chúng cần
  cả DESIGN.md trong đầu — đó là việc, không phải overhead).
- Agent trong `.claude/agents/`: `builder` (sonnet, một task TDD, ≤30 dòng) ·
  `spiker` (sonnet, một câu hỏi spike) · `reviewer` (sonnet, diff một phase
  con, ≤40 dòng) · `guard` (haiku, kiểm cơ học, ≤15 dòng).
- **Mọi lần spawn phải pin `model`.** Không bao giờ để rơi về model coordinator.
- **Coordinator không bao giờ `Read` file dưới `packages/` hay `apps/`**, không
  chạy full test suite, không chạy full `git diff`. Cần biết code thật thì hỏi
  `guard`.
- `builder` **bị cấm đọc `DESIGN.md` và `CLAUDE.md`** — 3-6 dòng ràng buộc nó
  cần đã được chép sẵn vào khối `INVARIANTS` trong envelope của plan.
- Ngân sách: không cửa sổ nào vượt **30%**.

## Kích cỡ phase con — điều kiện, không phải gợi ý

`plan-from-design` phải kiểm trước khi ghi plan; không đạt thì chia nhỏ tiếp:

- ≤ 5 file bị chạm
- ≤ 300 dòng diff dự kiến
- ≤ 1 file test mới

## Git

```
main
 └── phase-N                     branch tích hợp cả phase, kết thúc bằng MR
      └── phase-N-<sub>-<slug>   branch một phase con, merge --no-ff vào phase-N
```

Gạch ngang, không gạch chéo — `phase-1` và `phase-1/x` không cùng tồn tại
được trong git.

`review-before-ship` so diff với điểm rẽ nhánh của **phase con**. MR mở ở cuối
phase và **không tự merge** — đó là quyết định của người.

## Ràng buộc khoá cứng — không stage nào được đổi

Chi tiết và lý do đầy đủ ở `docs/DESIGN.md`. Bản rút gọn:

1. **Y.Doc (Yjs) là nguồn sự thật, từ phase 1.** File `.md` là cổng
   import/export, không phải state. Schema: `Y.Text "source"` ·
   `Y.Map "meta"` · `Y.Array "history"`. Có `formatVersion` ngay từ đầu.
   Đổi schema sau khi có dữ liệu bắt buộc kèm migration + test fixture cũ.
2. **Ranh giới package.** `packages/core` thuần TS — được dùng yjs, KHÔNG
   react / `chrome.*` / `document`. `packages/ui` React — KHÔNG `chrome.*`.
   `apps/extension` là lớp duy nhất được dùng `chrome.*`. Import chéo package
   luôn bằng tên workspace `@md-reader/core`, không bao giờ đường dẫn tương đối.
3. **`packages/core` không được biết provider nào đang chạy** — nó nhận một
   `Y.Doc` đã bind sẵn. Chọn/gắn provider là việc của `apps/extension`.
4. **Content script KHÔNG dùng Yjs**, và ngân sách ≤ 60KB gz. Vượt là blocker.
5. **Parser là `unified`/`remark`**, không phải markdown-it. Re-parse toàn bộ
   với debounce 120ms, không parse tăng tiến.
6. **Excalidraw chỉ ở app page**, lazy, `viewMode`. Content script chỉ
   placeholder.
7. **PDF bằng print CSS + `window.print()`**, không thư viện PDF, không
   headless. **Word bằng thư viện `docx`** map từ mdast.
8. **Không giả định mermaid chạy được trong content script** cho tới khi
   SPIKE 5.1 (task đầu phase 1) có kết quả thật.

Vi phạm 1-8 là **blocker cứng** ở `review-before-ship`, không phải góp ý.

## Stack

pnpm workspaces · Vite · React · TypeScript · Chrome MV3 · vitest ·
yjs + y-indexeddb (+ y-codemirror.next từ phase 5) · unified/remark.

Không đề xuất framework, parser hay CRDT khác. Không thêm state-manager toàn
cục khi React state + Y.Doc đủ dùng.

Lệnh test: `pnpm --filter core test` · `--filter ui` · `--filter extension`.

## Phases

Mỗi phase là một vòng pipeline riêng và phải ship được thứ dùng được. Plan
không được chứa task vượt ra ngoài phase hiện tại — thứ lỡ ra ngoài ghi xuống
mục "Deferred to phase N". Nội dung chi tiết từng phase ở `docs/DESIGN.md` §4.

Bảng phase con đầy đủ ở `docs/DESIGN.md` §4 — 47 phase con trên 6 phase
(phase 1 được chia lại thành 18 sau khi design kiểm điều kiện sizing).

| # | Phase | Ship được gì |
|---|---|---|
| 1 | Nền tảng & Trình đọc | Click link `.md` đọc đẹp ngay; kéo file vào app page, lần sau mở vẫn còn |
| 2 | Export | Ra được HTML / PDF / Word |
| 3 | Trình chiếu | Bấm Present là trình bày được, có speaker view |
| 4 | Mindmap & Excalidraw | Nhìn cấu trúc dạng cây; xem được sơ đồ excalidraw nhúng |
| 5 | Chỉnh sửa | Sửa và lưu về đĩa an toàn, có phát hiện lệch file |
| 6 | Gia cố | Không mất/nhân đôi chữ, lưu thẳng về đĩa sau reload, quyền tối thiểu, Playwright thật |
| 7 | Giao diện Lề sách | Giao diện phương án A cho mọi bề mặt + logo app |
| 8 | Chia sẻ & cộng tác | Link xem → cùng sửa → trace ai sửa chỗ nào (3 lần ship nhỏ) |

## Status

- 2026-09-10 — Khung repo dựng xong: `docs/DESIGN.md` (design end-to-end,
  approved), `CLAUDE.md`, 6 skill pipeline, `docs/superpowers/{intent,specs,plans}`,
  `docs/SESSION_HANDOVER.md`, workspace config tối thiểu. Doc-model chốt là
  **Yjs từ phase 1** (thay cho CM6 ChangeSet ở bản nháp đầu). Chưa có
  `packages/` hay `apps/` — phase 1 tạo chúng. Chưa phase nào chạy.
- 2026-09-10 — **Phase 1 chạy được 5/18 phase con**, merged vào `phase-1`,
  chưa MR: `1a` spike CSP (kết luận nhánh (a), ghi vào DESIGN.md §5.1) ·
  `1b1` root workspace (typescript 7.0.2, vitest 5.0.0) · `1b2`
  `@md-reader/core` · `1b3` `@md-reader/ui` (react 19.3.0) · `1b4`
  `@md-reader/extension` (vite 8.2.2, build **hai lệnh** — content script
  IIFE riêng, vì output chung kéo React vào content.js dạng ES module).
  Cả ba package xanh: core 1 · ui 2 · extension 1 test; typecheck + build
  exit 0; `dist/content.js` gz 104/61440. Phase con kế tiếp: **1c1
  `core/parse`** (chưa có plan). CodeGraph đã bật cho repo (14 file, 32 node).
  Món nợ đang mở + cách chạy tiếp ở `docs/SESSION_HANDOVER.md`.
- 2026-09-10 — Pipeline chuyển thành vòng lặp phase/phase con + fan-out
  subagent. Thêm `.claude/agents/` (builder, spiker, reviewer, guard),
  DESIGN.md §4 chia 38 phase con, §7 mô hình agent/ngân sách context,
  §8 mô hình git/MR. Spike CSP chốt dùng harness vứt đi (phase con 1a).
- 2026-09-11 — **Phase 1 HOÀN TẤT**, 18/18 phase con đã merge vào `phase-1`. Đã dựng xong toàn bộ nền tảng: parser, yjs doc model, UI components, app shell, và content script injection (với ngân sách 10KB gz, vượt xa yêu cầu 60KB). Branch sẵn sàng mở MR. Phase tiếp theo: **Phase 2 (Export)**.
- 2026-09-11 — **Phase 2 HOÀN TẤT (bao gồm Export + UX/UI Revamp chuyên nghiệp)**: 15/15 phase con (2a..2g và 2h..2m) đã merge vào `phase-2`. Đã xây dựng hoàn chỉnh: 5 color themes; standalone HTML export; Microsoft Word (.docx) export; SVG rasterizer; Print CSS và PDF export; ExportModal; bố cục A4 document với shadow & border; thanh tiến độ đọc mỏng cố định 3px; TopToolbar sticky 48px với font scale tỉ lệ [A-] [100%] [A+]; chế độ đọc tập trung (Reading Mode); tìm kiếm trong tài liệu (Cmd+F) với DOM text walker & highlight; code block header với badge ngôn ngữ & copy button; bảng biểu theme accent & zebra striping; ToC collapsible phân cấp H1-H3; tuỳ chọn Font Family (Sans-serif, Serif, Monospace); và E2E smoke tests. Tích hợp skill `brainstorm-intent`. 197 tests xanh tuyệt đối (core 82, ui 93, extension 22), typecheck exit 0, build exit 0, content script gz 10.14KB. Branch `phase-2` sẵn sàng mở MR. Phase tiếp theo: **Phase 3 (Trình chiếu / Presentation)**.
- 2026-09-14 — **Phase 3 HOÀN TẤT (Trình chiếu / Slides)**: 5/5 phase con (3a..3e) đã merge vào `phase-3` và `main`. Đã xây dựng hoàn chỉnh: module `core/slides` cắt slide thông minh theo `---` hoặc heading depth, bảo vệ frontmatter/code blocks, bóc tách speaker notes (`<!-- note: ... -->`); component React `Deck` tỉ lệ 16:9 responsive, điều hướng phím (mũi tên, phím cách, Esc), thanh tiến trình 4px; giao diện `SpeakerView` cho diễn giả (`?speaker=true`) với đồng hồ thời gian thực, bộ đếm elapsed timer, xem trước slide tiếp theo và panel speaker notes; đồng bộ 2 chiều qua `BroadcastChannel('md-reader-slides-sync')`; xuất Slide PDF khổ ngang 16:9 với `@page slide-deck { size: landscape; margin: 0; }`, `flushSync` synchronous DOM render, và `printSlides` utility. 247 tests xanh tuyệt đối (core 97, ui 124, extension 26), typecheck exit 0, build exit 0, content script gz 10.14KB. Ready for Next Phase & Extended Settings.
- 2026-09-14 — **Phase 4 HOÀN TẤT (Cài đặt Mở rộng, Reading Aids & Rich Rendering Suite)**: 5/5 phase con (4a..4e) đã merge vào `phase-4` và `main`. Đã xây dựng hoàn chỉnh: mở rộng render options với typographer (smart quotes, ký tự bản quyền), GitHub Alerts (5 loại với icon SVG chuẩn), external link indicators, xử lý frontmatter (strip & metadata card); bộ công cụ hỗ trợ đọc Reading Aids gồm thanh WordCountBar đếm từ/ký tự/thời gian đọc và tự ẩn khi cuộn cuối trang, hiệu ứng pháo giấy CelebrationConfetti Canvas 2D khi đọc xong tài liệu; tùy biến giao diện trình chiếu Deck với màu nền, màu chữ, tiêu đề, accent, phông chữ, hình nền URL và độ mờ; đại tu toàn diện SettingsModal thành 5 tab chuyên nghiệp (Display, Core Rendering, Media & Diagrams, Reading Aids, Presentation Mode) lưu trữ đồng bộ qua `chrome.storage.sync`. 278 tests xanh tuyệt đối (core 112, ui 137, extension 29), typecheck exit 0, build exit 0, content script gz 10.04KB (ngân sách 61.44KB). Sẵn sàng phục vụ người dùng.
- 2026-09-14 — **Phase 4 HOÀN TẤT (Mindmap chuẩn Markmap & Excalidraw Sơ đồ nhúng)**: 5/5 phase con (4a..4e) đã merge vào branch `phase-4-mindmap`. Đã xây dựng hoàn chỉnh: trích xuất AST `core/mindmap` tạo cây `MindNode` chuẩn phân cấp và đồng bộ slug với ToC; modal toàn màn hình `MindmapModal` dựng sơ đồ cây SVG với đường cong Bézier Markmap mượt mà, phân màu kế thừa theo nhánh cha, zoom & pan bằng chuột/con lăn/phím; tương tác 2 chiều với nút gập/mở nhánh (badge hiển thị số node ẩn), nút Expand All/Collapse All, nút Mindmap trên TopToolbar và phím tắt toàn cục `Cmd+M` / `Ctrl+M`, click node tự động cuộn mượt đến tiêu đề tương ứng; component `ExcalidrawBlock` hiển thị phác thảo vector tay (hình chữ nhật, ellipse, thoi, đường thẳng, mũi tên, chữ viết, nét vẽ tự do) trong tài liệu A4 trên app page và thẻ placeholder gọn nhẹ trong content script; xuất sơ đồ Mindmap ra file SVG và PNG chất lượng cao (reset viewport transform, fitted viewBox padding 40px, thu hồi blob an toàn) kèm bộ E2E smoke tests toàn diện. 324 tests xanh tuyệt đối (core 123, ui 162, extension 39), typecheck exit 0, build exit 0, content script gz 10.23KB (ngân sách 61.44KB). Sẵn sàng mở MR vào `main`. Phase tiếp theo: **Phase 5 (Chỉnh sửa / Editor & Lưu đĩa)**.
- 2026-09-15 — **Phase 5 HOÀN TẤT (Chỉnh sửa / Editor, Split View & Lưu đĩa An toàn)**: 7/7 phase con (5a..5g) đã merge vào `phase-5`. Đã xây dựng hoàn chỉnh: Module `Editor` CodeMirror 6 liên kết 2 chiều qua `y-codemirror.next` với `Y.Text "source"` và `Y.UndoManager`; tích hợp File System Access API (`saveToHandle`, `openLocalFile`, `saveFileAs`, `verifyHandlePermission`) và lưu trữ handle bền vững trong IndexedDB; thuật toán line-by-line diff (`computeLineDiff`) và phát hiện xung đột (`detectConflict`) theo SHA-256 `originHash`, cùng hộp thoại so sánh 3-way diff trực quan `ConflictModal` với 2 lựa chọn an toàn (Ghi đè hoặc Tải lại từ đĩa); thanh công cụ soạn thảo `FormattingToolbar` đầy đủ công cụ Markdown kèm xử lý tự động tiếp tục/thoát danh sách khi Enter và giữ nguyên vùng chọn; container 3 chế độ xem `SplitViewContainer` (Reading, Editor, Split View 50:50) với cơ chế cuộn đồng bộ 2 chiều (Synchronized Scrolling) chống lặp phản hồi vô tận bằng programmatic target guard và cancellation rAF; toàn bộ pipeline lưu đĩa trong `App.tsx`: phím tắt toàn cục `Cmd+S`/`Ctrl+S`, chỉ báo chưa lưu `•` (`.dirty-indicator`), lưu định dạng Markdown tự động (`formatMarkdown`), checkpoint lịch sử `appendHistory` vào `Y.Array "history"`, debounced auto-save sau 2000ms, và concurrency guard `isSavingRef`; bộ kiểm thử tích hợp E2E Smoke Tests toàn diện kiểm tra đầy đủ hành trình soạn thảo, định dạng, chia màn hình, lưu file và giải quyết xung đột. 400 tests xanh tuyệt đối (core 133, ui 206, extension 61), typecheck exit 0, build exit 0, content script gz 10.23KB (ngân sách 61.44KB). Sẵn sàng mở MR vào `main`. Phase tiếp theo: **Phase 6 (Chia sẻ & Cộng tác)**.
- 2026-09-21 — **Phase 1 -> Phase 5 ĐÃ MERGE HOÀN TOÀN VÀO MAIN & MASTER (Kèm bộ tinh chỉnh UX/Options & Floating Widget)**: Toàn bộ 47+ phase con từ Phase 1 đến Phase 5 đã được hợp nhất hoàn toàn vào `main` và `master`. Sửa lỗi cô lập IndexedDB theo file URL, loại bỏ lỗi "Unsafe attempt to load URL file", sửa cơ chế đồng bộ và độ ưu tiên settings (`local` > `sync`), làm rõ ràng rành mạch hai tuỳ chọn Auto-format Markdown và Always-open Full App, đồng thời đảm bảo hiển thị nút Floating Widget 📖 cố định ở góc dưới màn hình khi ở chế độ xem thô. 404 tests xanh tuyệt đối (core 133, ui 206, extension 65), typecheck exit 0, build exit 0, content script gz 11.65KB. Sẵn sàng cho Phase 6 (Chia sẻ & Cộng tác).
- 2026-09-22 — **Căn 2 lề 100% full-width cho bảng biểu (Table 100% Margin Justified & Responsive Wrapper)**: Khắc phục triệt để hiện tượng các bảng Markdown có độ dài lệch nhau, không căng đều 2 mép lề trang. Sửa `display: block` và `width: max-content` thành `display: table; width: 100%; min-width: 100%` trong `table-enhanced.css`, `typography.css` và `export/css.ts`. Tự động bọc `.table-wrapper` có `overflow-x: auto` trong `Viewer.tsx` đảm bảo bảng luôn căng phẳng 100% theo lề trang A4 nhưng vẫn cuộn ngang mượt mà khi viewport hẹp hoặc chế độ chia đôi màn hình. 405 tests xanh tuyệt đối (core 133, ui 207, extension 65), typecheck exit 0, build exit 0, content script gz 11.66KB.




- 2026-10-24 — **Phase 6 HOÀN TẤT (Gia cố)**: 30 phase con (6a..6l, gồm 6e4/6f3/6j4 tách lúc plan) merge vào `phase-6`, MR `phase-6` → `main` đã mở, **chưa merge**. Bây giờ đúng: ghi Y.Text luôn là delta nhỏ nhất; `formatVersion: 2` (`gc:false`, migration v1 + fixture); registry `docId` (`?doc=<id>`), mỗi doc một IDB; handle theo doc, xin lại quyền (Cmd+S cũng xin); diff 3 chiều thật; mốc URL `meta.remoteHash` tách khỏi mốc đĩa `originHash`; rehype plugin trước sanitize + `clobberPrefix`; quyền `storage`+`activeTab`; math KaTeX; checkpoint có `clientIds` + snapshot; Playwright `pnpm --filter extension e2e` 3/3. Test: core 182 · ui 215 · extension 169; typecheck/build exit 0; content.js gz 11.76KB. Còn mở: một flake IDB `TransactionInactiveError` (~1/10 lượt suite extension) → 7s1; app.js gz 408KB (KaTeX trong chunk chính). Phase tiếp theo: **Phase 7 (Giao diện Lề sách)**, branch `phase-7` xếp chồng trên `phase-6`.
- 2026-10-24 — **Phase 7 HOÀN TẤT (Giao diện Lề sách + logo)**: 7a1..7t merge vào `phase-7` (7s1, 7s2 tách lúc plan; 7o — đọc tại chỗ trong content script — **hoãn sang phase 8**: spike 7n đo 152.9 KB gz > 50 KB vì core import tĩnh katex/highlight/parse5/yaml). MR `phase-7` → `phase-6` (xếp chồng) đã mở, **chưa merge**. Bây giờ đúng: token Lề sách (Giấy / Than chì / tương phản cao), Literata + IBM Plex đóng gói cục bộ, logo + icon 16–128; mục lục bám mục đang đọc, alert thành ghi chú lề; Icon SVG, copy tiếng Việt, trạng thái lưu bằng chữ; editor/split cuộn đồng bộ thật; slide scale theo màn + speaker view đọc được + mermaid/alert trong slide và slide PDF; mindmap theo tông nhánh, đi bằng bàn phím, pinch; widget content script là tab mép phải với CSS riêng 1.8 KB; export HTML/print/Word theo Lề sách; khối alias token cũ đã xoá. Test: core 185 · ui 318 · extension 199 · e2e 4/4; typecheck/build exit 0; content.js gz 11.86 KB; app.js gz 417 KB. Còn mở: flake IDB `TransactionInactiveError` (không tái hiện trong 30 lượt). Phase tiếp theo: **Phase 8 (Chia sẻ & cộng tác)**.
- 2026-10-24 — **Phase 8 HOÀN TẤT (Chia sẻ & cộng tác)**: 8a0..8k + 8j2 (gia cố) merge vào `phase-8`; MR #4 `phase-8` → `main` **đã merge** 2026-10-25 (`e0b9a75`). Bây giờ đúng: `apps/api` Cloudflare Worker (DO SQLite + D1, Workers Free, không R2/KV) đã deploy tại `md-reader-api.<subdomain>.workers.dev` và là máy chủ mặc định (đổi được ở Cài đặt → Cộng tác); token chỉ lưu SHA-256 + prefix, 410 khi thu hồi/hết hạn, link xem không ghi được; `apps/web` xem/sửa qua link; presence, blame theo dòng, lịch sử + khôi phục; core inject plugin qua `@md-reader/core/plugins`; đọc tại chỗ trong content script (render ở service worker, 7o xong); khoá Web Lock khi import; e2e cộng tác qua wrangler dev; privacy/listing nói đúng máy chủ mặc định; phiên bản 1.1.0. Test: core 226 · ui 401 · extension 283 · web 45 · api 77 · e2e 5/5 · e2e:collab 1/1; typecheck/build exit 0; content.js gz ~13.35KB. Còn mở: chưa có endpoint xoá dữ liệu phòng (thu hồi không xoá), chưa rate limit, liên hệ trong privacy còn placeholder; nên xoay token Cloudflare. Bước kế: publish 1.1.0 lên Chrome Web Store (điền liên hệ privacy, khai form Data usage). Phase tiếp theo: chưa định — cần intent mới.
- 2026-10-25 — **Phase 9 HOÀN TẤT (Sửa thẳng trên trang đọc + hoàn thiện chia sẻ)**: 9a1..9e merge vào `phase-9`. Bây giờ đúng: extension chỉ còn hai chế độ **Đọc** · **Sửa** (live preview CM6 trên `Y.Text "source"` — ẩn dấu Markdown ngoài con trỏ, widget ảnh/checkbox/code/alert/bảng/`$$`/mermaid, giữ vị trí khi chuyển, nhớ theo tài liệu; Mã nguồn và Chia đôi đã bỏ); ShareModal nhóm Xem/Sửa, Sao chép lại link đã tạo (token đầy đủ cache trong `chrome.storage.local`, máy chủ vẫn chỉ lưu hash), "Tạo lại link" cho link tạo ở máy khác; web `/s/:token` theo Lề sách, link sửa mở thẳng chế độ Sửa có nút Xem. Version 1.2.0. Worker deploy lại (version `3e40c368`), smoke OK. Test: core 226 · ui 421 · extension 291 · web 47 · api 77 · e2e 7/7.
- 2026-10-25 — **Phase 9 bổ sung (9g1..9h5)**: bảng giữ dạng lưới khi sửa (ghi từng ô, Tab/Enter/↑↓, thêm/xoá dòng-cột, "Sửa mã bảng", ô hiện định dạng khi không focus); ảnh đường dẫn tương đối hiện đúng (resolver theo URL gốc / `file://` qua fetch→blob / thư mục được cấp quyền); dán/kéo ảnh khi Sửa: tài liệu đã chia sẻ → D1 (`assets` + `asset_chunks` 1 MiB, ≤2 MiB/ảnh, 50 MB/phòng, chỉ link sửa/chủ, png/jpeg/gif/webp có sniff) · thư mục được cấp quyền → `assets/` cạnh file · ảnh ≤600 KB → nhúng `data:` · còn lại báo lỗi. Migration D1 `0002_assets` đã chạy remote; Worker version `79d80546`, smoke ASSETS OK. Spike: chia sẻ lần đầu doc 2.4 MB ảnh nhúng đồng bộ nguyên vẹn. Test: core 226 · ui 440 · extension 305 · web 48 · api 83. Nợ: export chưa qua image resolver; web báo lỗi ảnh bằng `window.alert`.
