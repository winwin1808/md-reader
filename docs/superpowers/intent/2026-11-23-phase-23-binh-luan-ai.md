# Intent: Phase 23 — Bình luận + AI xử lý góp ý
Author: winwin1808. Status: draft. Phase: 23

Brainstorm (đã duyệt): `docs/superpowers/intent/2026-11-23-phase-23-binh-luan-ai-va-xuat-nhe-brainstorm.md`.
Phase 24 (XLSX, xuất từng hình, giao diện tài liệu, Graphviz/Vega-Lite) là vòng pipeline riêng sau phase này.

## Problem

Người dùng nhờ AI viết tài liệu Markdown rồi gửi link cho đồng nghiệp/khách. Người nhận hiện chỉ xem được
(link xem) hoặc sửa thẳng vào nội dung (link sửa) — không có chỗ để **góp ý**. Góp ý đi qua chat/email,
người viết phải chép lại từng ý cho AI, rồi tự sửa hoặc nhờ AI sửa. Chính người viết cũng không có cách ghi
chú "đoạn này cần làm lại" để giao cho AI trên tài liệu chưa chia sẻ.

Thị trường đã chứng minh nhu cầu (HackMD có comment + resolve; nhiều MCP server cho Google Docs chỉ để AI đọc
và resolve bình luận), nhưng các vòng đó bắt tài liệu nằm trên Google Docs và cấp OAuth đọc cả Drive.

## Proposed outcome

- Chọn một đoạn chữ khi Đọc hoặc Sửa → "Bình luận" → nhập nội dung. Bình luận gắn với đúng đoạn chữ đó và
  vẫn bám đúng chỗ khi tài liệu được sửa xung quanh.
- Panel **Bình luận** liệt kê các thread (đoạn trích, tác giả, thời gian, trả lời), lọc Đang mở / Đã xong;
  bấm thread → cuộn và tô đoạn chữ. Đoạn có bình luận có mốc nhỏ ở lề (hợp ngôn ngữ ghi chú lề của Lề sách).
- Trả lời, Resolve, Mở lại; tác giả xoá được bình luận của chính mình.
- Hoạt động trên **tài liệu chưa chia sẻ** (cục bộ) và trên **tài liệu đã chia sẻ**: chủ tài liệu, người có
  **link sửa** và người có **link xem** đều bình luận được; mọi người thấy bình luận đồng bộ thời gian thực.
  Web `/s/:token` có panel giống extension.
- **AI qua MCP**: `list_comments` (thread đang mở kèm đoạn chữ được neo, trả lời, trạng thái), `reply_comment`,
  `resolve_comment`. Luồng chuẩn: AI đọc bình luận → sửa nội dung bằng `update_doc` (giữ nguyên hộp xác nhận
  với tài liệu đang chia sẻ như phase 22) → trả lời ngắn điều đã làm → resolve. Resolve/trả lời **không** hỏi
  xác nhận riêng; tác giả ghi là tên client AI như các lần sửa MCP khác.

## Affected packages

- `packages/core` — mô hình dữ liệu bình luận trong Y.Doc, neo, migration `formatVersion`, API thuần
  (thêm/trả lời/resolve/xoá/liệt kê, tính đoạn trích hiện tại từ neo).
- `packages/ui` — panel Bình luận, mốc lề, nút tạo bình luận từ vùng chọn ở Viewer và editor live preview.
- `apps/extension` — gắn vào app page (cục bộ + phòng chia sẻ), xử lý lệnh MCP mới trong tab app page / SW.
- `apps/api` — peer-guard: link xem chỉ được ghi bình luận/trả lời của chính mình; link sửa được ghi `source`,
  `meta.actors` và bình luận của mình.
- `apps/web` — panel Bình luận trên `/s/:token` cho link xem và link sửa.
- `packages/mcp` (`le-sach-mcp`) — ba tool mới, bump phiên bản; giao thức cầu nối thêm lệnh mới tương thích
  ngược (extension cũ trả lỗi rõ "cần cập nhật extension").

## Constraints

Ngoài 8 ràng buộc khoá cứng trong DESIGN.md:

- Bình luận nằm **trong Y.Doc** (đồng bộ cùng cơ chế phòng hiện có, không thêm bảng D1, không thêm endpoint REST cho nội dung bình luận).
- Đổi schema → tăng `formatVersion`, có migration từ v2 và test fixture v2 cũ; client cũ gặp tài liệu mới hiện banner "phiên bản mới hơn" đã có (phase 13), không làm hỏng dữ liệu.
- Peer-guard từ chối **trước khi áp** (như phase 14): link xem ghi bất cứ thứ gì ngoài bình luận của mình → hoàn tác/đóng 4403 như cũ; không được sửa/xoá/resolve-giả bình luận của người khác trừ chủ tài liệu và link sửa được resolve.
- Giới hạn: nội dung một bình luận ≤ 4 000 ký tự; trần số bình luận mỗi phòng nằm trong trần dung lượng phòng hiện có (64 MiB) — không thêm hạn mức mới trừ khi design thấy cần.
- Nội dung bình luận hiển thị dạng **văn bản thuần** (không render Markdown/HTML) — tránh mở thêm bề mặt XSS.
- Content script không đổi; ngân sách content.js giữ nguyên.
- Không làm trong phase này: đề xuất chỉnh sửa (suggestion mode), @mention, thông báo email/push, reaction.

## Open questions

1. Cấu trúc cụ thể trong Y.Doc: `Y.Map "comments"` cấp gốc (key = id thread) hay `Y.Array`; mỗi thread là `Y.Map` lồng hay object bất biến + log trả lời. Ảnh hưởng tới peer-guard kiểm "chỉ ghi phần của mình".
2. Neo: `Y.RelativePosition` cho đầu/cuối vùng chọn trên `Y.Text "source"` — Viewer (HTML đã render) phải ánh xạ vùng chọn DOM về offset trong source; cần một spike nếu ánh xạ chưa có sẵn.
3. Đoạn chữ được neo bị xoá hết: thread thành "mồ côi" (hiện riêng ở cuối panel với đoạn trích lưu lúc tạo) — design xác nhận.
4. Danh tính người bình luận qua link xem: dùng tên hiển thị trong Cài đặt → Cộng tác (extension) và tên nhập trên web (đã có cho presence?) — design kiểm.
5. "Thu hồi link" có xoá bình luận của người dùng link đó không (đề xuất: không, giữ lịch sử góp ý).
6. Lịch sử / khôi phục mốc (`restoreCheckpoint`) có khôi phục cả bình luận không (đề xuất: không — chỉ `source`).

## Sub-phases

| # | Phase con | Nội dung |
|---|---|---|
| 23a | core: mô hình bình luận | Dữ liệu bình luận trong Y.Doc, neo theo vùng chữ (`Y.RelativePosition`), API thuần, migration `formatVersion` + fixture v2 |
| 23b | ui: panel + mốc lề | Panel Bình luận, mốc ở lề, tạo bình luận từ vùng chọn ở chế độ Đọc và Sửa |
| 23c | extension: gắn app page | Bình luận trên tài liệu cục bộ và phòng chia sẻ, tên tác giả, cuộn/tô đoạn chữ |
| 23d | api: peer-guard | Link xem chỉ ghi bình luận của mình; link sửa thêm quyền bình luận/resolve; từ chối trước khi áp |
| 23e | web: `/s/:token` | Panel Bình luận cho link xem và link sửa |
| 23f | mcp: tool bình luận | `list_comments` / `reply_comment` / `resolve_comment` + xử lý trong extension, tương thích ngược |
| 23g | e2e + docs | e2e cộng tác (link xem bình luận, link sửa resolve) + e2e MCP thật, `docs/MCP.md`, ROADMAP, phiên bản |

Phase con nào vượt điều kiện kích cỡ (≤ 5 file, ≤ 300 dòng diff, ≤ 1 file test mới) thì `plan-from-design` chia tiếp.
