# Session Handover — md-reader

Cập nhật: 2026-09-14 (phiên 9). Branch: `phase-4-mindmap` (sẵn sàng merge vào `main`).

## Đang ở đâu

**Phase 4 (Mindmap chuẩn Markmap & Excalidraw Sơ đồ nhúng) đã hoàn tất toàn bộ 5/5 phase con trên branch `phase-4-mindmap`!**

| # | Phase con | Trạng thái |
|---|---|---|
| 4a | `core/mindmap` AST extractor (Heading & list → `MindNode` tree, slug nhất quán ToC) | ✅ done |
| 4b | `MindmapModal` UI (D3-hierarchy / SVG tree, đường cong Bézier Markmap, zoom & pan) | ✅ done |
| 4c | Tương tác 2 chiều (Gập/mở nhánh với badge +N, cuộn đến heading, TopToolbar button & `Cmd+M`) | ✅ done |
| 4d | Excalidraw inline rendering (`ExcalidrawBlock` vector SVG ở app page, placeholder ở content script) | ✅ done |
| 4e | Xuất Mindmap (SVG/PNG reset transform, padded viewBox, safe download) & E2E smoke tests | ✅ done |

Specs & Intent tương ứng:
- `docs/superpowers/intent/2026-09-14-phase-4-mindmap-excalidraw.md`
- `docs/superpowers/specs/2026-09-14-phase-4-mindmap-excalidraw-design.md`
- Các plans: `docs/superpowers/plans/2026-09-14-phase-4-4{a,b,c,d,e}-plan.md`

## Trạng thái xanh lúc dừng (đo thật, không phải nhớ)

```
packages/core test        11 test files, 123 passed
packages/ui test          21 test files, 162 passed
apps/extension test       10 test files, 39 passed
Tổng cộng                 42 test files, 324 passed
pnpm -r typecheck         exit 0
pnpm -r build             exit 0
dist/content.js           26.56 kB, gz 10.23 kB (giới hạn 61.44 kB / 60KB)
```

## Tính năng đã hoàn tất ở Phase 4

1. **`core/mindmap` AST extractor:**
   - Trích xuất cấu trúc phân cấp từ AST mdast thành cây `MindNode`.
   - Node gốc `depth: 0`, tiêu đề lấy từ H1 đầu tiên hoặc fallback title.
   - Headings lồng phân cấp tự nhiên, hỗ trợ skipping levels.
   - `headingId` đồng bộ slug với `extractToc` phục vụ click-to-jump.

2. **`MindmapModal` giao diện toàn màn hình:**
   - Render SVG sắc nét, nền mờ `backdrop-filter: blur(12px)`.
   - Cây layout ngang từ trái sang phải với khoảng cách động theo cấp.
   - Đường cong Bézier Markmap mượt mà: `M ... C ...`.
   - 7 màu nhánh phân cấp (`#2563eb`, `#10b981`, `#8b5cf6`, `#f59e0b`, `#ec4899`, `#06b6d4`, `#f97316`) kế thừa xuống các nhánh con.
   - Tương tác canvas SVG: kéo chuột pan, lăn chuột wheel zoom quanh con trỏ (clamped 0.2x–3.0x), nút Fit to Screen, Zoom In/Out, phím Escape đóng modal.

3. **Tương tác 2 chiều & điều hướng:**
   - Nút tròn toggle gập/mở nhánh với badge pill hiển thị số lượng con bị ẩn (`+N`).
   - Nút tiện ích `Expand All` (⊞) và `Collapse All` (⊟).
   - Nút Mindmap trên `TopToolbar` cạnh nút Present.
   - Phím tắt toàn cục `Cmd+M` / `Ctrl+M` đóng/mở nhanh.
   - Click node tự động đóng modal và cuộn mượt (`scrollIntoView({ behavior: 'smooth' })`) tới heading tương ứng trong tài liệu.

4. **Sơ đồ Excalidraw nhúng (`ExcalidrawBlock`):**
   - Hỗ trợ khối mã ````excalidraw```` trong Markdown.
   - Vector renderer thuần SVG, không kéo thư viện canvas nặng nề, giữ nguyên chuẩn MV3 CSP.
   - Hỗ trợ đầy đủ các hình phác thảo: hình chữ nhật, hình thoi, hình elip, đoạn thẳng, mũi tên có đầu nhọn, chữ viết, nét vẽ tự do (freedraw).
   - Tự động tính toán `viewBox` bao bọc và padding 24px.
   - Content script render card placeholder nét đứt nhẹ nhàng, bảo toàn ngân sách bundle (~10KB gz).

5. **Xuất Mindmap & E2E smoke tests:**
   - Nút xuất file `Tải SVG` và `Tải PNG` độ phân giải cao (2x Retina ready).
   - Reset transform hiển thị khi xuất, tính toán `viewBox` khớp bounding box thực tế kèm padding 40px, đảm bảo sơ đồ không bị lệch hay cắt xén kể cả khi đang pan/zoom.
   - Thu hồi `URL.revokeObjectURL` bất đồng bộ an toàn.
   - Bộ E2E smoke test Playwright/Vitest toàn diện kiểm thử end-to-end từ render Excalidraw, mở modal, tương tác gập mở, cuộn heading và tải ảnh.

## Phase tiếp theo

- **Phase 5 (Chỉnh sửa / Editor & Lưu đĩa)**:
  - Tích hợp CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `y-codemirror.next`).
  - Chế độ chia đôi màn hình Split-view (Editor bên trái, Live Preview bên phải) hoặc toggle View/Edit.
  - Lưu file an toàn thông qua File System Access API hoặc fallback download.
  - Cảnh báo và phát hiện xung đột file ngoài đĩa.
