# Intent: Phase 2 — Export & Themes
Author: Antigravity. Status: designed. Phase: 2

## Problem
Hiện tại app chưa có typography đẹp và các bộ theme màu sắc. Người dùng cần giao diện đọc đẹp, dễ dàng chọn các theme màu sắc kết hợp chế độ sáng/tối (light/dark) mà không cần tự code CSS.
Đồng thời, người dùng không có cách nào xuất tài liệu ra để chia sẻ cho người khác không dùng extension.

## Proposed outcome
- Bổ sung bộ Typography chuẩn và 5 bộ Theme màu (Midnight Navy, Evergreen, Burnt Sienna, Deep Rose, Obsidian/Ivory) người dùng có thể chọn trực tiếp.
- Nút Export cho phép xuất 3 định dạng:
  - HTML self-contained: Gói gọn toàn bộ CSS của Theme đang chọn và nhúng toàn bộ ảnh (để xem offline không bị lỗi mất ảnh).
  - PDF: Xuất PDF bố cục gọn gàng, tự ngắt trang.
  - Word (.docx): Chuyển đổi thành tài liệu Word chuẩn.

## Affected packages
- `@md-reader/core` (cho pipeline export HTML, docx)
- `@md-reader/ui` (cho CSS Typography, khai báo 5 Theme màu, và giao diện Picker/Dialog)
- `@md-reader/extension` (cho lưu tuỳ chọn Theme vào storage)

## Constraints
- Xuất HTML bắt buộc phải gom mọi resource (hình ảnh tải từ web) thành base64 hoặc nhúng trực tiếp, không lệ thuộc mạng để tránh lỗi không xem được ảnh khi offline.

## Open questions
- (Đã giải quyết) Sẽ triển khai chính xác 5 theme dựa trên các mã màu Hex do user cung cấp.

## Sub-phases
| # | Phase con | Xong nghĩa là |
|---|---|---|
| 2a | Typography & Themes | Bổ sung typography cho Viewer, UI chọn 5 theme màu, lưu trạng thái theme. |
| 2b | HTML self-contained | Inline CSS, SVG đã render, ảnh base64; mở offline vẫn đúng |
| 2c | mdast → docx | Heading, đoạn, list, table, code, link, ảnh |
| 2d | SVG → PNG | Raster hoá chart để nhúng docx |
| 2e | Print CSS + PDF | `@page`, ngắt trang, `window.print()` |
| 2f | `ExportDialog` | Nối đường trên vào UI có nút Export |
| 2g | E2E khói | Playwright: mở file → xuất đủ 3 định dạng |
Design: docs/superpowers/specs/2026-09-11-phase-2-design.md
