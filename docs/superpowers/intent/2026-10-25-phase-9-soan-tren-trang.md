# Intent: Phase 9 — Soạn ngay trên trang đọc (+ hoàn thiện chia sẻ)
Author: haonq. Status: approved (2026-10-25). Phase: 9

Nguồn: yêu cầu người dùng 2026-10-25 — "Modal share – hoàn thiện UI, thêm copy link button cho những link đã tạo.
Phía được share → UI edit thẳng trên md đã build ra view cho dễ xem, có view mode. Đọc với soạn ở phía extension cũng tương
tự — edit thẳng trên view giống như đọc."

## Problem

1. **ShareModal:** link đã tạo không copy lại được. Máy chủ chỉ lưu hash của token (`apps/api/src/tokens*.ts`,
   `listLinks` trả `token: ''`), nên sau khi đóng modal hoặc mở lại tài liệu, danh sách chỉ còn tiền tố 6 ký tự. Modal
   còn thô: chưa phân nhóm rõ link xem / link sửa, trạng thái hết hạn / đã thu hồi lẫn vào nhau.
2. **Trang web người được chia sẻ (`apps/web`):** `EditPage` là form tên + split view CodeMirror | preview, HTML gần như
   không có style. Người nhận link sửa phải đọc mã Markdown thô, không giống trang đọc Lề sách.
3. **Extension:** soạn = mã Markdown (Soạn / Chia đôi). Muốn sửa một chữ trong bài đang đọc phải chuyển sang chế độ khác,
   mất chỗ đang đọc.

## Proposed outcome

- **Chia sẻ:** mỗi link có nút **Sao chép** dùng được mãi trên máy đã tạo link; link tạo ở nơi khác hiện "Chỉ máy tạo link
  mới sao chép được — tạo link mới" kèm nút tạo lại với cùng quyền. Modal chia làm hai nhóm (Xem · Sửa), mỗi dòng có nhãn,
  hạn còn lại, trạng thái, Sao chép, Thu hồi; toast "Đã sao chép".
- **Soạn trên trang (live preview), dùng chung cho extension và web:** một chế độ **"Soạn trên trang"** nhìn như trang đọc
  Lề sách (chữ Literata, cột chữ, đề mục, danh sách, trích dẫn, bảng, ảnh, code tô màu). Dấu Markdown (`#`, `**`, `[]()`…)
  ẩn đi, chỉ hiện ở dòng/khối có con trỏ. Gõ là sửa thẳng; thanh định dạng và ⌘B/⌘I/⌘K vẫn dùng được.
  - Extension: thanh chế độ thành **Đọc · Soạn trên trang · Mã nguồn · Chia đôi**. "Đọc" vẫn là Viewer hiện tại (nhanh,
    đầy đủ mermaid/KaTeX/margin notes). "Soạn trên trang" thay vai trò soạn mặc định.
  - Web: link quyền **Sửa** mở thẳng "Soạn trên trang" với nút chuyển **Xem** (chỉ đọc, Viewer); link quyền **Xem** chỉ có
    Xem. Trang web dùng token Lề sách, toolbar gọn, presence bar, trạng thái đồng bộ bằng chữ, form nhập tên có style.

## Quyết định kiến trúc (người dùng duyệt cùng intent)

**Live preview bằng CodeMirror 6 decorations trên chính `Y.Text "source"`** (kiểu Obsidian), KHÔNG dùng editor rich-text
(ProseMirror/Milkdown/Tiptap). Lý do: ràng buộc khoá cứng #1 (Y.Text "source" là nguồn sự thật) và #5 (parser
unified/remark). Editor rich-text cần `Y.XmlFragment` → đổi schema + chuyển đổi hai chiều mất định dạng. CM6 + y-codemirror.next
đã có sẵn từ phase 5, cộng tác/undo/blame/history giữ nguyên, file `.md` giữ nguyên từng ký tự.

Giới hạn chấp nhận: mermaid, KaTeX khối, excalidraw, bảng phức tạp hiện dạng widget render khi con trỏ ở ngoài, thành mã
khi con trỏ vào trong khối; margin notes không float trong chế độ soạn (alert hiện inline).

## Affected packages

`packages/ui` (LivePreviewEditor: extensions CM6 decorations + widgets + theme Lề sách; ShareModal) · `apps/extension`
(chế độ xem mới, cache token link cục bộ) · `apps/web` (EditPage/SharePage UI) · `packages/core` không đổi (có thể thêm helper
thuần tìm khối nếu cần).

## Constraints

8 ràng buộc khoá cứng giữ nguyên; không đổi schema Y.Doc; không đổi API máy chủ (copy link giải quyết phía client, token đầy đủ
lưu trong `chrome.storage.local` theo `room` + `tokenPrefix`, không bao giờ gửi đi đâu); content script không đổi; mỗi phase con
≤5 file / ≤300 dòng / ≤1 file test.

## Non-goals

Bình luận/gợi ý sửa; kéo thả khối; chèn ảnh bằng upload; WYSIWYG cho bảng (sửa bảng vẫn là mã khi con trỏ trong bảng);
đổi máy chủ hay quyền; app mobile.

## Open questions (design sẽ chốt)

- Ẩn dấu theo dòng hay theo khối/nút cú pháp? (đề xuất: theo nút cú pháp Lezer, hiện dấu khi selection chạm nút đó)
- Có cuộn giữ vị trí khi chuyển Đọc ↔ Soạn trên trang? (đề xuất: có, theo heading gần nhất)
- Mặc định của extension khi mở file: Đọc (giữ nguyên) hay Soạn trên trang? (đề xuất: Đọc; nhớ lựa chọn cuối theo tài liệu)
