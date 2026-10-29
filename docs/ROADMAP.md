# Lộ trình MD Reader

[English](ROADMAP.en.md) · **Tiếng Việt**

Đây là kế hoạch, không phải cam kết ngày giao. Thứ tự và phạm vi có thể đổi theo phản hồi. Ký hiệu: `[x]` xong, `[ ]` chưa làm.

## Đã xong (phase 1 đến 16, phiên bản 1.3.x)

- [x] **P1 Nền tảng và trình đọc:** parser `unified`/`remark`, mô hình tài liệu Yjs, content script, app page.
- [x] **P2 Xuất bản:** HTML một file, PDF (print CSS), Word `.docx`, năm bảng màu ban đầu.
- [x] **P3 Trình chiếu:** tách slide, speaker view, đồng bộ hai cửa sổ, PDF slide.
- [x] **P4 Mindmap và Excalidraw:** sơ đồ tư duy từ đề mục, xuất SVG/PNG, xem sơ đồ excalidraw nhúng.
- [x] **P5 Chỉnh sửa:** CodeMirror 6 trên `Y.Text`, lưu về đĩa, phát hiện xung đột.
- [x] **P6 Gia cố:** ghi delta nhỏ nhất, migration schema, quyền tối thiểu, KaTeX, Playwright.
- [x] **P7 Giao diện Lề sách:** ba bảng màu, font đóng gói, logo, widget content script.
- [x] **P8 Chia sẻ và cộng tác:** Cloudflare Worker tự host, link xem/sửa, presence, blame, lịch sử.
- [x] **P9 Sửa thẳng trên trang:** live preview, bảng dạng lưới, ảnh (dán/kéo/đường dẫn tương đối), hộp thoại chia sẻ mới.
- [x] **P9 Sửa thẳng trên trang:** live preview, bảng dạng lưới, ảnh (dán/kéo/đường dẫn tương đối), hộp Chia sẻ mới.
- [x] **P10 MCP cục bộ:** `le-sach-mcp` (7 tool), cầu nối `127.0.0.1`, khoá bản cài ẩn danh, giới hạn theo ngày, xoá phòng, báo cáo nội dung.
- [x] **P11 Vá bảo mật:** các hướng tấn công từ audit 2026-10-27, thu hồi link tức thì, cầu nối MCP v2 xác thực hai chiều.
- [x] **P12 Gia cố máy chủ:** link sửa chỉ ghi phần của mình, `last_seen`, trần ảnh toàn cục, cron xoá phòng bỏ không 90 ngày.
- [x] **P13 Hoàn thiện trải nghiệm:** báo rõ link bị thu hồi / tài liệu quá lớn, banner phiên bản định dạng mới, export HTML nhúng ảnh tương đối, web bỏ `window.alert`.
- [x] **P14 Đóng nợ rủi ro:** kiểm update của link sửa trước khi áp, clientID gắn theo link, cron dọn theo lô, web phòng đầy → chỉ đọc.
- [x] **P15 Trả nợ người dùng và máy chủ:** "Thu hồi tất cả" một lời gọi, KaTeX nạp lười, Word xuất công thức OMML, lịch sử phân trang, nhận file `.Md`, MCP ghi tên client, khoá file CLI, "Làm gọn tài liệu".
- [x] **P16 Trả nợ test:** e2e cộng tác cổng cấu hình được, làm chặt test yếu, test độc lập thứ tự.
- [x] Giao diện Việt / Anh, CI, giấy phép MIT, bản build Firefox (có giới hạn).

## v1.3 MCP cục bộ (đã xong)

Người dùng mục tiêu: người nhờ AI viết tài liệu Markdown (báo cáo, đề xuất, tài liệu kỹ thuật) rồi cần gửi cho đồng nghiệp hoặc khách hàng dưới dạng link đọc đẹp, hoặc link để cùng chỉnh sửa, mà không phải copy qua lại.

- [x] **Cầu nối cục bộ:** AI (Claude Desktop / Claude Code / Cursor) nói chuyện với extension qua cầu nối chỉ nghe ở `127.0.0.1`, mặc định tắt. Không gửi gì ra internet; chỉ khi chia sẻ (sau khi người dùng xác nhận) tài liệu mới lên máy chủ.
- [x] **7 tool MCP** để tạo, đọc, cập nhật tài liệu và chia sẻ / liệt kê / thu hồi link. Chia sẻ phải được người dùng xác nhận.
- [x] **Gia cố multi-tenant:** khoá bản cài ẩn danh, giới hạn theo ngày, xoá dữ liệu phòng trên máy chủ, báo cáo nội dung trên trang xem.

## Đã hoãn

- [ ] **Remote MCP + OAuth:** endpoint MCP trên máy chủ cho agent chạy trên đám mây. Làm bản tự host trước, và chỉ khi có nhu cầu thật.

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
- [x] Công thức sửa được trong Word (OMML)

Giao diện và hiệu năng:

- [ ] Thêm giao diện tài liệu: business, academic, technical
- [ ] Tài liệu lớn: cache và render tăng dần
- [ ] Thêm ngôn ngữ giao diện ngoài Việt / Anh
- [x] Xuất qua bộ phân giải ảnh (export HTML nhúng ảnh đường dẫn tương đối)

## v1.5 Cộng tác hoàn thiện và phát hành rộng

Cộng tác:

- [ ] Bình luận và đề xuất chỉnh sửa (suggestions)
- [x] Endpoint xoá dữ liệu phòng (nút "Xoá dữ liệu trên máy chủ") và tự xoá phòng bỏ không 90 ngày
- [x] Giới hạn theo ngày cho Worker (khoá bản cài ẩn danh, IP, trần ảnh toàn cục)
- [ ] Deploy một chạm lên Cloudflare (nút "Deploy to Cloudflare")
- [x] Thay `window.alert` ở trang web bằng thông báo trong giao diện

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
