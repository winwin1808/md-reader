# Lộ trình MD Reader

Đây là kế hoạch, không phải cam kết ngày giao. Thứ tự và phạm vi có thể đổi theo phản hồi. Ký hiệu: `[x]` xong, `[ ]` chưa làm.

## Đã xong (phase 1 đến 9, phiên bản 1.2.0)

- [x] **P1 Nền tảng và trình đọc:** parser `unified`/`remark`, mô hình tài liệu Yjs, content script, app page.
- [x] **P2 Xuất bản:** HTML một file, PDF (print CSS), Word `.docx`, năm bảng màu ban đầu.
- [x] **P3 Trình chiếu:** tách slide, speaker view, đồng bộ hai cửa sổ, PDF slide.
- [x] **P4 Mindmap và Excalidraw:** sơ đồ tư duy từ đề mục, xuất SVG/PNG, xem sơ đồ excalidraw nhúng.
- [x] **P5 Chỉnh sửa:** CodeMirror 6 trên `Y.Text`, lưu về đĩa, phát hiện xung đột.
- [x] **P6 Gia cố:** ghi delta nhỏ nhất, migration schema, quyền tối thiểu, KaTeX, Playwright.
- [x] **P7 Giao diện Lề sách:** ba bảng màu, font đóng gói, logo, widget content script.
- [x] **P8 Chia sẻ và cộng tác:** Cloudflare Worker tự host, link xem/sửa, presence, blame, lịch sử.
- [x] **P9 Sửa thẳng trên trang:** live preview, bảng dạng lưới, ảnh (dán/kéo/đường dẫn tương đối), hộp thoại chia sẻ mới.
- [x] Giao diện Việt / Anh, CI, giấy phép MIT, bản build Firefox (có giới hạn).

## v1.3 Chia sẻ cho AI (MCP)

Mốc kế tiếp. Người dùng mục tiêu: người nhờ AI viết tài liệu Markdown (báo cáo, đề xuất, tài liệu kỹ thuật) rồi cần gửi cho đồng nghiệp hoặc khách hàng dưới dạng link đọc đẹp, hoặc link để cùng chỉnh sửa, mà không phải copy qua lại.

Gói `@md-reader/mcp`, hai kiểu chạy:

- **stdio:** chạy cục bộ (`npx`), cấu hình trong Claude Desktop / Claude Code / Cursor. Gọi máy chủ Worker của chính người dùng.
- **Remote:** endpoint MCP trên chính Worker tự host, để dùng với agent chạy trên đám mây.

Công cụ dự kiến:

| Tool | Việc làm |
|---|---|
| `publish_doc` | Nhận Markdown + tiêu đề, tạo tài liệu, trả về link xem (và link sửa nếu yêu cầu). |
| `get_doc` | Đọc nội dung hiện tại của một tài liệu đã chia sẻ (kể cả phần người khác vừa sửa). |
| `update_doc` | Ghi bản mới hoặc áp một thay đổi; ghi theo delta để không đè chỉnh sửa của người khác. |
| `list_docs` | Liệt kê tài liệu của chủ sở hữu (id, tiêu đề, thời điểm sửa, link đang hoạt động). |
| `create_link` | Tạo link xem hoặc link sửa, có thể đặt hạn. |
| `revoke_link` | Thu hồi một link. |

Bổ sung: thêm bình luận (`append_comment`) khi tính năng bình luận ở v1.5 sẵn sàng.

Xác thực và giới hạn (thiết kế dự kiến):

- Xác thực bằng token chủ sở hữu của máy chủ Worker; token chỉ lưu dạng băm ở máy chủ, giống link hiện nay.
- Mặc định agent chỉ tạo link xem; link sửa cần yêu cầu rõ.
- Giới hạn kích thước tài liệu, số tài liệu và tốc độ gọi theo từng token (đi cùng rate limit ở v1.5).

Việc cần làm:

- [ ] Thiết kế API quản lý tài liệu ở `apps/api` dùng chung cho extension và MCP
- [ ] Token chủ sở hữu, thu hồi, xoay
- [ ] `@md-reader/mcp` (stdio) với 6 tool trên
- [ ] Endpoint MCP remote trên Worker
- [ ] Tài liệu cài đặt cho Claude, ChatGPT, Cursor; ví dụ prompt
- [ ] Test hợp đồng tool và e2e với wrangler dev

## v1.4 Hiển thị và xuất bản mở rộng

Ý tưởng lấy cảm hứng từ danh sách tính năng của các trình xem Markdown khác, tiêu biểu là docu.md (markdown-viewer-extension). Cần cân nhắc dung lượng: content script giữ ≤ 60 KB gzip, nên phần nặng sẽ nạp lười ở app page.

Sơ đồ và biểu đồ:

- [ ] PlantUML
- [ ] Graphviz / dot
- [ ] Vega / Vega-Lite
- [ ] ECharts
- [ ] draw.io
- [ ] Infographic
- [ ] OpenAPI / Swagger (YAML) hiển thị thành tài liệu API

Xuất bản:

- [ ] EPUB
- [ ] XLSX cho bảng
- [ ] Xuất riêng từng hình (SVG / PNG)
- [ ] Công thức sửa được trong Word (OMML)

Giao diện và hiệu năng:

- [ ] Thêm giao diện tài liệu: business, academic, technical
- [ ] Tài liệu lớn: cache và render tăng dần
- [ ] Thêm ngôn ngữ giao diện ngoài Việt / Anh
- [ ] Xuất qua bộ phân giải ảnh (hiện export chưa dùng resolver ảnh tương đối)

## v1.5 Cộng tác hoàn thiện và phát hành rộng

Cộng tác:

- [ ] Bình luận và đề xuất chỉnh sửa (suggestions)
- [ ] Endpoint xoá dữ liệu phòng (thu hồi link hiện chỉ chặn truy cập)
- [ ] Rate limit cho Worker
- [ ] Deploy một chạm lên Cloudflare (nút "Deploy to Cloudflare")
- [ ] Thay `window.alert` ở trang web bằng thông báo trong giao diện

Phát hành:

- [ ] Chrome Web Store
- [ ] Microsoft Edge Add-ons
- [ ] Firefox AMO (kèm đường thay thế cho File System Access ở Firefox)

## v2.0 Ra khỏi trình duyệt

- [ ] **Web app:** kéo file vào là đọc/sửa, không cần cài extension
- [ ] **VS Code extension:** xem trước theo giao diện Lề sách, chia sẻ từ editor
- [ ] **Obsidian plugin**
- [ ] **CLI không giao diện:** `md → HTML / PDF` cho CI và script
- [ ] **Di động** (sau cùng, phạm vi chưa định)

## Cách đóng góp ý kiến

Mở một issue tại [GitHub Issues](https://github.com/winwin1808/md-reader/issues) nói bạn đang cần gì; mục có nhiều nhu cầu thật sẽ được đẩy lên trước.
