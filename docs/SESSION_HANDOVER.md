# Session Handover — md-reader

Cập nhật lần cuối: 2026-09-10

## Trạng thái hiện tại

Repo mới dựng khung. Chưa có phase nào chạy, chưa có dòng code app nào.

Đã có:

- `CLAUDE.md` — kiến trúc đã chốt (ranh giới package, parser remark, doc-model
  ChangeSet, chart plan, theme, export, test) + bảng 6 phase.
- `.claude/skills/` — 6 skill pipeline auto-chain, đã sửa cho stack này.
- `docs/superpowers/{intent,specs,plans}/` — rỗng.
- `pnpm-workspace.yaml`, `package.json`, `.gitignore` — workspace tối thiểu.

Chưa có: `packages/core`, `packages/ui`, `apps/extension`, `node_modules`,
`tsconfig.base.json`. Phase 1 tạo tất cả những thứ đó.

## Test counts

Chưa có test nào.

## Việc tiếp theo

Chạy `capture-intent` cho **phase 1 — Core view**. Nội dung phase 1 theo bảng
trong `CLAUDE.md`:

- Scaffold monorepo (`packages/core`, `packages/ui`, `apps/extension`, tsconfig, vitest)
- `packages/core`: parser remark + auto-format round-trip + doc-model ChangeSet
- `packages/ui`: Viewer + theme tokens
- `apps/extension`: content script (Shadow DOM) + app page + service worker + `chrome.storage.sync` cho theme
- mermaid lazy-load ở app page
- **SPIKE bắt buộc, làm đầu tiên:** mermaid có render được trong content script
  dưới CSP của trang chủ không, hay phải degrade sang nút mở app page

## Điểm cần nhớ

- `review-before-ship` là chỗ dừng duy nhất của pipeline, và chỉ dừng khi có
  blocker thật.
- Vi phạm ranh giới package là blocker cứng, không phải góp ý.
