# md-reader — Project Memory

Chrome extension (MV3) đọc và làm việc với file Markdown. Repo riêng, không
thuộc bss-code.

## Cách làm việc trong repo này

Repo này chạy pipeline SDLC tự nối chuỗi 6 stage trong `.claude/skills/`:

```
capture-intent → design-from-intent → plan-from-design → build-from-plan
               → review-before-ship → ship-and-handover
```

`capture-intent` là stage DUY NHẤT hỏi người dùng. Từ đó trở đi mỗi stage tự
invoke stage kế tiếp trong cùng session, không subagent, không chạy song song.
Chỗ dừng duy nhất là `review-before-ship` khi gặp blocker thật.

Bắt đầu một phase mới = gọi `capture-intent`.

## Kiến trúc đã chốt — không stage nào được đổi

### Monorepo

```
packages/core       thuần TS — parse, doc-model, ops, transform, export
                    KHÔNG import react, KHÔNG đụng chrome.*, KHÔNG đụng document
packages/ui         React — Viewer, Editor, Present, Mindmap, ExportDialog
                    KHÔNG đụng chrome.*  → dùng lại nguyên vẹn cho web app sau
apps/extension      MV3 — content script + app page + service worker
                    lớp DUY NHẤT được phép biết chrome.*
(phase 6) apps/api, apps/web — share link, collab, audit log
```

Ranh giới trên là ràng buộc cứng. Nó tồn tại để phase 6 (share link + collab)
chạy được `packages/core` trên Node và `packages/ui` trong web app mà không
phải viết lại. Bất kỳ import nào phá ranh giới này là blocker ở
`review-before-ship`.

### Stack khoá cứng

pnpm workspaces · Vite · React · TypeScript · Chrome MV3 · vitest.
Không đề xuất framework khác. Không thêm state-manager toàn cục khi
React state đủ dùng.

### Parser: `unified` / `remark` (không phải markdown-it)

Cả bốn phase đều là biến đổi trên cùng một mdast: slide splitter cắt theo
`thematicBreak`/`heading`, mindmap dựng cây từ `heading`, export docx map
mdast→docx, auto-format là `remark-parse → remark-stringify` round-trip.
markdown-it chỉ cho ra HTML nên ba trong bốn thứ đó phải parse lại.

**Auto-format** = round-trip qua remark-stringify với config chuẩn hoá
(bullet, heading style, table align, line width). Phase 1 chỉ preview bản đã
format; ghi đè file thật đi kèm phase 5 (edit).

### Doc model & ops log

Không dùng snapshot text. Dùng CodeMirror 6 `ChangeSet` làm định dạng op:

```
Document = { id, baseText, ops: Op[] }
Op       = { id, actor, ts, changes: ChangeSet.toJSON() }
```

`ChangeSet` serialize/compose/rebase được sẵn → "trace ai sửa chỗ nào" có từ
ngày đầu, và phase 6 chỉ cần thêm tầng rebase phía server. Doc model này phải
tồn tại từ phase 1 kể cả khi chưa có editor.

*Đã cân nhắc và loại:* Yjs ngay từ đầu (thừa cho phase 1-4, kéo theo
provider/awareness/server sớm hơn cần; vẫn thay được sau nếu cần realtime
thật). Diff text từng bản lưu (rẻ nhất nhưng mất granularity actor — đúng thứ
cần cho trace log).

### Charts

- **mermaid** — lazy `import()`, render đầy đủ ở app page.
- **excalidraw** — `@excalidraw/excalidraw` ở `viewMode`, ~1MB, lazy load,
  CHỈ ở app page. Content script chỉ render placeholder + nút "Mở trong
  MD Reader".
- **Rủi ro chưa xác minh (spike bắt buộc, task đầu của phase 1):** content
  script chạy isolated world nhưng `<style>`/font/`<foreignObject>` mermaid
  bơm vào DOM trang chủ vẫn chịu CSP của trang đó. Dự phòng: render trong
  Shadow DOM (cũng chặn CSS trang chủ đè); nếu vẫn bị chặn thì degrade sang
  nút mở app page. Không stage nào được giả định mermaid chạy trong content
  script khi spike chưa xong.

### Theme

CSS custom properties, ba chế độ light / dark / system, lưu
`chrome.storage.sync`. Content script bọc Shadow DOM. `packages/ui` chỉ đọc
CSS var — extension là lớp bơm giá trị vào.

### Export

| Định dạng | Cách làm |
|---|---|
| HTML | Self-contained: inline CSS, SVG đã render sẵn, ảnh base64 |
| PDF  | App page mở print view + `window.print()` với `@page` CSS. Không headless browser, không thư viện PDF |
| Word | Thư viện `docx`, map mdast→docx node. Chart: SVG→canvas→PNG rồi nhúng |

### Test

- `packages/core` — vitest môi trường node. Gần hết logic nằm đây nên gần hết
  test nằm đây (snapshot AST + output export).
- `packages/ui` — vitest + testing-library, jsdom.
- `apps/extension` — chỉ test logic thuần. E2E Playwright load-unpacked để
  dành phase sau.

Lệnh: `pnpm --filter core test`, `pnpm --filter ui test`,
`pnpm --filter extension test`.

## Phases

Mỗi phase là một vòng `capture-intent → … → ship-and-handover` riêng. Plan
không được chứa task vượt ra ngoài phase hiện tại.

| # | Phase | Nội dung |
|---|---|---|
| 1 | Core view | Scaffold monorepo, core parser + auto-format, doc-model, Viewer, theme, content script + app page, mermaid, **spike CSP** |
| 2 | Export | HTML / PDF / Word |
| 3 | Presentation | Cắt slide, keyboard nav, speaker view |
| 4 | Mindmap + Excalidraw | Cây heading, render excalidraw embed |
| 5 | Edit | CodeMirror 6, File System Access, ops log, format-and-save |
| 6 | Share & collab | `apps/api` — share link, người khác xem, người khác edit, audit log |

## Cách mở file (đã chốt)

Cả hai đường:

```
*.md URL  ──content script──►  render tại chỗ (view + theme + mermaid)

drag-drop / File System Access  ──►  app page (edit, present, mindmap, export)
                                      │
                              cùng dùng packages/core + packages/ui
```

## Status

- 2026-09-10 — Khung repo dựng xong: CLAUDE.md, 6 skill pipeline,
  `docs/superpowers/{intent,specs,plans}`, `docs/SESSION_HANDOVER.md`,
  workspace config tối thiểu. Chưa có `packages/` hay `apps/` — phase 1 tạo
  chúng. Chưa có phase nào chạy.
