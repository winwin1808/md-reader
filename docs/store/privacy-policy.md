# MD Reader — Chính sách quyền riêng tư / Privacy Policy

Cập nhật / Last updated: 2026-10-24

## Tiếng Việt

MD Reader là extension Chrome để đọc, soạn và trình bày file Markdown.

- **Mặc định mọi dữ liệu ở lại trên máy bạn.** Tài liệu bạn mở, bản chỉnh sửa, lịch sử và cài đặt được lưu trong bộ nhớ của trình duyệt (IndexedDB, `chrome.storage`) trên chính thiết bị của bạn. Cài đặt có thể được Chrome đồng bộ giữa các máy của bạn nếu bạn bật Chrome Sync — việc này do Google thực hiện.
- **Chỉ rời máy khi bạn bật chia sẻ cho một tài liệu.** Khi đó, nội dung tài liệu ấy, tên hiển thị do người sửa tự khai, và thông tin về liên kết (vai trò xem/sửa, hạn dùng, trạng thái đã thu hồi, mã băm SHA-256 của token — không bao giờ gửi token gốc để lưu) được gửi tới máy chủ cộng tác mà bạn đã cấu hình trong Cài đặt (ví dụ `https://<your-worker>.workers.dev`). Tài liệu chưa bật chia sẻ thì không được gửi đi.
- **Ai vận hành máy chủ.** Máy chủ do người chạy Worker ở địa chỉ bạn cấu hình vận hành; tác giả MD Reader không thấy dữ liệu đó trừ khi chính họ là người vận hành địa chỉ ấy.
- **Thời gian lưu.** Dữ liệu chia sẻ được giữ cho tới khi chủ tài liệu tắt chia sẻ hoặc thu hồi liên kết. Lưu ý trung thực: thu hồi liên kết đánh dấu liên kết là đã thu hồi (người dùng liên kết đó nhận lỗi 410, liên kết hết hạn cũng vậy), nhưng mã hiện tại chưa có thao tác xoá hẳn trạng thái phòng và bản ghi liên kết trên máy chủ. Muốn xoá hẳn, hãy nhờ người vận hành máy chủ hoặc tự xoá bản triển khai Worker của bạn.
- **Hiện diện trực tiếp.** Tên, màu và vị trí con trỏ của người đang sửa chỉ được chuyển tiếp theo thời gian thực, không được lưu.
- **Không phân tích, không theo dõi, không quảng cáo, không bán dữ liệu, không tài khoản.**
- **Không gọi ra ngoài ngoài chia sẻ.** Font chữ và mọi mã chạy đều đóng gói sẵn trong extension. Khi đọc tài liệu mà không bật chia sẻ, extension không gửi yêu cầu mạng nào ngoài việc tải chính tài liệu bạn mở. Ảnh hoặc liên kết nằm trong tài liệu được trình duyệt tải như bình thường.
- **Quyền truy cập.** Extension chỉ đọc nội dung các trang Markdown (.md) để hiển thị chúng, và chỉ ghi vào file trên đĩa khi bạn bấm Lưu. Quyền của extension: `storage`, `activeTab` và truy cập các URL Markdown.
- **Xoá dữ liệu.** Gỡ extension sẽ xoá toàn bộ dữ liệu nó đã lưu trong trình duyệt. Dữ liệu đã chia sẻ nằm trên máy chủ cộng tác thì theo mục Thời gian lưu ở trên.

## English

MD Reader is a Chrome extension for reading, editing and presenting Markdown files.

- **By default all data stays on your device.** Documents you open, edits, history and settings are stored in your browser's local storage (IndexedDB, `chrome.storage`) on your own device. Settings may be synced across your devices by Chrome Sync if you enable it — that is done by Google.
- **Data leaves your device only when you turn on sharing for a document.** Then that document's content, the self-declared display names of the people editing it, and link metadata (role view/edit, expiry, revoked flag, SHA-256 hashes of tokens — raw tokens are never sent for storage) are sent to the collaboration server you configured in Settings (for example `https://<your-worker>.workers.dev`). Documents you have not shared are not sent.
- **Who runs the server.** The server is operated by whoever runs the Worker at the URL you configured; the MD Reader author does not see that data unless they are that operator.
- **Retention.** Shared data is kept until the owner turns sharing off or revokes the links. To be honest about it: revoking marks a link as revoked (anyone using it gets a 410 error, as with expired links), but the current code has no operation that fully deletes the room state and link records from the server. To erase them completely, ask the server operator or delete your own Worker deployment.
- **Live presence.** The name, colour and cursor of people editing are relayed in real time and not stored.
- **No analytics, no tracking, no ads, no sale of data, no accounts.**
- **No outbound requests besides sharing.** Fonts and all code are bundled in the extension. While you read without sharing, the extension makes no network requests other than loading the document you opened. Images or links inside a document are loaded by the browser as usual.
- **Access.** The extension reads Markdown (.md) pages only to display them, and writes to a file on disk only when you press Save. Permissions: `storage`, `activeTab` and access to Markdown URLs.
- **Deleting data.** Uninstalling the extension removes all data it stored in your browser. Data you shared and that sits on the collaboration server follows the Retention item above.

Contact: <điền email hỗ trợ công khai trước khi publish>
