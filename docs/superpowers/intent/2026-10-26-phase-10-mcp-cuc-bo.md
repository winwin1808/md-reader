# Intent: Phase 10 — MCP cục bộ + gia cố multi-tenant cho chia sẻ
Author: haonq. Status: draft. Phase: 10

Nguồn: thảo luận với người dùng 2026-10-26 — mốc v1.3 "Chia sẻ cho AI (MCP)" trong `docs/ROADMAP.md`, đổi hướng:
"cho tự config MCP vào Chrome rồi gọi qua đó — kiểu gọi offline, share thì mới cần đến lưu trữ". Bản trên store dùng
máy chủ mặc định của tác giả nên phải xét multi-tenant.

## Problem

1. **Người nhờ AI viết Markdown** (Claude Desktop / Claude Code / Cursor) phải copy nội dung sang file, mở bằng extension,
   rồi tự bấm chia sẻ. AI không đưa tài liệu thẳng vào md-reader được, cũng không đọc lại được bản người khác vừa sửa.
2. **Máy chủ mặc định là multi-tenant nhưng chưa được gia cố.** Mọi người dùng store chia nhau một Worker trên Workers Free:
   không có danh tính người dùng, không rate limit `POST /api/rooms` và upload ảnh, không quota dung lượng, thu hồi link
   chỉ đặt `revoked_at` (dữ liệu DO + D1 + assets vẫn còn), không có cách báo cáo/gỡ nội dung xấu. Một bản cài lạm dụng
   (hoặc agent chạy vòng lặp) có thể làm hết hạn mức của tất cả, và tác giả là bên vận hành dữ liệu.
3. Trang web báo lỗi ảnh bằng `window.alert`.

## Proposed outcome

- **MCP cục bộ, offline-first.** Gói `@md-reader/mcp` chạy bằng `npx` (stdio), cấu hình trong Claude Desktop / Claude
  Code / Cursor. Nó nói chuyện với extension đang chạy trong Chrome qua một cầu nối cục bộ (cơ chế do spike 10a chốt).
  Lần đầu kết nối, extension hiện hộp ghép cặp; người dùng duyệt thì mới nhận lệnh.
  - `publish_doc` (Markdown + tiêu đề): tạo tài liệu trong registry `docId` + IndexedDB, mở tab app page. Không chạm máy chủ.
  - `list_docs`, `get_doc`: đọc từ registry/Y.Doc cục bộ (tài liệu đang chia sẻ thì là bản đã đồng bộ, gồm cả phần người khác sửa).
  - `update_doc`: ghi delta nhỏ nhất vào `Y.Text "source"` — không đè chỉnh sửa đồng thời.
  - `share_doc` / `create_link` / `revoke_link`: extension hiện hộp xác nhận; người dùng bấm đồng ý thì đi qua luồng chia sẻ
    hiện có và trả link về cho agent. Agent không bao giờ tự tạo link công khai.
- **Gia cố máy chủ chia sẻ:** mỗi bản cài có khoá ẩn danh (máy chủ chỉ lưu hash); rate limit và quota (số phòng, dung lượng)
  theo khoá; `DELETE /api/rooms/:id` xoá thật DO storage + D1 + assets, có nút "Xoá dữ liệu trên máy chủ" trong ShareModal;
  trang web có "Báo cáo nội dung", tác giả gỡ được phòng; lỗi trên web hiện bằng thông báo trong giao diện.
- Tài liệu cài đặt MCP cho Claude Desktop / Claude Code / Cursor kèm prompt mẫu; ROADMAP ghi Remote MCP + OAuth là mục hoãn;
  privacy policy cập nhật; phiên bản 1.3.0.

## Affected packages

`apps/api` (danh tính bản cài, rate limit, quota, xoá phòng, báo cáo/gỡ) · `apps/web` (báo cáo, thay `window.alert`) ·
`apps/extension` (cầu nối, ghép cặp, xử lý lệnh MCP, hộp xác nhận share, nút xoá dữ liệu) · `packages/ui` (hộp ghép cặp /
xác nhận, nút xoá trong ShareModal) · **mới** `packages/mcp` (`@md-reader/mcp`, Node, stdio) · `packages/core` chỉ thêm
helper thuần nếu cần (ví dụ tạo doc từ Markdown).

## Constraints

- 8 ràng buộc khoá cứng giữ nguyên; không đổi schema Y.Doc.
- `packages/mcp` là tiến trình Node: KHÔNG import react / `chrome.*`; không giữ Y.Doc riêng — nguồn sự thật vẫn là Y.Doc
  trong extension. Chỉ `apps/extension` dùng `chrome.*`.
- Cầu nối chỉ lắng nghe/kết nối trên máy cục bộ; phải ghép cặp do người dùng duyệt; khoá ghép cặp lưu cục bộ, thu hồi được.
- Không thêm quyền manifest ngoài thứ spike 10a chứng minh là cần; mỗi quyền mới phải có lý do ghi trong listing store.
- Thao tác tạo/đổi/thu hồi link từ MCP luôn cần người dùng xác nhận trong extension.
- Máy chủ chỉ lưu hash của khoá bản cài, như token link hiện nay. Vẫn trong Workers Free (DO SQLite + D1, không R2/KV).
- Content script không đổi, ngân sách ≤ 60 KB gz.
- Mỗi phase con ≤5 file / ≤300 dòng / ≤1 file test.

## Non-goals

Remote MCP trên Worker và OAuth / tài khoản người dùng (hoãn, ghi vào ROADMAP — làm khi có nhu cầu thật, bản tự host trước);
connector cho claude.ai web / ChatGPT; MCP tự tạo link không qua xác nhận; bình luận / `append_comment` (v1.5);
dashboard quản trị (gỡ nội dung bằng lệnh/endpoint admin là đủ); nâng gói Cloudflare trả phí.

## Open questions (design sẽ chốt)

- Cầu nối: native messaging (cần cài host manifest; `npx` tự cài?) hay WebSocket localhost (extension chủ động nối tới
  tiến trình MCP)? Quyền manifest nào, có giữ được service worker MV3 sống không? → spike 10a.
- MCP gọi khi Chrome đóng: lỗi rõ ràng "Mở Chrome có md-reader" hay xếp hàng? (đề xuất: lỗi rõ ràng, không xếp hàng)
- Khoá bản cài sinh ở đâu, sống lại sau cài lại thế nào; phòng tạo trước phase 10 (chưa có khoá) được gắn chủ ra sao?
- Con số rate limit / quota mặc định (đề xuất từ số đo §5.6 DESIGN.md).
- Gỡ nội dung: endpoint admin bảo vệ bằng secret của Worker, hay đặt cờ D1 bằng tay qua wrangler?
- `publish_doc` có mở tab ngay hay chỉ tạo doc rồi trả `docId`? (đề xuất: mở tab, có cờ `open: false`)

## Sub-phases

| # | Phase con | Phạm vi |
|---|---|---|
| 10a | Spike cầu nối | MCP ↔ extension MV3: native messaging vs WebSocket localhost, quyền cần, vòng đời service worker |
| 10b | Danh tính bản cài + rate limit | api: khoá bản cài ẩn danh (lưu hash), rate limit `POST /api/rooms` và upload assets |
| 10c | Quota + xoá phòng | api: quota số phòng/dung lượng theo bản cài; `DELETE /api/rooms/:id` xoá DO storage + D1 + assets |
| 10d | Báo cáo & gỡ nội dung | api+web: báo cáo nội dung, gỡ phòng (admin); thay `window.alert` bằng thông báo trong UI |
| 10e | Xoá dữ liệu từ extension | extension+ui: nút "Xoá dữ liệu trên máy chủ" trong ShareModal |
| 10f | Gói `@md-reader/mcp` | packages/mcp: server stdio + client cầu nối, khai báo tool |
| 10g | Phía nhận cầu nối | extension: ghép cặp do người dùng duyệt; `publish_doc` / `list_docs` / `get_doc` trên Y.Doc cục bộ |
| 10h | `update_doc` | ghi delta nhỏ nhất vào `Y.Text "source"` |
| 10i | Share qua xác nhận | `share_doc` / `create_link` / `revoke_link` qua hộp xác nhận trong extension |
| 10j | Docs & phát hành | hướng dẫn cài Claude/Cursor, ROADMAP (Remote MCP hoãn), privacy, e2e, version 1.3.0 |
