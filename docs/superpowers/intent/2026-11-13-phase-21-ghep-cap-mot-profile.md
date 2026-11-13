# Intent: Phase 21 — Ghép cặp MCP: một profile, không hỏi lặp
Author: haonq. Status: designed. Phase: 21
Design: docs/superpowers/specs/2026-11-13-phase-21-design.md

## Problem
Bật `le-sach-mcp` lên, sau một lúc trình duyệt cứ mở tab "Cho phép ứng dụng AI kết nối?" liên tục, không dứt.

Nguyên nhân đã kiểm trên máy thật (2026-11-13): hai profile Chrome cùng cài LeSach và cùng bật "Kết nối AI". `le-sach-mcp` chỉ ghim một khoá extension — của profile đã ghép (`Profile 1`, khoá `D176-E4C1`). Profile còn lại (`Default`, danh sách duyệt rỗng) mỗi lần quét cổng (30 giây) lại gặp máy chủ, thấy chưa duyệt, và mở một tab hỏi mới:

- Từ chối không được ghi nhớ (`apps/extension/src/worker/bridge.ts` nhánh `decide(allow=false)`; `worker/index.ts` `requestPairing` mở tab ở mọi `hello` chưa duyệt).
- Không trả lời cũng lặp: máy chủ đóng kết nối chưa xác thực sau 10 giây (`packages/mcp/src/bridge-server.ts` `AUTH_DEADLINE_MS`), lần quét sau hỏi lại.
- Đồng ý cũng vô ích: máy chủ chỉ nhận đúng khoá đã ghim; và nếu bấm Cho phép sau hơn 10 giây thì quyết định bị bỏ qua lặng lẽ (entry đã bị gỡ), không lưu gì, không báo gì.

## Proposed outcome
- Chỉ profile đã ghép cặp với một ứng dụng AI mới dùng kết nối đó. Profile khác **không tự mở tab, không tự hỏi** — dù máy chủ là bản mới hay bản `le-sach-mcp@1.3.2` cũ.
- Profile chưa ghép vẫn thấy được trong Cài đặt → Kết nối AI rằng có một ứng dụng AI đang chạy và nó đang ở trạng thái nào (chờ kết nối / đã ghép với trình duyệt hay profile khác), và **tự bấm kết nối khi cần**.
- Từ chối được ghi nhớ; không bao giờ có hai tab hỏi cho cùng một ứng dụng.
- Bấm Cho phép luôn có kết quả rõ: hoặc kết nối được, hoặc báo lý do (hết hạn chờ, ứng dụng AI đã ghép với profile khác) — không còn im lặng.
- Lần ghép cặp đầu tiên của người dùng mới (một profile, máy chủ chưa ghim ai) không khó hơn hiện nay.

## Affected packages
`packages/core` (giao thức cầu nối: trường mới trong `hello`) · `packages/mcp` (máy chủ gửi dấu vân tay khoá đã ghim; hạn chờ khi đang đợi người bấm; cách bỏ ghim để profile khác ghép) · `apps/extension` (worker: quyết định hỏi/không hỏi, nhớ từ chối, chống tab trùng; Cài đặt → Kết nối AI: trạng thái + nút kết nối) · `packages/ui` nếu phần Cài đặt nằm ở đó (i18n vi + en) · docs (`docs/MCP.md`, ghi chú phát hành).

## Constraints
- 8 ràng buộc khoá cứng. `chrome.*` chỉ ở `apps/extension`; core không biết provider/không `chrome.*`.
- Không nới bảo mật cầu nối v2: vẫn xác thực hai chiều ECDSA, vẫn ghim một khoá extension, cửa sổ ghép 10 phút, mọi lần ghép vẫn cần người bấm Cho phép. Trường mới trong `hello` chỉ là gợi ý hiển thị — máy chủ vẫn là nơi quyết định.
- Tương thích hai chiều: extension mới ↔ máy chủ `1.3.2` (không có trường mới) và máy chủ mới ↔ extension `1.5.0` (bỏ qua trường lạ) đều phải chạy, và extension mới không được lặp tab với máy chủ cũ.
- Không đổi schema Y.Doc. Không thêm dependency. Không thêm quyền manifest.
- Content script không bị chạm (ngân sách ≤ 60 KB gz giữ nguyên).

## Open questions
- Khi máy chủ chưa ghim ai: profile có tự hỏi một lần không, hay luôn phải bấm trong Cài đặt? (Ràng buộc: người dùng mới một profile không khó hơn hiện nay.)
- Ghi nhớ "đã hỏi / đã từ chối" theo khoá máy chủ lưu ở đâu, có hết hạn không.
- Cách để profile khác tiếp quản một máy chủ đã ghim: lệnh `le-sach-mcp` bỏ ghim, hay chỉ hướng dẫn xoá file ghép cặp.
- Hạn 10 giây của máy chủ với kết nối đang chờ người bấm: nới theo cửa sổ ghép, hay extension tự nối lại lúc bấm Cho phép.
- Trường mới trong `hello` mang gì: dấu vân tay khoá đã ghim, hay chỉ cờ "đã ghim".
- Số phiên bản phát hành (`le-sach-mcp`, extension) và thứ tự publish.

## Sub-phases
| # | Phase con | Xong nghĩa là |
|---|---|---|
| 21a | Giao thức `hello` | `hello` có trường tuỳ chọn cho biết máy chủ đã ghim khoá extension nào; parser nhận cả `hello` cũ không có trường; có test |
| 21b | Máy chủ MCP | `le-sach-mcp` gửi trường đó; kết nối đang chờ người bấm không bị đóng sớm một cách im lặng; có cách bỏ ghim để profile khác ghép; có test |
| 21c | Worker không hỏi lặp | Extension không mở tab khi máy chủ đã ghim khoá khác; nhớ từ chối; không tab trùng; với máy chủ cũ hỏi tối đa một lần; Cho phép quá hạn có kết quả rõ; có test |
| 21d | Cài đặt → Kết nối AI | Thấy ứng dụng AI đang chạy và trạng thái của nó; nút kết nối thủ công; thông báo "đã ghép với profile khác"; i18n vi + en; có test |
| 21e | E2E, tài liệu, phiên bản | E2E hai bản extension với một máy chủ MCP thật không lặp tab; `docs/MCP.md` và ghi chú phát hành cập nhật; nâng phiên bản |
