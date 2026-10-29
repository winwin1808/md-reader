# Chrome Web Store listing — MD Reader

Copy-paste vào Developer Dashboard. Có bản tiếng Việt (mặc định) và tiếng Anh (thêm ngôn ngữ trong tab Store listing).

## Tên

MD Reader — đọc, soạn, trình chiếu Markdown

(EN: MD Reader — read, edit and present Markdown)

## Mô tả ngắn (≤ 132 ký tự)

VI: Mở file .md là đọc đẹp ngay. Soạn, trình chiếu, sơ đồ tư duy, xuất PDF/Word. Chạy đầy đủ ngoại tuyến; chia sẻ là tuỳ chọn.

EN: Open any .md file and read it beautifully. Edit on the page, slides, mind map, PDF/Word export. Works fully offline; sharing is optional.

## Danh mục · ngôn ngữ

- Category: **Productivity** (Tools)
- Language: Tiếng Việt (default), English

## Mô tả dài — tiếng Việt

MD Reader biến file Markdown thành một trang đọc dễ chịu, ngay trong Chrome.

Đọc
• Bấm vào link .md (GitHub raw, file trên máy) → mở trang đọc với chữ Literata, cột chữ vừa mắt, tuỳ chỉnh độ rộng trang.
• Mục lục bên trái đánh dấu mục bạn đang đọc; ghi chú [!NOTE] nằm gọn bên lề.
• Bảng, công thức toán (KaTeX), sơ đồ mermaid, excalidraw, khối code tô màu và nút sao chép.
• Ba bảng màu: Giấy, Than chì (tối), Tương phản cao. Tìm trong tài liệu (⌘F).

Soạn
• Hai chế độ Đọc · Sửa. Sửa thẳng trên trang đọc: dấu Markdown chỉ hiện ở chỗ con trỏ.
• Bảng giữ dạng lưới khi sửa: gõ vào ô, Tab để đi, thêm/xoá dòng và cột.
• Dán hoặc kéo ảnh vào tài liệu. Thanh định dạng, ⌘B / ⌘I / ⌘K.
• Lưu thẳng về file trên đĩa (⌘S), phát hiện khi file bị sửa ở nơi khác và cho so sánh trước khi ghi đè.

Trình bày
• Bấm Trình chiếu: tách slide theo --- hoặc đề mục, tự co giãn theo màn hình.
• Speaker view có đồng hồ, slide kế tiếp và ghi chú diễn giả.
• Sơ đồ tư duy từ các đề mục, đi được bằng bàn phím, xuất SVG/PNG.

Chia sẻ
• Gửi link xem hoặc link sửa cho người khác (mở lại hộp Chia sẻ vẫn bấm Sao chép được link đã tạo), cùng sửa trực tiếp và thấy tên, con trỏ của nhau.
• Xem ai đã viết dòng nào.
• Chia sẻ là tuỳ chọn và mặc định tắt; chỉ tài liệu bạn bật chia sẻ mới được gửi đi, tới máy chủ đồng bộ mặc định do tác giả vận hành trên Cloudflare Workers (đổi được sang máy chủ tự dựng ở Cài đặt → Cộng tác). Thu hồi link chặn truy cập ngay; muốn xoá hẳn thì dùng nút "Xoá dữ liệu trên máy chủ" (phòng không ai mở 90 ngày cũng tự bị xoá).

Kết nối AI cục bộ (MCP)
• Cho Claude, Cursor… tạo và chia sẻ tài liệu qua cầu nối chỉ nghe ở 127.0.0.1, mặc định tắt. Cầu nối không gửi gì ra internet; chia sẻ chỉ diễn ra sau khi bạn xác nhận.

Xuất
• HTML một file, PDF (in từ trình duyệt), Word (.docx), PDF slide khổ ngang.

Riêng tư
• Không tài khoản, không theo dõi. Mặc định tài liệu và cài đặt chỉ nằm trong trình duyệt của bạn; chỉ rời máy khi bạn bật chia sẻ. Font được đóng gói sẵn — không gọi ra ngoài khi đọc.

Mẹo: muốn đọc file trên máy (file://), vào chrome://extensions → MD Reader → bật “Cho phép truy cập URL tệp”.

## Long description — English

MD Reader turns Markdown files into a calm reading page, right inside Chrome.

Read
• Click any .md link (GitHub raw, local files) to open a reading view set in Literata with a comfortable line length; page width is adjustable.
• The table of contents marks where you are; [!NOTE] alerts sit in the margin.
• Tables, math (KaTeX), mermaid and excalidraw diagrams, highlighted code with copy buttons.
• Three palettes: Paper, Graphite (dark), High contrast. Find in document (⌘F).

Edit
• Two modes, Read and Edit. Edit right on the reading page: Markdown marks show only where the cursor is.
• Tables stay a grid while editing: type in cells, Tab to move, add/remove rows and columns.
• Paste or drop images into the document. Formatting bar, ⌘B / ⌘I / ⌘K.
• Save straight back to the file on disk (⌘S); detects outside changes and shows a diff before overwriting.

Present
• One click turns the document into slides (split on --- or headings), scaled to any screen.
• Speaker view with clock, next slide and speaker notes.
• Mind map of your headings, keyboard navigable, export to SVG/PNG.

Share
• Send a view link or an edit link, edit together live and see each other's names and cursors.  Reopen the Share dialog and Copy still works for links you created.
• See who wrote which line.
• Sharing is optional and off by default; only documents you choose to share are sent, to a default sync server operated by the author on Cloudflare Workers (you can switch to your own self-hosted server in Settings → Cộng tác). Revoking a link stops access immediately; to delete for good use the "Delete data on server" button (rooms nobody opens for 90 days are also deleted automatically).

Local AI connection (MCP)
• Lets Claude, Cursor and similar tools create and share documents through a bridge that listens only on 127.0.0.1, off by default. The bridge sends nothing to the internet; sharing happens only after you confirm.

Export
• Single-file HTML, PDF (browser print), Word (.docx), landscape slide PDF.

Private by design
• No account, no tracking. By default documents and settings stay in your browser; they leave only when you turn on sharing. Fonts are bundled — nothing is fetched while you read.

Tip: to open local files (file://), go to chrome://extensions → MD Reader → enable “Allow access to file URLs”.

## Single purpose (tab Privacy practices)

VI: Hiển thị, chỉnh sửa và trình bày tài liệu Markdown mà người dùng mở trong trình duyệt.

EN: Display, edit and present Markdown documents the user opens in the browser.

## Giải trình quyền (Permission justification)

| Quyền | Lý do (EN — dán vào dashboard) |
|---|---|
| `storage` | Saves the user's reading settings (palette, font size, page width) and the widget's collapsed state. Document content is not sent anywhere by this permission. |
| `activeTab` | Opens the Markdown document in the current tab in the reader page when the user clicks the extension. |
| Content script on `.md` URLs (host access) | Detects raw Markdown pages (.md / .markdown) and shows a small "Read in MD Reader" tab. It reads the page text only to open it in the reader; nothing is transmitted unless you turn on sharing for that document. |
| `alarms` | Wakes the optional local AI bridge (127.0.0.1, off by default) periodically so the extension service worker can keep it connected. No data is sent anywhere by this permission. |
| Remote code | **No** — all code is bundled in the package. |

## Data usage (tab Privacy practices)

- Thu thập dữ liệu người dùng: mặc định extension không gửi gì đi. Bản trên cửa hàng kèm máy chủ đồng bộ mặc định do tác giả vận hành (Cloudflare Workers); chỉ khi người dùng bật chia sẻ cho một tài liệu, nội dung tài liệu đó (cập nhật Yjs, snapshot, ảnh), tên hiển thị tự khai (kể cả tên client MCP như "Claude Code") và metadata liên kết (vai trò, hạn, nhãn, hash token + tiền tố ngắn) mới được gửi tới máy chủ đó. Người dùng đổi được sang máy chủ tự dựng ở Cài đặt → Cộng tác. Khai trên dashboard: tick **Website content** (nội dung tài liệu khi chia sẻ); mọi mục còn lại **Không** (Personally identifiable info, Health, Financial, Authentication, Personal communications, Location, Web history, User activity). Khoá bản cài ẩn danh và IP (IPv6 tính theo /64) chỉ lưu dạng hash trên máy chủ, chỉ để chống lạm dụng, bộ đếm tự xoá sau khoảng 2 ngày. Lưu giữ: phòng không ai mở 90 ngày tự bị xoá; người dùng xoá ngay được bằng nút "Xoá dữ liệu trên máy chủ".
- Tick cả ba cam kết: không bán dữ liệu cho bên thứ ba · không dùng/chuyển cho mục đích không liên quan · không dùng để xét tín dụng.
- Privacy policy URL: https://gist.githubusercontent.com/winwin1808/89e2f4a64e07b59ad6518c7b9d947fca/raw/privacy-policy.md (trang giới thiệu: https://gist.github.com/winwin1808/89e2f4a64e07b59ad6518c7b9d947fca; bản sao trên Gist: https://gist.github.com/winwin1808/89e2f4a64e07b59ad6518c7b9d947fca).

## Hình ảnh

| File | Kích thước | Dùng cho |
|---|---|---|
| `../../apps/extension/public/icons/icon-128.png` | 128×128 | Store icon |
| `screenshots/01-doc.png` … `07-mindmap.png` | 1280×800 | Screenshots (dashboard nhận tối đa 5: chọn 01, 02, 03, 04, 05) |
| `promo-small-440x280.png` | 440×280 | Small promo tile |
