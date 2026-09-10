# Session Handover — md-reader

Cập nhật lần cuối: 2026-09-10

## Trạng thái hiện tại

Repo mới dựng khung. Chưa có phase nào chạy, chưa có dòng code app nào.

Đã có:

- **`docs/DESIGN.md`** — design end-to-end toàn sản phẩm, trạng thái approved.
  Đây là nguồn chân lý về kiến trúc; đọc nó trước mọi việc.
- `CLAUDE.md` — 8 ràng buộc khoá cứng + bảng 6 phase, tóm tắt từ DESIGN.md.
- `.claude/skills/` — 6 skill pipeline auto-chain, đã sửa cho stack này.
- `docs/superpowers/{intent,specs,plans}/` — rỗng.
- `pnpm-workspace.yaml`, `package.json`, `.gitignore`.

Chưa có: `packages/core`, `packages/ui`, `apps/extension`, `node_modules`,
`tsconfig.base.json`. Phase 1 tạo tất cả.

## Test counts

Chưa có test nào.

## Việc tiếp theo

Chạy `capture-intent` cho **phase 1 — Nền tảng & Trình đọc**. Nội dung phase 1
ở `docs/DESIGN.md` §4.

Hai thứ dễ bị làm sai nhất ở phase 1, để ý:

1. **Y.Doc schema phải đúng ngay bây giờ** (DESIGN §2.1) kể cả khi phase 1
   chưa có editor và Yjs lúc này thuần overhead. Đổi schema sau khi có dữ liệu
   thật là migration đau. Gồm cả `originHash` và `formatVersion` — cả hai chỉ
   được *dùng* ở phase 5 nhưng phải *tồn tại* từ phase 1.
2. **SPIKE CSP/mermaid là task đầu tiên** (DESIGN §5.1), không phải task cuối.
   Kết quả của nó quyết định content script có render mermaid hay chỉ hiện
   placeholder — nhiều task sau phụ thuộc vào đó.

## Điểm cần nhớ

- `review-before-ship` là chỗ dừng duy nhất của pipeline, và chỉ dừng khi có
  blocker thật.
- Vi phạm ranh giới package, hoặc content script vượt 60KB gz, hoặc kéo Yjs
  vào content script — đều là blocker cứng, không phải góp ý.
