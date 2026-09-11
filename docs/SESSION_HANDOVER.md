# Session Handover — md-reader

Cập nhật: 2026-09-11 (phiên 4). Branch đang đứng: `phase-1`.

## Đang ở đâu

**Phase 1 (Nền tảng & Trình đọc) đã hoàn tất!** 18/18 phase con merged vào `phase-1`.
Branch `phase-1` đã sẵn sàng để review và merge vào `main`.

| # | Phase con | Trạng thái |
|---|---|---|
| 1a | Spike CSP/mermaid | ✅ done |
| 1b1-1b4 | Skeletons | ✅ done |
| 1c1-1c2 | Parser & Render | ✅ done |
| 1d1-1d2 | Doc Model & History | ✅ done |
| 1e | Format round-trip idempotent | ✅ done |
| 1f1-1f2 | UI components | ✅ done |
| 1g1-1g3 | Extension shell & drop & registry | ✅ done |
| 1h1-1h2 | Content script injection & budget | ✅ done |
| 1i | Mermaid lazy loading | ✅ done |

Bảng đầy đủ + interface từng phase con:
`docs/superpowers/specs/2026-09-10-phase-1-design.md` §Sub-phase queue.

## Chạy tiếp thế nào

Phase 1 đã xong toàn bộ và đã open MR (simulated) để review.
Bắt đầu một session mới, chạy:
```
/capture-intent
```
Và yêu cầu: Bắt đầu **Phase 2 (Export)**.
Quá trình sẽ diễn ra từ đầu cho Phase 2: capture-intent → design-from-intent.

## Trạng thái xanh lúc dừng (đo thật, không phải nhớ)

```
pnpm --filter core test        6 test files, 62 passed
pnpm --filter ui test          4 test files, 16 passed
pnpm --filter extension test   3 test files, 10 passed
pnpm -r typecheck              exit 0
pnpm -r build                  exit 0
dist/content.js                25.70 kB, gz 10.10 kB (giới hạn 60KB)
```

Toolchain đã pin: `typescript@7.0.2` · `vitest@5.0.0` · `pnpm@10.10.0` ·
`vite@8.2.2` · `react@19.3.0` (một bản duy nhất, dùng chung ui + extension) ·
`yjs@13.6.32` · unified v11.

## Nợ và Phát hiện trong quá trình Phase 1
- **Ngân sách 60KB của content script**: `unified` + `rehype-highlight` quá nặng, lên tới hơn 150-200KB gz. Thay vì phải bundle chúng vào `content.js`, ta đã **giữ cho content script siêu nhẹ (chỉ mười mấy KB)** bằng cách thay vì xóa `document.body` và render lại nguyên giao diện Viewer, ta chỉ overlay (chèn) một nút bấm cố định "Open in MD Reader" vào DOM cũ. Giao diện markdown được Chrome render thô (raw plain text format fallback) và nút bấm sẽ đưa user vào trang `app.html` có bộ parser mạnh.
- **Mermaid lazy load (1i)**: Đã import `mermaid` qua dynamic `await import('mermaid')`.
