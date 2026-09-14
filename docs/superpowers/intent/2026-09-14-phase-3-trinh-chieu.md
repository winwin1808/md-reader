# Intent: Phase 3 — Trình chiếu (Presentation & Slides)
Author: Antigravity. Status: designed. Phase: 3
Design: docs/superpowers/specs/2026-09-14-phase-3-design.md

## Problem
Hiện tại md-reader chỉ cung cấp trải nghiệm đọc tài liệu liên tục theo khổ A4 hoặc webpage thông thường. Khi người dùng cần trình bày hoặc giảng dạy nội dung từ file Markdown, họ phải copy sang các phần mềm trình chiếu khác (Google Slides, PowerPoint) hoặc dùng công cụ rời rạc. md-reader cần một chế độ Trình chiếu (Present mode) tích hợp sẵn: mở file Markdown bất kỳ, bấm "Present", tài liệu lập tức biến thành slide deck chuyên nghiệp, toàn màn hình, hỗ trợ phím điều hướng, đồng hồ diễn giả, ghi chú (Speaker Notes) và xuất PDF slide.

## Proposed outcome
Người dùng mở tài liệu Markdown trong extension:
1. Có nút "Present" trên TopToolbar (và phím tắt `P`).
2. Khi bật trình chiếu, tài liệu tự động chia thành danh sách Slide:
   - Ranh giới mặc định là thẻ ngắt `---` (`thematicBreak`).
   - Hỗ trợ cấu hình chia theo heading (ví dụ: mỗi H1 hoặc H2 là 1 slide mới).
3. Giao diện trình chiếu (`Deck`):
   - Chế độ toàn màn hình (Fullscreen API), tỉ lệ chuẩn 16:9, căn giữa nội dung.
   - Hỗ trợ đầy đủ các thành phần Markdown: heading, text, code block, tables, mermaid diagrams.
   - Điều hướng bàn phím trực quan: `→` / `Space` (slide sau), `←` / `Backspace` (slide trước), `Home` / `End`, `Esc` (thoát trình chiếu).
   - Thanh tiến độ slide mỏng ở đáy màn hình và bộ đếm `Slide X / Y`.
4. Chế độ Diễn giả (`SpeakerView`):
   - Hỗ trợ cú pháp ghi chú diễn giả: `<!-- note: nội dung ghi chú -->` hoặc `<!-- speaker: ... -->`.
   - Mở cửa sổ hoặc tab diễn giả riêng biệt (hoặc split view), đồng bộ 2 chiều qua `BroadcastChannel`.
   - Hiển thị slide hiện tại, xem trước slide kế tiếp (next slide preview), đồng hồ bấm giờ (elapsed / current time), và phần ghi chú của diễn giả (speaker notes).
5. Xuất Slide ra PDF:
   - Print CSS landscape 16:9 dành riêng cho slide presentation, mỗi slide trọn vẹn trên một trang in.
   - Tích hợp tuỳ chọn "Xuất Slide PDF" trong `ExportModal`.

## Affected packages
- `packages/core`:
  - Module `core/slides`: nhận mdast / source markdown, trích xuất `Slide[]` bao gồm nội dung html/ast và `notes` (speaker notes), hỗ trợ split strategy (`hr` hoặc `heading`).
- `packages/ui`:
  - Component `Deck`: toàn màn hình, điều hướng slide, animation chuyển slide, progress bar, responsive 16:9 container.
  - Component `SpeakerView`: giao diện diễn giả hiển thị current slide, next slide preview, timer, speaker notes panel.
  - Styles: CSS cho slide deck, responsive aspect ratio, dark/light presentation theme, và print styles cho slide landscape.
- `apps/extension`:
  - Tích hợp Present mode vào App page layout và TopToolbar.
  - Quản lý mở cửa sổ `SpeakerView` (popup window hoặc separate tab) và giao tiếp đồng bộ realtime qua `BroadcastChannel`.
  - Tích hợp tuỳ chọn xuất Slide PDF vào luồng export.

## Constraints
- Tuân thủ nghiêm ngặt 8 ràng buộc khoá cứng trong `docs/DESIGN.md`:
  - Y.Doc là nguồn sự thật duy nhất, không thay đổi schema formatVersion nếu không có migration.
  - `packages/core` thuần TypeScript, không phụ thuộc DOM hay React hay `chrome.*`.
  - `packages/ui` chỉ chứa React & CSS, không gọi trực tiếp `chrome.*`.
  - Content script không bị ảnh hưởng, giữ nguyên ngân sách bundle ≤ 60KB gz.
- Slide presentation không làm mất hay sai lệch định dạng của các code blocks, tables, hoặc mermaid diagrams.
- Speaker notes ẩn hoàn toàn trên màn hình chính của khán giả.

## Open questions
- *Cơ chế đồng bộ Main Deck và Speaker View*: Sử dụng `BroadcastChannel("md-reader-slides")` tiêu chuẩn của trình duyệt, tự động kết nối và đồng bộ chỉ số slide `currentSlideIndex` giữa 2 cửa sổ mà không cần background service worker trung gian.
- *Slide splitting fallback*: Nếu tài liệu không chứa bất kỳ thẻ `---` nào, parser sẽ tự động nhóm các phần theo Heading level cao nhất (H1 hoặc H2) để người dùng có thể trình chiếu ngay lập tức mà không cần sửa file trước.

## Sub-phases
Theo `docs/DESIGN.md` §4:

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 3a | `core/slides` | mdast → `Slide[]`, cắt theo `---` hoặc heading depth cấu hình được, trích xuất speaker notes |
| 3b | `Deck` UI | Render slide deck 16:9, keyboard nav (←, →, Space, Esc), fullscreen, progress bar |
| 3c | `SpeakerView` UI | Giao diện diễn giả: current slide, next slide preview, timer đồng hồ, speaker notes |
| 3d | App & Speaker Sync | Tích hợp Present vào TopToolbar/App, sync 2 chiều qua BroadcastChannel, cửa sổ speaker riêng |
| 3e | Deck → PDF Export | Print CSS landscape chuyên dụng cho slide, tích hợp vào ExportModal |
