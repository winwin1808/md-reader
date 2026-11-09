# Intent: Phase 19 — PDF trình chiếu không cắt chữ
Author: haonq. Status: designed. Phase: 19
Design: docs/superpowers/specs/2026-11-09-phase-19-design.md

## Problem
Xuất PDF trình chiếu (và cả khi trình chiếu trên màn hình) bị cắt chữ. Slide có kích thước cố định 1280×720 với `overflow: hidden`, còn `splitIntoSlides` chỉ chia theo
cấu trúc Markdown (`---` hoặc heading), không biết nội dung có vừa hay không, nên phần dư biến mất mà không báo gì. Người dùng cũng không có cách ngắt thủ công an toàn: ở chế độ
`auto`, chỉ một dấu `---` là đổi cách chia của cả tài liệu.

## Proposed outcome
- Nội dung dài tự chảy sang slide kế tiếp, ngắt giữa các khối, không còn chữ bị cắt ở PDF, Trình chiếu và Speaker view; ba nơi này ra cùng số slide.
- Một khối quá lớn so với một slide (bảng, code, ảnh) được thu nhỏ cho vừa.
- Người dùng đặt chỗ ngắt bằng `<!-- slide-break -->`, hoặc bấm "Ngắt slide tại đây" ở chế độ Sửa. Dấu không hiện khi đọc, không đổi cách chia phần còn lại, và có hiệu lực dù tự chia bật hay tắt.
- Có cài đặt bật/tắt tự chia, mặc định bật.

## Affected packages
`packages/core` (dấu ngắt, thuật toán chia theo chiều cao) · `packages/ui` (đo, `Deck`, `SpeakerView`, print CSS, Cài đặt, nút trong editor, i18n) · `apps/extension` (nối cài đặt, luồng xuất) · `apps/web` nếu dùng chung `Deck` · docs.

## Constraints
- 8 ràng buộc khoá cứng. PDF vẫn bằng print CSS + `window.print()`, không thư viện PDF.
- `packages/core` không `document`/`window`: đo DOM nằm ở `packages/ui`, thuật toán chia là hàm thuần trong core.
- Dấu ngắt là chú thích HTML trong `Y.Text "source"`, không đổi schema Y.Doc. Chèn dấu phải là delta nhỏ nhất (giao dịch CodeMirror).
- Dấu không được bị coi là dấu ngắt khi nằm trong khối code, và không được lộ ra ở bản đọc, HTML, Word, PDF tài liệu.
- Không tách giữa một khối (đoạn, bảng, code, danh sách đã giữ nguyên khối trừ khi quá lớn). Speaker notes đi theo slide đầu tiên của phần được chia.
- Không thêm dependency.

## Open questions
- Danh sách quá dài: tách theo mục hay coi là khối thu nhỏ.
- Có lặp tiêu đề ở slide tiếp nối không.
- Mức thu nhỏ tối thiểu trước khi chấp nhận tràn và cảnh báo.
- Cách đợi mermaid, KaTeX, ảnh render xong trước khi đo.
- Phạm vi cài đặt: toàn cục hay theo tài liệu.

## Sub-phases
| # | Phase con | Xong nghĩa là |
|---|---|---|
| 19a | Dấu ngắt thủ công | `splitIntoSlides` ngắt tại `<!-- slide-break -->` ở mọi chiến lược, bỏ qua trong khối code, không đổi chiến lược của tài liệu; có test |
| 19b | Thuật toán chia | Hàm thuần trong core chia dãy khối theo chiều cao, tôn trọng dấu ngắt; có test |
| 19c | Đo nội dung thật | UI đo chiều cao khối trên sân khấu ẩn 1280×720, chờ font/ảnh/sơ đồ |
| 19d | Khối quá lớn | Bảng, code, ảnh quá một slide được thu nhỏ cho vừa; dưới ngưỡng thì cảnh báo |
| 19e | Dùng chung ba nơi | Present, Speaker view, PDF cùng dãy slide đã chia; đồng bộ hai cửa sổ không lệch chỉ số |
| 19f | Cài đặt | Bật/tắt tự chia, mặc định bật, i18n vi + en |
| 19g | Nút ngắt | "Ngắt slide tại đây" ở chế độ Sửa chèn dấu tại đầu khối chứa con trỏ |
| 19h | E2E và tài liệu | Tài liệu dài xuất PDF không còn nội dung bị cắt; ROADMAP đánh dấu xong, hướng dẫn cú pháp |
