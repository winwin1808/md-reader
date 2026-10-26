# MD Reader — Chính sách quyền riêng tư / Privacy Policy

Cập nhật / Last updated: 2026-10-26

## Tiếng Việt

MD Reader là extension Chrome để đọc, soạn và trình bày file Markdown.

- **Mặc định mọi dữ liệu ở lại trên máy bạn.** Tài liệu bạn mở, bản chỉnh sửa, lịch sử và cài đặt được lưu trong bộ nhớ của trình duyệt (IndexedDB, `chrome.storage`) trên chính thiết bị của bạn. Cài đặt có thể được Chrome đồng bộ giữa các máy của bạn nếu bạn bật Chrome Sync — việc này do Google thực hiện.
- **Chỉ rời máy khi bạn bật chia sẻ cho một tài liệu.** Khi đó, các dữ liệu sau được gửi đi và lưu trên máy chủ cộng tác: nội dung tài liệu (các bản cập nhật Yjs và ảnh chụp trạng thái), tên hiển thị do người sửa tự khai, tiêu đề và thời điểm tạo phòng; với mỗi liên kết: vai trò xem/sửa, hạn dùng, thời điểm thu hồi, nhãn (nếu có), mã băm SHA-256 của token và một đoạn đầu ngắn của token được lưu dạng văn bản thường để nhận diện và thu hồi liên kết. Token gốc không bao giờ được lưu. Tài liệu chưa bật chia sẻ thì không được gửi đi.
- **Ai vận hành máy chủ.** MD Reader không kèm máy chủ nào. Chia sẻ chỉ dùng được khi bạn nhập địa chỉ máy chủ đồng bộ của riêng bạn (Cloudflare Worker tự dựng, xem `docs/SELF_HOST.md`); người chạy Worker ở địa chỉ đó vận hành nơi lưu dữ liệu.
- **Thời gian lưu và xoá dữ liệu trên máy chủ.** Tắt chia sẻ hoặc thu hồi liên kết chỉ chặn truy cập (người dùng liên kết nhận lỗi 410, liên kết hết hạn cũng vậy); riêng thao tác này không xoá dữ liệu. Để xoá, dùng nút "Xoá dữ liệu trên máy chủ" trong hộp Chia sẻ: nút này xoá phòng, các liên kết, ảnh đã tải lên và bộ đếm giới hạn của tài liệu đó trên máy chủ. Báo cáo nội dung đã gửi về phòng đó (xem bên dưới) không bị xoá cùng.
- **Khoá bản cài ẩn danh.** Khi dùng máy chủ đồng bộ, extension gửi kèm header `x-mdr-install`: một chuỗi ngẫu nhiên tạo ra trên máy bạn, không gắn với tài khoản hay danh tính. Máy chủ chỉ lưu mã băm của nó, dùng để giới hạn lạm dụng (số tài liệu, dung lượng, số thao tác mỗi ngày). Địa chỉ IP chỉ được lưu dạng mã băm, để đếm giới hạn theo ngày.
- **Báo cáo nội dung.** Trang xem có form báo cáo nội dung vi phạm. Khi bạn gửi, máy chủ lưu phòng bị báo cáo, lý do bạn nhập và mã băm IP của bạn.
- **Kết nối AI cục bộ (MCP).** Cầu nối cho trợ lý AI chỉ nghe ở `127.0.0.1` (máy bạn), mặc định tắt, và không tự gửi gì ra internet. Chỉ khi bạn đồng ý chia sẻ một tài liệu thì tài liệu đó mới được gửi lên máy chủ đồng bộ, như mục chia sẻ ở trên.
- **Hiện diện trực tiếp.** Tên, màu và vị trí con trỏ của người đang sửa chỉ được chuyển tiếp theo thời gian thực, không được lưu.
- **Không phân tích, không theo dõi, không quảng cáo, không bán dữ liệu, không tài khoản.**
- **Không gọi ra ngoài ngoài chia sẻ.** Font chữ và mọi mã chạy đều đóng gói sẵn trong extension. Khi đọc tài liệu mà không bật chia sẻ, extension không gửi yêu cầu mạng nào ngoài việc tải chính tài liệu bạn mở. Ảnh hoặc liên kết nằm trong tài liệu được trình duyệt tải như bình thường.
- **Ảnh trong tài liệu đã chia sẻ.** Ảnh dán vào một tài liệu ĐÃ chia sẻ được tải lên máy chủ đồng bộ và bất kỳ ai có liên kết ảnh đều xem được; tài liệu chưa chia sẻ không bao giờ tải ảnh lên.
- **Quyền truy cập.** Extension chỉ đọc nội dung các trang Markdown (.md) để hiển thị chúng, và chỉ ghi vào file trên đĩa khi bạn bấm Lưu. Quyền của extension: `storage`, `activeTab`, `alarms` (đánh thức cầu nối AI cục bộ) và truy cập các URL Markdown.
- **Xoá dữ liệu.** Gỡ extension sẽ xoá toàn bộ dữ liệu nó đã lưu trong trình duyệt. Dữ liệu đã chia sẻ nằm trên máy chủ cộng tác thì theo mục Thời gian lưu và xoá dữ liệu ở trên.

## English

MD Reader is a Chrome extension for reading, editing and presenting Markdown files.

- **By default all data stays on your device.** Documents you open, edits, history and settings are stored in your browser's local storage (IndexedDB, `chrome.storage`) on your own device. Settings may be synced across your devices by Chrome Sync if you enable it — that is done by Google.
- **Data leaves your device only when you turn on sharing for a document.** Then the following is sent to and stored on the collaboration server: the document content (Yjs updates and snapshot), the self-declared display names of the people editing, the room title and creation time; and for each link: role (view/edit), expiry, revoked time, optional label, the SHA-256 hash of the token and a short plaintext token prefix used to identify and revoke the link. The full token is never stored. Documents you have not shared are not sent.
- **Who runs the server.** MD Reader ships with no server. Sharing works only after you enter the URL of your own sync server (a self-hosted Cloudflare Worker, see `docs/SELF_HOST.md`); whoever runs that Worker operates the storage.
- **Retention and deleting server data.** Turning sharing off or revoking a link only stops access (anyone using it gets a 410 error, as with expired links); by itself it does not delete data. To delete, use the "Delete data on server" button in the Share dialog: it removes that document's room, links, uploaded images and rate-limit counters on the server. Content reports filed against that room (see below) are not removed with it.
- **Anonymous install key.** When using the sync server, the extension sends an `x-mdr-install` header: a random string generated on your device, tied to no account or identity. The server stores only its hash and uses it to limit abuse (document count, size, daily operations). IP addresses are stored only as a hash, to count the daily limit.
- **Content reports.** The view page has a form to report content. When you submit, the server stores the reported room, the reason you typed and a hash of your IP.
- **Local AI connection (MCP).** The bridge for AI assistants listens only on `127.0.0.1` (your machine), is off by default, and sends nothing to the internet by itself. Only when you agree to share a document is that document sent to the sync server, as in the sharing item above.
- **Live presence.** The name, colour and cursor of people editing are relayed in real time and not stored.
- **No analytics, no tracking, no ads, no sale of data, no accounts.**
- **No outbound requests besides sharing.** Fonts and all code are bundled in the extension. While you read without sharing, the extension makes no network requests other than loading the document you opened. Images or links inside a document are loaded by the browser as usual.
- **Images in shared documents.** Images pasted into a SHARED document are uploaded to the sync server and readable by anyone with the image link; unshared documents never upload images.
- **Access.** The extension reads Markdown (.md) pages only to display them, and writes to a file on disk only when you press Save. Permissions: `storage`, `activeTab`, `alarms` (wakes the local AI bridge) and access to Markdown URLs.
- **Deleting data.** Uninstalling the extension removes all data it stored in your browser. Data you shared and that sits on the collaboration server follows the Retention and deleting server data item above.

Contact: <điền email hỗ trợ công khai trước khi publish>
