# Intent: Phase 17 — Hướng dẫn dùng AI + bản Chrome Web Store
Author: haonq. Status: draft. Phase: 17

## Problem
Extension đã được duyệt trên Chrome Web Store với ID `eolclccibhickmpbpbdodbhopnddcdog`, nhưng `le-sach-mcp` chỉ nhận Origin của ID bản dev
(`ojcemoafaibjfghljkbagnkbgljakbji`, `KNOWN_EXTENSION_IDS`), nên người cài từ store bị từ chối kết nối nếu không tự đặt `MDR_EXTENSION_ID`.
Bật Cài đặt → Kết nối AI xong thì không có gì chỉ tiếp: người dùng không biết phải cài `le-sach-mcp` vào client AI ra sao, phải khởi động lại,
phải duyệt ghép cặp, và nên nhờ AI làm gì. README và site vẫn ghi store "Sắp có".

## Proposed outcome
- Người cài từ store bật Kết nối AI, làm theo hướng dẫn trong app, ghép cặp được với Claude Code / Claude Desktop / Cursor mà không phải điền ID hay token.
- Khi bật Kết nối AI, mục cài đặt hiện hướng dẫn 3 bước: (1) tab Claude Code / Claude Desktop / Cursor với lệnh hoặc JSON và nút Sao chép;
  (2) khởi động lại client, bấm Cho phép khi mã nhận dạng khớp log; (3) câu lệnh mẫu để nhờ AI. Chưa có client được duyệt → mở sẵn; có rồi → thu gọn.
- `le-sach-mcp@1.3.2` nhận cả ID store; README vi/en, site, docs/MCP(.en) trỏ link store thật. Email liên hệ privacy là `qhao.work@gmail.com`.

## Affected packages
`packages/core` (`KNOWN_EXTENSION_IDS`), `packages/mcp` (version 1.3.2), `packages/ui` (mục Kết nối AI + i18n), `apps/extension` (truyền trạng thái nếu cần),
docs: `README.md`, `README.vi.md`, `site/index.html`, `docs/MCP.md`, `docs/MCP.en.md`, `docs/store/privacy-policy.md`, `site/privacy.html`.

## Constraints
8 ràng buộc khoá cứng; `packages/ui` không dùng `chrome.*` (sao chép dùng `navigator.clipboard`); không thêm dependency; i18n vi + en cùng tập khoá;
không chạm `docs/store/listing.md` và các file promo chưa commit của người dùng. Người dùng tự `npm publish` 1.3.2 (OTP) sau merge.

## Open questions
- Câu lệnh mẫu cụ thể (vi/en) và việc có link tới docs/MCP trên GitHub hay không — stage 2 chốt.
- Bản Firefox (`moz-extension://`) — ngoài phạm vi, ghi Deferred.

## Sub-phases
| # | Phase con | Xong nghĩa là |
|---|---|---|
| 17a | ID store | `eolclccibhickmpbpbdodbhopnddcdog` trong `KNOWN_EXTENSION_IDS` có test; `le-sach-mcp` 1.3.2; snippet config ghi 1.3.2 |
| 17b | Hướng dẫn trong app | Bật Kết nối AI → 3 bước, tab 3 client có Sao chép, câu lệnh mẫu; mở sẵn khi chưa có client, thu gọn khi có; vi + en |
| 17c | Tài liệu store | README vi/en + site dùng link store thật, bỏ "Sắp có"; docs/MCP(.en) có cách cài từ store; email liên hệ privacy (`docs/store/privacy-policy.md`, `site/privacy.html`) đổi thành `qhao.work@gmail.com` |
