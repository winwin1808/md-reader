# Brainstorm: Phase 4 — Mindmap & Excalidraw

Author: Antigravity & User. Date: 2026-09-14. Status: draft.

## Ý tưởng thô ban đầu
- Trải nghiệm sơ đồ tư duy (Mindmap) giống **Markmap**: chuyển cấu trúc Heading và List trong tài liệu Markdown thành cây sơ đồ phân nhánh tương tác toàn màn hình (fullscreen).
- Nhúng sơ đồ **Excalidraw** hiển thị trực tiếp trong bài viết (inline embedded diagram).

---

## Nghiên cứu thị trường & Đối chuẩn

1. **Markmap (https://markmap.js.org)**
   - *Kiến trúc*: Tách biệt giữa `markmap-lib` (biến đổi Markdown/headings thành cây phân cấp) và `markmap-view` (render SVG tương tác qua D3).
   - *Trải nghiệm người dùng*:
     - Đường nhánh cong Bézier mượt mà (`d3-shape` linkHorizontal), tự động phân màu riêng biệt theo từng nhánh cấp 1/2.
     - Các nút tròn (circle handles) ở đầu mỗi nhánh có thể bấm để gập (fold) / mở (unfold) kèm animation mượt mà.
     - Điều hướng linh hoạt: Kéo nền để di chuyển (pan), lăn chuột hoặc chụm cảm ứng để phóng to/thu nhỏ (zoom), nút "Fit to screen" để căn giữa sơ đồ.
     - Nhấp vào tiêu đề node có thể nhảy tới vùng nội dung tương ứng trong văn bản gốc.

2. **Obsidian Markmap & VS Code Markmap Plugins**
   - Người dùng thường kích hoạt Mindmap qua nút bấm trên thanh công cụ hoặc phím tắt (`Cmd+M`).
   - Mở ra một modal toàn màn hình (fullscreen overlay) với nền mờ hoặc tối ưu không gian rộng lớn để quan sát toàn bộ kiến trúc tài liệu nhiều chương mục.
   - Hỗ trợ xuất ảnh sơ đồ (PNG / SVG) để đưa vào slide hoặc tài liệu chia sẻ.

3. **Excalidraw in Markdown (Obsidian Excalidraw, Plate.js, GitHub code blocks)**
   - Khối sơ đồ được định nghĩa dạng fenced code block:
     ```markdown
     ```excalidraw
     {
       "type": "excalidraw",
       "version": 2,
       "elements": [...]
     }
     ```
     ```
   - *Hiển thị*: Khi xem tài liệu, code block này không hiển thị chuỗi JSON thô mà render thành vector drawing dạng sketch tay đặc trưng của Excalidraw ở chế độ `viewModeEnabled: true`.
   - *Ràng buộc kiến trúc MV3*: `@excalidraw/excalidraw` có dung lượng rất lớn (>2MB). Do đó, việc lazy-load ở app page là bắt buộc; trong content script chỉ hiển thị placeholder thanh lịch để giữ ngân sách ≤ 60KB gz.

---

## Nhu cầu người dùng

1. **Xem toàn cảnh cấu trúc tài liệu (Big Picture)**:
   - Các tài liệu Markdown dài (sách, tài liệu kỹ thuật, đề cương) khiến người đọc dễ bị "lạc" trong chi tiết. ToC dạng thanh bên chỉ hiển thị danh sách dọc phẳng hoặc thụt dòng đơn điệu.
   - Sơ đồ Mindmap toàn màn hình giúp người dùng nhìn thấy mối liên hệ giữa các chủ đề lớn và chủ đề phụ chỉ trong một cái liếc mắt.
2. **Tương tác linh hoạt**:
   - Khả năng thu gọn các nhánh con giúp tập trung suy nghĩ vào một nhánh cụ thể mà không bị rối mắt.
   - Click vào node trên sơ đồ để cuộn nhảy ngay đến phần tương ứng trong bài đọc.
3. **Trực quan hóa sơ đồ vẽ tay Excalidraw**:
   - Tài liệu kỹ thuật ngày càng ưa chuộng sơ đồ Excalidraw nhờ tính thân thiện, dễ hiểu. Người dùng muốn xem được các sơ đồ này vẽ trực tiếp trong bài đọc thay vì một khối JSON hay phải mở tab Excalidraw bên ngoài.
4. **Xuất sơ đồ chia sẻ**:
   - Khả năng lưu sơ đồ tư duy ra file ảnh PNG / SVG để gửi cho đồng nghiệp hoặc chèn vào báo cáo.

---

## Các hướng đã cân nhắc

### Hướng 1: Kéo toàn bộ thư viện gốc `markmap-view` + `@excalidraw/excalidraw`
* **Mô tả**: Import trực tiếp 2 package npm này vào `@md-reader/ui`.
* **Ưu điểm**: Có sẵn hầu hết mọi tính năng của 2 thư viện upstream.
* **Đánh đổi / Rủi ro**:
  - Dung lượng bundle tăng vọt nhiều megabyte, vi phạm triết lý tối ưu hiệu năng của extension.
  - `@excalidraw/excalidraw` kéo theo hàng chục dependencies nặng và font nội tuyến phức tạp, có nguy cơ xung đột CSP (Content Security Policy) trong Chrome MV3.

### Hướng 2: Engine Mindmap D3/SVG chuẩn Markmap + Excalidraw SVG/Canvas nhúng lazy (Khuyến nghị)
* **Mô tả**:
  - `packages/core`: Module `core/mindmap` phân tích AST của tài liệu thành cấu trúc cây `MindNode` thuần TypeScript (id, depth, text, children, collapsed).
  - `packages/ui`:
    - `MindmapModal`: Component toàn màn hình render SVG dùng thuật toán `d3-hierarchy` + `d3-zoom`, tạo nhánh cong Bézier, gán màu theo nhánh, nút tròn gập/mở nhánh, thanh công cụ điều khiển (Zoom in/out, Fit to screen, Collapse All, Export PNG/SVG).
    - `ExcalidrawBlock`: Tích hợp render khối ````excalidraw```` trong bài đọc; app page nạp lazy `exportToSvg` / viewMode; content script render placeholder badge an toàn.
  - `apps/extension`: Thêm nút bật "Mindmap" trên TopToolbar (kèm phím tắt `Cmd+M` / `Ctrl+M`), kết nối tính năng click-to-navigate giữa Mindmap và A4 Document.
* **Ưu điểm**:
  - Trực quan, animation mượt mà, layout đẹp chuẩn Markmap.
  - Giữ vững 8 ràng buộc bất biến (Invariants) của repo: Content script vẫn siêu nhẹ (~10KB gz), không CSP issue, core hoàn toàn thuần TS.
  - Trải nghiệm người dùng đúng như yêu cầu: "Toàn màn hình, nhúng trong bài".

### Hướng 3: Mindmap thu nhỏ ở Sidebar
* **Mô tả**: Thay thế hoặc bổ sung Mindmap vào thanh bên ToC.
* **Ưu điểm**: Nhìn thấy đồng thời cả văn bản và sơ đồ nhỏ.
* **Đánh đổi**: Không gian thanh bên quá hẹp (260px-320px) khiến sơ đồ cây bị gò bó, khó đọc các nhánh sâu, không đáp ứng yêu cầu "Toàn màn hình".

---

## Hướng đề xuất

Chọn **Hướng 2**:
1. Xây dựng `core/mindmap` tách bạch trong `@md-reader/core`.
2. Tạo component `MindmapModal` toàn màn hình trong `@md-reader/ui` với D3 layout chuẩn Markmap (nhánh cong, màu sắc phân cấp, gập mở động, click nhảy tới heading trong Viewer).
3. Hỗ trợ render block ````excalidraw```` nhúng trực tiếp trong tài liệu đọc (Viewer) ở App page với lazy loading, và placeholder trong content script.
4. Tích hợp nút xuất Mindmap ra ảnh PNG/SVG.
5. Thêm nút "Mindmap" (icon cây thư mục / não bộ) trên TopToolbar sticky 48px và phím tắt `Cmd+M`.

---

## Câu hỏi mở cho Intent

1. Khối code Excalidraw nên hỗ trợ cú pháp ````excalidraw```` hay cả đường dẫn ảnh `![](diagram.excalidraw)`?
2. Khi mở Mindmap toàn màn hình, mức độ mở rộng mặc định của cây là bao nhiêu cấp (mở hết hay chỉ mở đến H2/H3 để tránh tràn màn hình khi tài liệu quá dài)?
3. Xuất Mindmap: Cho phép xuất nền trong suốt (transparent) hay theo màu theme hiện tại?
