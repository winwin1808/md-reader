# Spec: Phase 4 — Mindmap & Excalidraw
Author: Antigravity & User. Status: designed. Phase: 4
Intent: docs/superpowers/intent/2026-09-14-phase-4-mindmap-excalidraw.md

## Sub-phase queue
- [x] 4a — `core/mindmap` AST extractor (Heading & list → `MindNode` tree) — done
- [ ] 4b — `MindmapModal` UI (D3-hierarchy / SVG tree, Markmap curve styling, zoom & pan) — planned
- [ ] 4c — Tương tác 2 chiều (Gập/mở nhánh, click node nhảy tới heading, TopToolbar button & `Cmd+M`)
- [ ] 4d — Excalidraw inline rendering (`ExcalidrawBlock` vector sketch ở app page, placeholder ở content script)
- [ ] 4e — Xuất Mindmap (SVG/PNG) & E2E smoke tests

## Approach chosen
- **Đã chọn**: Xây dựng kiến trúc module phân tầng:
  - `packages/core`: `core/mindmap` nhận `Root` mdast và trả về `MindNode` thuần túy, deterministic, không chạm DOM/React.
  - `packages/ui`: `MindmapModal` render SVG với layout phân cấp (d3-hierarchy), đường nhánh Bézier Markmap, tương tác zoom/pan mượt mà, gập/mở nhánh có animation. `ExcalidrawBlock` hiển thị sơ đồ phác thảo tay nhúng inline trong tài liệu A4 bằng vector SVG.
  - `apps/extension`: Tích hợp nút Mindmap trên TopToolbar, shortcut `Cmd+M`, và cơ chế cuộn mượt đến anchor heading tương ứng khi click node trên sơ đồ.
- **Phương án bị loại bỏ**: Import nguyên khối `markmap-view` và `@excalidraw/excalidraw` đồ sộ vì bundle quá nặng (>2.5MB), kéo theo KaTeX/Prism/editor canvas thừa thãi và gây rủi ro CSP trong Chrome MV3.

---

## Chi tiết thiết kế từng phase con

### 4a — `core/mindmap` AST extractor
* **Mục tiêu**: Trích xuất cây `MindNode` từ AST markdown.
* **Gói**: `packages/core` (tuân thủ ranh giới: thuần TypeScript, không React, không DOM).
* **Interfaces**:
  ```ts
  // packages/core/src/mindmap/mindmap.ts
  export interface MindNode {
    id: string
    text: string
    depth: number
    headingId?: string
    children: MindNode[]
  }

  export function extractMindmap(mdast: Root, fallbackTitle?: string): MindNode
  ```
* **Thuật toán**:
  - Duyệt qua các node `heading` (depth 1–6) và các node `list` trong `mdast`.
  - Node gốc có `depth: 0`, `text`: tiêu đề tài liệu (hoặc H1 đầu tiên, hoặc `fallbackTitle`, mặc định `"Document"`).
  - Các heading được gán vào cây theo cấp bậc phân cấp tự nhiên (H2 là con của H1 đứng trước, H3 là con của H2 đứng trước,...). Nếu tài liệu nhảy cấp (ví dụ H1 rồi tới H3), H3 sẽ gắn vào H1 gần nhất.
  - Gắn `headingId` tương thích với slug tạo bởi `extractToc` để sẵn sàng cho tính năng click-to-jump.
* **Tests**: Kiểm tra với tài liệu phẳng, tài liệu phân cấp chuẩn, tài liệu nhảy cấp, tài liệu không có heading (chỉ có list), snapshot test cây `MindNode`.
* **Sizing check**: 3 files (`packages/core/src/mindmap/mindmap.ts`, `packages/core/src/mindmap/mindmap.test.ts`, `packages/core/src/index.ts`), ~180 dòng diff, 1 test file mới. Đạt chuẩn.

---

### 4b — `MindmapModal` UI
* **Mục tiêu**: Component React hiển thị sơ đồ Mindmap toàn màn hình chuẩn Markmap với SVG, đường cong Bézier, màu sắc theo nhánh, zoom/pan.
* **Gói**: `packages/ui` (React & CSS, không chrome.*).
* **Interfaces**:
  ```tsx
  // packages/ui/src/components/MindmapModal.tsx
  export interface MindmapModalProps {
    root: MindNode
    isOpen: boolean
    onClose: () => void
    onNodeClick?: (node: MindNode) => void
    title?: string
  }

  export function MindmapModal(props: MindmapModalProps): React.JSX.Element | null
  ```
* **Layout & Styling**:
  - Dùng thuật toán cây phân cấp (tree layout) tính tọa độ `(x, y)` cho từng node.
  - Đường nối giữa các node là đường cong Bézier mượt mà (`M x0 y0 C (x0+x1)/2 y0, (x0+x1)/2 y1, x1 y1`).
  - Gán màu sắc riêng biệt cho từng nhánh gốc con của Root (dùng bảng màu trực quan: xanh dương, xanh lục, tím, cam, hồng,... đồng bộ theo theme).
  - Hỗ trợ kéo di chuyển chuột (pan) và lăn chuột (wheel zoom), có nút điều khiển nổi: `[+] Zoom In`, `[-] Zoom Out`, `[⛶] Fit to Screen`, `[✕] Đóng`.
* **Tests**: Test render modal, vẽ đúng số lượng SVG node và path, tương tác nút zoom và nút đóng.
* **Sizing check**: 4 files (`MindmapModal.tsx`, `MindmapModal.test.tsx`, `mindmap.css`, `index.ts`), ~260 dòng diff, 1 test file mới. Đạt chuẩn.

---

### 4c — Tương tác 2 chiều (Gập/mở nhánh & Navigation)
* **Mục tiêu**: Gập/mở từng nhánh con và bấm node cuộn nhảy tới nội dung Viewer tương ứng; kết nối nút TopToolbar và shortcut `Cmd+M`.
* **Gói**: `packages/ui` & `apps/extension`.
* **Tương tác**:
  - Mỗi node có nhánh con sẽ có nút tròn nhỏ (circle handle) ở đầu:
    - Click vào circle handle: Gập (collapse) hoặc Bung (expand) nhánh con.
    - Node bị gập hiển thị số lượng nhánh con bên trong (badge số nhỏ).
    - Có nút "Bung tất cả (Expand All)" và "Gập tất cả (Collapse All)".
  - Click vào chữ của node: Kích hoạt `onNodeClick(node)`, tự động đóng modal (hoặc giữ mở nếu người dùng chọn) và cuộn trang mượt mà (`scrollIntoView({ behavior: 'smooth' })`) tới phần tử có id `node.headingId`.
  - Thêm nút "Mindmap" trên sticky `TopToolbar` (cạnh nút Present / Search / Reading mode), gõ phím `Cmd+M` / `Ctrl+M` để bật tắt.
* **Tests**: Test toggle gập mở nhánh trong MindmapModal, test gọi callback `onNodeClick`, test click nút Mindmap trên TopToolbar.
* **Sizing check**: 4 files (`TopToolbar.tsx`, `TopToolbar.test.tsx`, `App.tsx`, `App.test.tsx`), ~190 dòng diff, 0 test file mới. Đạt chuẩn.

---

### 4d — Excalidraw inline rendering
* **Mục tiêu**: Hiển thị sơ đồ vector sketch tay từ khối ````excalidraw```` nhúng trực tiếp trong bài đọc ở app page (lazy); placeholder ở content script.
* **Gói**: `packages/ui` & `packages/core`.
* **Interfaces**:
  ```tsx
  // packages/ui/src/components/ExcalidrawBlock.tsx
  export interface ExcalidrawBlockProps {
    data: string // JSON string of Excalidraw elements
    title?: string
    isAppPage?: boolean
  }

  export function ExcalidrawBlock(props: ExcalidrawBlockProps): React.JSX.Element
  ```
* **Quy tắc bảo vệ**:
  - `packages/core`: Khi render markdown, nhận diện `code.language-excalidraw` hoặc div placeholder đặc trưng.
  - Trong `packages/ui/src/Viewer.tsx`: Mount `ExcalidrawBlock` thay vì thẻ `pre/code` thông thường cho khối `excalidraw`.
  - App page: Render các hình khối vector (rectangle, ellipse, arrow, text, line, freedraw) với phong cách vẽ sketch tay nhẹ nhàng, hoặc lazy-load SVG renderer.
  - Content script: Hiển thị card khung viền đứt nét thanh lịch: `[🎨 Sơ đồ Excalidraw — Bấm để mở trong MD Reader]` kèm nút mở tab app page. Không kéo bất kỳ bundle nặng nào vào content script, giữ gz content.js ≤ 60KB.
* **Tests**: Test parse khối excalidraw JSON hợp lệ và JSON hỏng, test render vector shapes, test chế độ placeholder trong content script.
* **Sizing check**: 5 files (`ExcalidrawBlock.tsx`, `ExcalidrawBlock.test.tsx`, `Viewer.tsx`, `excalidraw.css`, `index.ts`), ~250 dòng diff, 1 test file mới. Đạt chuẩn.

---

### 4e — Xuất Mindmap & E2E smoke tests
* **Mục tiêu**: Xuất sơ đồ Mindmap ra ảnh PNG và SVG chất lượng cao; bổ sung lựa chọn Mindmap vào ExportModal; hoàn tất E2E smoke test cho toàn bộ Phase 4.
* **Gói**: `packages/ui` & `apps/extension`.
* **Interfaces**:
  ```ts
  // packages/ui/src/export/export-mindmap.ts
  export function exportMindmapToSvg(svgElement: SVGSVGElement, title: string): string
  export function exportMindmapToPng(svgElement: SVGSVGElement, title: string, scale?: number): Promise<Blob>
  ```
* **Xuất ảnh**:
  - Nút "Tải ảnh SVG" và "Tải ảnh PNG" trực tiếp trên thanh công cụ của `MindmapModal`.
  - Tạo blob tải về an toàn, ảnh PNG có độ phân giải 2x sắc nét (Retina ready).
* **E2E Smoke Test**:
  - `apps/extension/e2e/mindmap.spec.ts`: Mở tài liệu có nhiều heading và 1 khối excalidraw -> bấm phím `Cmd+M` mở Mindmap -> kiểm tra hiển thị node -> click gập nhánh -> click nhảy heading -> kiểm tra xuất sơ đồ.
* **Sizing check**: 3 files (`export-mindmap.ts`, `export-mindmap.test.ts`, `e2e/mindmap.spec.ts`), ~200 dòng diff, 1 test file mới. Đạt chuẩn.
