# Intent: Phase 2 — Trải nghiệm Đọc A4 & UX/UI Chuyên nghiệp
Author: Antigravity. Status: designed. Phase: 2
Design: docs/superpowers/specs/2026-09-11-phase-2-ux-revamp-design.md

## Problem
Giao diện đọc Markdown hiện tại mới chỉ là trình render HTML thông thường, chưa mang lại cảm giác như đang cầm đọc một tài liệu A4 chuyên nghiệp. Người dùng gặp các hạn chế sau khi đọc tài liệu dài:
1. Thiếu bố cục trang A4 trung tâm có sự tách biệt rõ ràng giữa workspace background và document surface (shadow, viền mềm, lề chuẩn).
2. Thiếu thanh Top Toolbar tinh gọn để xem tên tài liệu, điều chỉnh nhanh cỡ chữ (A- / A+), thanh đo tiến độ đọc (reading progress), chuyển đổi theme và kích hoạt chế độ tập trung (Reading mode / Fullscreen).
3. Thiếu công cụ tìm kiếm trong tài liệu (In-document search) với highlight từ khoá, bộ đếm số lượng kết quả và phím tắt điều hướng nhanh.
4. Các phần tử nội dung Markdown chưa đạt chuẩn xuất bản cao cấp: code block chưa có nhãn ngôn ngữ và nút Copy tiện lợi; bảng biểu (tables) chưa có màu header nhấn theo theme trang và thanh cuộn ngang khi bảng rộng; task list checkbox chưa được styling nhất quán.
5. ToC chưa hỗ trợ thu gọn/mở rộng phân cấp H1-H3 mượt mà và chưa có tuỳ biến họ font chữ (Sans-serif, Serif, Monospace).

## Proposed outcome
Người dùng mở bất kỳ file Markdown nào sẽ có trải nghiệm đọc "Reading a beautifully formatted document":
- Trang tài liệu nằm ở trung tâm với tỷ lệ và lề A4, nổi bật trang nhã trên nền workspace.
- Thanh Top Toolbar cố định tinh gọn, có thanh tiến độ đọc mỏng ở đỉnh đầu, nút bật/tắt ToC, điều khiển font size, nút Search và chế độ Reading Mode.
- Tìm kiếm nhanh bằng `Cmd+F` với highlight tức thì và bộ đếm kết quả trực quan.
- Code blocks có badge ngôn ngữ và nút Copy với trạng thái phản hồi "Copied ✓".
- Bảng biểu có header trang nhã đồng bộ với accent theme, hỗ trợ zebra striping và cuộn ngang an toàn.
- ToC điều hướng mượt mà, hỗ trợ font family tùy chọn và giữ nguyên ngân sách hiệu năng siêu nhẹ.

## Affected packages
- `packages/ui`: Các components giao diện (Document Page container, Reading Progress, Top Toolbar, In-document Search bar, CodeBlock header/copy, Table styling, ToC collapsible rail, Font controls).
- `apps/extension`: App page wiring, bàn phím shortcuts (`Cmd+F`, `Esc`, `A+`, `A-`), quản lý trạng thái reading settings trong `chrome.storage.sync`.
- `packages/core`: Các tiện ích trích xuất tìm kiếm hoặc xử lý nếu cần (hoàn toàn pure TS).

## Constraints
- Tuân thủ nghiêm ngặt 8 Ràng buộc khoá cứng trong `docs/DESIGN.md`.
- Giữ nguyên ranh giới package: `packages/ui` không chứa `chrome.*`, `packages/core` thuần TS.
- Ngân sách content script không bị ảnh hưởng (các cải tiến UI A4 nằm trọn vẹn trong `apps/extension` app page và `packages/ui`).
- Giữ vững 151 test cases đã xanh của Phase 1 và Phase 2.
- Kích cỡ mỗi phase con tuân thủ: ≤ 5 files chạm, ≤ 300 dòng diff, ≤ 1 test file mới.

## Open questions
- *Font size scaler*: Hỗ trợ 4 mức chuẩn (Small: 15px, Medium: 17px, Large: 19px, XL: 22px) hay scale tỷ lệ % (90%, 100%, 115%, 130%)? -> Giai đoạn spec sẽ chốt (đề xuất 4 mức font size rõ ràng 15/17/19/22px với base 17px là 100%).
- *In-document search*: Sử dụng native DOM text node tree-walking hay RegExp trên source Y.Text? -> DOM text node walker kết hợp `<mark>` tags để scroll chính xác và không phá vỡ Y.Doc source.

## Sub-phases
| # | Phase con | Xong nghĩa là |
|---|---|---|
| 2h | Layout A4 & Progress | Workspace vs Document A4 page (shadow, padding, subtle border), thanh reading progress |
| 2i | Top Toolbar & Reading Mode | Sticky toolbar, font-size scaler (A- / A+), Reading mode tối giản, Fullscreen |
| 2j | In-document Search | Tìm kiếm trong tài liệu (Cmd+F / toolbar), highlight từ khoá, counter N/M, Next/Prev |
| 2k | Elements: Code copy & Tables | Code block language badge + copy button; table header ăn màu theme; zebra striping; task list |
| 2l | ToC Navigation & Font Family | ToC collapse/expand H1-H3, scroll-spy indicator; tuỳ chọn font family (Sans/Serif/Mono) |
| 2m | E2E UX & Reading Smoke | Test tích hợp toàn bộ tính năng đọc: toolbar, font scale, search, copy code, reading mode |
