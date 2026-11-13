# Intent: Phase 22 — Vá bảo mật sau audit run-2

Author: haonq. Status: shipped. Phase: 22
Design: docs/superpowers/specs/2026-11-13-phase-22-design.md

## Problem

Audit bảo mật run-2 (2026-11-13, chỉ đọc mã nguồn, commit `6420133`) để lại 10 lead `needs_validation`.
Chín lead có bản vá nhỏ, rõ ràng ở mã nguồn; chủ repo yêu cầu "fix hết".

## Proposed outcome

1. `peer-guard`: không còn vòng lặp vô hạn khi chuỗi `origin` tạo chu trình.
2. `peer-guard`: link sửa chỉ đưa được chuỗi (và xoá) vào `source`.
3. `peer-guard`: update nhảy clock (struct treo) bị từ chối, không lách trần 64 MiB/phòng.
4. Worker: tên phòng trên đường dẫn WebSocket phải ở dạng chuẩn — không còn DO "bí danh" nằm ngoài thu hồi/xoá.
5. Worker: body của upload ảnh, `/api/report`, `/api/feedback` đọc theo luồng có trần, không nạp hết vào bộ nhớ trước khi kiểm.
6. Worker: upload ảnh chạy đua với xoá phòng không để lại ảnh mồ côi còn phục vụ công khai.
7. Extension: `update_doc` từ AI vào tài liệu **đã chia sẻ** phải được người dùng đồng ý (`ConfirmAgentDialog`).
8. `le-sach-mcp`: in mã nhận dạng khoá máy chủ khi khởi động để so với hộp thoại ghép cặp; `zod` ≥ 4.6.6.
9. `docs/MCP.md` nói đúng: mã nào so với mã nào, giới hạn ghim-lần-đầu trên máy nhiều người dùng.

## Affected packages

`apps/api` · `apps/extension` · `packages/ui` · `packages/mcp` · `docs/`.

## Constraints

- Không đổi schema Y.Doc, không đổi giao thức cầu nối (vẫn v2), không thêm quyền manifest, không thêm dependency.
- Không đổi phiên bản: `le-sach-mcp` 1.3.3 và extension 1.5.1 chưa phát hành, bản vá đi cùng.
- Không deploy Worker, không publish npm, không nộp store, không tự merge — việc của người.
- Test không đụng `~/.config/md-reader`, không đụng cổng 47821–47830 thật, không gọi máy chủ đã deploy.

## Open questions

Không. Hai điểm để lại có chủ ý (ghi ở spec): trần tổng dung lượng DO / bộ đếm quota nguyên tử, và cửa sổ ghim-lần-đầu 10 phút.

## Sub-phases

| # | Phase con | Gói |
|---|---|---|
| 22a | peer-guard: chu trình origin + chỉ chuỗi vào `source` | api |
| 22b | peer-guard: từ chối update nhảy clock | api |
| 22c | Tên phòng WebSocket dạng chuẩn | api |
| 22d | Đọc body có trần | api |
| 22e | Upload ảnh đua với xoá phòng | api |
| 22f | `update_doc` hỏi khi tài liệu đã chia sẻ | extension, ui |
| 22g | In mã khoá máy chủ + zod | mcp |
| 22h | Tài liệu | docs |
