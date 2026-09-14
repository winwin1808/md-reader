# Intent: Phase 4 — Mindmap & Excalidraw
Author: Antigravity & User. Status: designed. Phase: 4
Design: docs/superpowers/specs/2026-09-14-phase-4-mindmap-excalidraw-design.md

## Problem
Khi đọc tài liệu Markdown dài hoặc phức tạp, người dùng gặp khó khăn trong việc nắm bắt cấu trúc toàn cảnh (big picture) của tài liệu; thanh điều hướng ToC dạng phẳng/danh sách văn bản chưa đủ trực quan để hình dung cây phân cấp ý tưởng. Đồng thời, tài liệu kỹ thuật có chứa các khối sơ đồ phác thảo Excalidraw hiện chỉ hiển thị chuỗi JSON thô hoặc không xem được trực tiếp trong bài viết.

## Proposed outcome
Người dùng có thể:
1. Bấm nút "Mindmap" trên TopToolbar (hoặc gõ phím tắt `Cmd+M` / `Ctrl+M`) để mở sơ đồ tư duy toàn màn hình chuẩn phong cách Markmap:
   - Cây phân cấp tự động tạo từ Headings (H1-H6) và danh sách lồng nhau.
   - Nhánh cong Bézier mượt mà, phân màu sắc riêng biệt cho từng nhánh lớn.
   - Nút tròn ở đầu nhánh cho phép gập (fold) / mở (unfold) nhánh con kèm animation động.
   - Hỗ trợ kéo di chuyển (pan), lăn chuột phóng to/thu nhỏ (zoom), và nút căn vừa màn hình (Fit to screen).
   - Click vào bất kỳ node nào trên Mindmap sẽ cuộn nhảy chính xác đến vị trí tiêu đề đó trong tài liệu Viewer.
   - Xuất sơ đồ Mindmap ra file ảnh PNG / SVG chất lượng cao.
2. Xem các khối sơ đồ ````excalidraw```` nhúng trực tiếp dạng vector phác thảo tay trong bài viết ở App page (với chế độ lazy-loading), và hiển thị placeholder an toàn ở content script (tuân thủ ngân sách ≤ 60KB gz).

## Affected packages
- `packages/core`: module `core/mindmap` phân tích mdast thành cây dữ liệu `MindNode` thuần TypeScript, không phụ thuộc DOM/browser.
- `packages/ui`: component `MindmapModal` (SVG + D3 hierarchy & zoom), component `ExcalidrawBlock` (nhúng SVG/viewMode trong bài đọc), kết nối nút công cụ TopToolbar và ExportModal.
- `apps/extension`: phím tắt `Cmd+M` / `Ctrl+M`, liên kết điều hướng 2 chiều giữa Mindmap và vùng cuộn của Document A4 trong `App.tsx`.

## Constraints
- Tuân thủ tuyệt đối 8 ràng buộc bất biến (Invariants) trong DESIGN.md:
  1. `packages/core` thuần TypeScript, không react, không document/DOM, không chrome.*.
  2. `packages/ui` React & CSS thuần, không chrome.*.
  3. `apps/extension` là nơi duy nhất dùng chrome.*.
  4. Content script KHÔNG kéo bundle Excalidraw hay thư viện nặng; ngân sách content.js giữ ≤ 60KB gz (hiện tại ~10.33KB).
  5. Excalidraw chỉ render ở app page, lazy-loaded, `viewModeEnabled: true`. Content script chỉ hiển thị placeholder card.
  6. Mindmap đồng bộ theme màu với hệ thống (kế thừa Light/Dark và 5 Color Themes).

## Open questions
- Mức độ mở rộng ban đầu của cây Mindmap khi mở modal: mặc định bung đến cấp mấy (đề xuất: mở toàn bộ nếu tài liệu ngắn, hoặc mở đến cấp 3 nếu tài liệu rất sâu, kèm nút "Bung tất cả / Gập tất cả").
- Định dạng xuất Mindmap: hỗ trợ cả SVG vector và PNG với nền trong suốt hoặc nền theme.

## Sub-phases
| # | Phase con | Xong nghĩa là |
|---|---|---|
| 4a | `core/mindmap` | Heading & list → cây `MindNode` phân cấp, có unit test cấu trúc và snapshot |
| 4b | `Mindmap` render | Component React `MindmapModal` toàn màn hình với d3-hierarchy, nhánh cong Bézier, zoom/pan mượt mà |
| 4c | Tương tác 2 chiều | Gập/mở nhánh con với animation, click node cuộn nhảy tới heading tương ứng trong Viewer |
| 4d | Excalidraw | Render khối ````excalidraw```` dạng sketch tay nhúng trong bài đọc ở app page (lazy); placeholder ở content script |
| 4e | Xuất Mindmap & E2E | Xuất sơ đồ Mindmap ra PNG/SVG, tích hợp nút Mindmap vào TopToolbar (`Cmd+M`) và hoàn tất E2E smoke tests |
