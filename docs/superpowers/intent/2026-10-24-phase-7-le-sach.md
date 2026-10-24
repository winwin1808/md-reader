# Intent: Phase 7 — Giao diện Lề sách (+ logo app)
Author: haonq. Status: shipped. Phase: 7
Design: docs/superpowers/specs/2026-10-24-phase-7-design.md

Nguồn: lựa chọn của người dùng ngày 2026-10-23 — "Chọn style A, sửa lại, design thêm cái logo
App" — trên mockup `docs/design/ui-redesign-options.html` (phương án A · Lề sách) và bản audit
`docs/design/2026-10-23-ui-audit.md`. Phase 7 xếp chồng trên `phase-6` (branch `phase-7` rẽ từ
`phase-6`), vì giao diện mới dựa vào các hook và trạng thái phase 6 đã tạo (saveState, banner
xung đột/xin quyền, registry, checkpoint).

## Problem

Giao diện hiện tại không có bản sắc: token là bản sao GitHub Primer, icon là emoji/ký tự
Unicode, mỗi component tự chọn radius/shadow/blur. Chữ thân ~11.9px trên dòng ~110-120 ký tự.
Năm "theme màu" đổi màu chữ thân sang màu bão hoà (cam ≈ 2.2:1). Nhiều biến CSS được dùng
nhưng không được định nghĩa, nên editor, toolbar định dạng, modal xung đột luôn sáng trong dark
mode. Không có `:focus-visible`, không có `prefers-reduced-motion`. Copy trộn Anh/Việt. ToC
không có scroll-spy hiển thị. Toolbar vỡ ở ~400px. Slide không scale theo màn. Speaker view chữ
16px. Mindmap tô màu cầu vồng theo index. Content script chỉ là một thẻ nổi 📖 trên trang `<pre>`
thô và nạp nguyên app.css ~100KB cho một nút. Extension chưa có logo — dùng icon mặc định.

## Proposed outcome

Mọi bề mặt — app page (đọc, soạn, split, cài đặt, xuất, xung đột), trình chiếu + speaker view,
mindmap, widget content script, file HTML/PDF/Word xuất ra — dùng **một lớp token "Lề sách"**:
Giấy #F1F3F2 · Mặt #E5EAE7 · Mực #1B2422 · Chì #5E6A67 · Kẻ #D3DAD7 · Dạ quang #F3DE4A ·
Xanh mực #23568C; ba bảng màu Giấy / Than chì / Tương phản cao; chữ Literata (thân), IBM Plex
Sans (giao diện), IBM Plex Mono (mã) — đóng gói cục bộ, có subset tiếng Việt. Chữ thân 17–19px,
cột ≤ 70ch. Cấu trúc nằm ở lề: mục lục bên trái đánh dấu mục đang đọc bằng nét dạ quang; GitHub
alerts thành ghi chú bên lề phải (gập vào thân bài khi hẹp). Dạ quang chỉ dùng cho "bạn đang ở
đây" và kết quả tìm kiếm. Một bộ icon SVG; toàn bộ copy tiếng Việt, gọi theo việc người dùng
làm; trạng thái lưu bằng chữ. Có logo app (SVG gốc + PNG 16/32/48/128) dùng cho icon extension,
favicon app page, empty state. Bàn phím đi được mọi nơi, focus ring rõ, tôn trọng reduced-motion,
chữ thân ≥ 7:1.

## Affected packages

`packages/ui` (token CSS, theme, mọi component, icon set, Deck/SpeakerView/Mindmap) ·
`apps/extension` (app shell CSS, fonts, logo/icons, manifest icons, content widget + content.css,
settings copy) · `packages/core` chỉ chỗ sinh markup/CSS cho export HTML và styles của Word.

## Constraints

Ngoài 8 ràng buộc khoá cứng của DESIGN.md:

- Không đổi dữ liệu / schema / hành vi lưu của phase 6 — phase này là giao diện.
- Content script vẫn ≤ 60KB gz (JS) và không Yjs; widget dùng `content.css` riêng nhỏ gọn.
- Font đóng gói cục bộ (không gọi Google Fonts lúc chạy — extension phải chạy offline và không rò
  rỉ việc đọc tài liệu ra ngoài).
- Không thêm framework UI / CSS-in-JS / state manager; CSS thuần + custom properties.
- Mỗi phase con vẫn theo điều kiện kích cỡ (≤5 file, ≤300 dòng, ≤1 file test mới).

## Open questions

- Giữ hay bỏ 5 "theme màu" cũ? (đề xuất: bỏ, thay bằng 3 bảng màu Lề sách; migrate setting cũ)
- Content script: render Markdown tại chỗ (deferred 7l từ phase 6) trong phase này hay sau?
- Logo: dạng nào thể hiện "Lề sách" ở 16px vẫn đọc được?
- PNG icon sinh bằng gì khi repo không có công cụ raster? (Playwright/Chromium đã có sẵn)
- Confetti khi đọc xong: giữ (tắt mặc định, tôn trọng reduced-motion) hay bỏ?
