# Chrome Web Store listing — MD Reader

Copy-paste vào Developer Dashboard. Có bản tiếng Việt (mặc định) và tiếng Anh (thêm ngôn ngữ trong tab Store listing).

## Tên

MD Reader — đọc, soạn, trình chiếu Markdown

(EN: MD Reader — read, edit and present Markdown)

## Mô tả ngắn (≤ 132 ký tự)

VI: Mở file .md là đọc đẹp ngay. Soạn, trình chiếu, sơ đồ tư duy, xuất PDF/Word. Chạy đầy đủ ngoại tuyến; chia sẻ là tuỳ chọn.

EN: Open any .md file and read it beautifully. Edit, slides, mind map, PDF/Word export. Works fully offline; sharing is optional.

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
• Trình soạn thảo CodeMirror, thanh định dạng, ⌘B / ⌘I / ⌘K.
• Chia đôi màn hình: soạn bên trái, xem bên phải, cuộn đồng bộ.
• Lưu thẳng về file trên đĩa (⌘S), phát hiện khi file bị sửa ở nơi khác và cho so sánh trước khi ghi đè.

Trình bày
• Bấm Trình chiếu: tách slide theo --- hoặc đề mục, tự co giãn theo màn hình.
• Speaker view có đồng hồ, slide kế tiếp và ghi chú diễn giả.
• Sơ đồ tư duy từ các đề mục, đi được bằng bàn phím, xuất SVG/PNG.

Chia sẻ
• Gửi link xem hoặc link sửa cho người khác, cùng sửa trực tiếp và thấy tên, con trỏ của nhau.
• Xem ai đã viết dòng nào.
• Chia sẻ là tuỳ chọn và mặc định tắt; chỉ tài liệu bạn bật chia sẻ mới được gửi đi, tới máy chủ mặc định của tác giả (Cloudflare Workers) hoặc máy chủ riêng nếu bạn nhập trong Cài đặt. Tắt chia sẻ hay thu hồi link chỉ chặn truy cập, không xoá dữ liệu đã lưu.

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
• CodeMirror editor, formatting bar, ⌘B / ⌘I / ⌘K.
• Split view with synchronized scrolling.
• Save straight back to the file on disk (⌘S); detects outside changes and shows a diff before overwriting.

Present
• One click turns the document into slides (split on --- or headings), scaled to any screen.
• Speaker view with clock, next slide and speaker notes.
• Mind map of your headings, keyboard navigable, export to SVG/PNG.

Share
• Send a view link or an edit link, edit together live and see each other's names and cursors.
• See who wrote which line.
• Sharing is optional and off by default; only documents you choose to share are sent, to the author's default server (Cloudflare Workers) or your own server if you set one in Settings. Turning sharing off or revoking a link only stops access; it does not delete stored data.

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
| Remote code | **No** — all code is bundled in the package. |

## Data usage (tab Privacy practices)

- Thu thập dữ liệu người dùng: mặc định không thu thập gì. Chỉ khi người dùng bật chia sẻ cho một tài liệu, nội dung tài liệu đó (nội dung liên lạc/nội dung trang web) và tên hiển thị tự khai mới được gửi, tới máy chủ mặc định của tác giả (Cloudflare Workers) hoặc máy chủ riêng của người dùng — khai báo mục "nội dung trang web"/"liên lạc" tương ứng khi điền dashboard; các mục còn lại **Không** (thông tin cá nhân, sức khoẻ, tài chính, xác thực, liên lạc, vị trí, lịch sử web, hoạt động người dùng, nội dung trang web).
- Tick cả ba cam kết: không bán dữ liệu cho bên thứ ba · không dùng/chuyển cho mục đích không liên quan · không dùng để xét tín dụng.
- Privacy policy URL: link tới `docs/store/privacy-policy.md` trên GitHub (hoặc GitHub Pages), xem file cùng thư mục.

## Hình ảnh

| File | Kích thước | Dùng cho |
|---|---|---|
| `../../apps/extension/public/icons/icon-128.png` | 128×128 | Store icon |
| `screenshots/01-doc-giay.png` … `05-*.png` | 1280×800 | Screenshots (tối đa 5) |
| `promo-small-440x280.png` | 440×280 | Small promo tile |
