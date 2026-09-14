# Session Handover — md-reader

Cập nhật: 2026-09-11 (phiên 6). Branch đang đứng: `phase-2`.

## Đang ở đâu

**Phase 2 (Export & Trải nghiệm Đọc A4 UX/UI Chuyên nghiệp) đã hoàn tất toàn bộ!** 15/15 phase con merged vào `phase-2`.
Branch `phase-2` đã sẵn sàng để review và merge vào `main`.

| # | Phase con | Trạng thái |
|---|---|---|
| 2a | Typography & 5 Color Themes | ✅ done |
| 2a-opt | UI Layout & Settings Modal | ✅ done |
| 2a-ux | UX/UI Polish & Readability Audit | ✅ done |
| 2b | Standalone HTML Export (ảnh data URL) | ✅ done |
| 2c | mdast → Microsoft Word (.docx) | ✅ done |
| 2d | SVG → PNG Canvas Rasterizer | ✅ done |
| 2e | Print CSS & PDF (`window.print()`) | ✅ done |
| 2f | ExportModal UI & App Handlers | ✅ done |
| 2g | E2E Integration Smoke Test (Export & Themes) | ✅ done |
| 2h | Layout A4 & Progress Bar | ✅ done |
| 2i | Top Toolbar & Reading Mode (Font Scale [A-] [A+]) | ✅ done |
| 2j | In-document Search (Cmd+F & Match Highlight) | ✅ done |
| 2k | Elements: Code copy & Tables/Tasklist | ✅ done |
| 2l | ToC Navigation (Collapsible H1-H3) & Font Family | ✅ done |
| 2m | E2E UX & Reading Smoke Test | ✅ done |

Specs tương ứng:
- `docs/superpowers/specs/2026-09-11-phase-2-design.md` (Export & Themes)
- `docs/superpowers/specs/2026-09-11-phase-2-ux-revamp-design.md` (UX/UI Revamp A4)

## Kỹ năng & Công cụ bổ sung
- **`brainstorm-intent`**: Đã tích hợp skill brainstorm intent vào `.claude/skills/brainstorm-intent/SKILL.md` (giai đoạn tiền đề Stage 0 cho pipeline intent/spec/plan) và đã cập nhật vào `CLAUDE.md`.

## Chạy tiếp thế nào

Phase 2 đã hoàn tất toàn bộ và sẵn sàng mở MR vào `main`:
- Mở MR hoặc merge `phase-2` vào `main`:
  ```bash
  git checkout main
  git merge --no-ff phase-2 -m "Phase 2 — Export & Professional A4 Reading UX/UI"
  ```
- Bắt đầu session kế tiếp cho **Phase 3 (Trình chiếu / Presentation)** bằng cách chạy:
  ```
  /capture-intent
  ```
  Và yêu cầu: Bắt đầu **Phase 3 (Trình chiếu / Slides)**.

## Trạng thái xanh lúc dừng (đo thật, không phải nhớ)

```
pnpm --filter core test        8 test files, 82 passed
pnpm --filter ui test          15 test files, 93 passed
pnpm --filter extension test   8 test files, 22 passed
Tổng cộng                      31 test files, 197 passed
pnpm -r typecheck              exit 0
pnpm -r build                  exit 0
dist/content.js                25.77 kB, gz 10.14 kB (giới hạn 61.44 kB / 60KB)
```

Toolchain đã pin: `typescript@7.0.2` · `vitest@5.0.0` · `pnpm@10.10.0` ·
`vite@8.2.2` · `react@19.3.0` (một bản duy nhất) · `yjs@13.6.32` · `docx@9.5.3`.

## Nợ và Phát hiện trong quá trình Phase 2
- **Tối ưu UX/UI typography (2a-ux)**: Audit độc lập đã nâng chuẩn readability lên mức cao: cỡ chữ chuẩn 17px, line-height 1.7, độ rộng cột đọc chuẩn measure 740px, ToC dạng thanh chỉ mục hiện đại không bullet points, và khoảng đệm đáy trang 180px tránh cấn mép màn hình.
- **Tương thích kích thước SVG (2d)**: Các sơ đồ Mermaid sinh thẻ `<svg width="100%" viewBox="0 0 W H">`. Bộ rasterizer đã xử lý fallback ưu tiên viewBox intrinsic dimensions khi gặp thuộc tính phần trăm.
- **Chrome Blob download revocation (2f)**: Gọi `URL.revokeObjectURL` ngay lập tức khiến Chromium thi thoảng hủy download giữa chừng. Toàn bộ hàm export đã dùng `setTimeout(() => URL.revokeObjectURL(url), 1000)` để đảm bảo download ổn định tuyệt đối.
- **Proportional Font Scaling (2i)**: Cỡ chữ phóng to thu nhỏ ([A-], [100%], [A+]) áp dụng tỉ lệ `--md-font-scale-ratio` (0.85, 1.0, 1.15, 1.3) cho cả body text lẫn hệ thống tiêu đề H1-H6 đồng bộ.
- **In-document Search DOM safety (2j)**: Duyệt text nodes bằng `TreeWalker` thuần và highlight bằng thẻ `<mark>` tách rời; khi đóng tìm kiếm unwrap trả lại text node nguyên bản và gọi `normalize()`, tuyệt đối không mutate Y.Text CRDT hay gây re-parse document.
- **Async Clipboard write (2k)**: Nút copy trên code block header đợi `navigator.clipboard.writeText` resolve thành công trước khi hiển thị `Copied ✓` để tránh phản hồi giả lập khi permission bị từ chối.
