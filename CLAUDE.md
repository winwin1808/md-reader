# md-reader — Project Memory

Chrome extension (MV3) đọc và làm việc với file Markdown. Repo riêng, không
thuộc bss-code.

> **`docs/DESIGN.md` là nguồn chân lý về kiến trúc.** File này chỉ tóm tắt.
> Khi hai file lệch nhau, DESIGN.md đúng. Mọi stage của pipeline phải đọc
> DESIGN.md trước khi thiết kế hay lập kế hoạch.

## Cách làm việc trong repo này

Pipeline SDLC tự nối chuỗi 6 stage trong `.claude/skills/`:

```
capture-intent → design-from-intent → plan-from-design → build-from-plan
               → review-before-ship → ship-and-handover
```

`capture-intent` là stage DUY NHẤT hỏi người dùng. Từ đó mỗi stage tự invoke
stage kế tiếp trong cùng session — không subagent, không song song. Chỗ dừng
duy nhất là `review-before-ship` khi gặp blocker thật.

Bắt đầu một phase mới = gọi `capture-intent`.

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

| # | Phase | Ship được gì |
|---|---|---|
| 1 | Nền tảng & Trình đọc | Click link `.md` đọc đẹp ngay; kéo file vào app page, lần sau mở vẫn còn |
| 2 | Export | Ra được HTML / PDF / Word |
| 3 | Trình chiếu | Bấm Present là trình bày được, có speaker view |
| 4 | Mindmap & Excalidraw | Nhìn cấu trúc dạng cây; xem được sơ đồ excalidraw nhúng |
| 5 | Chỉnh sửa | Sửa và lưu về đĩa an toàn, có phát hiện lệch file |
| 6 | Chia sẻ & cộng tác | Link xem → cùng sửa → trace ai sửa chỗ nào (3 lần ship nhỏ) |

## Status

- 2026-09-10 — Khung repo dựng xong: `docs/DESIGN.md` (design end-to-end,
  approved), `CLAUDE.md`, 6 skill pipeline, `docs/superpowers/{intent,specs,plans}`,
  `docs/SESSION_HANDOVER.md`, workspace config tối thiểu. Doc-model chốt là
  **Yjs từ phase 1** (thay cho CM6 ChangeSet ở bản nháp đầu). Chưa có
  `packages/` hay `apps/` — phase 1 tạo chúng. Chưa phase nào chạy.
