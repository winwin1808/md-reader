# Phase 22 — Vá bảo mật sau audit run-2

Author: haonq. Status: designed. Phase: 22
Intent: docs/superpowers/intent/2026-11-13-phase-22-va-bao-mat-audit-2.md

## Sub-phase queue

- 22a — planned
- 22b — planned
- 22c — planned
- 22d — planned
- 22e — planned
- 22f — planned
- 22g — planned
- 22h — planned

## Approach chosen

Vá tại điểm quyết định tin cậy cuối cùng, mỗi lead một thay đổi nhỏ có test hồi quy. Bỏ: (1) viết lại
peer-guard dựa trên áp thử vào bản sao Y.Doc — tốn bộ nhớ gấp đôi mỗi update; (2) sửa partyserver để
chuẩn hoá tên phòng — không sở hữu thư viện.

## 22a — peer-guard: chu trình origin + chỉ chuỗi vào `source` (`apps/api/src/peer-guard.ts`)

- `resolve()` giữ tập struct đã thăm trong một lượt đi; gặp lại struct → kết quả `null` (→ `'unresolved parent'`). Không ném lỗi, không lặp vô hạn.
- Item có đích là `source` chỉ được mang `ContentString` (ref 4) hoặc `ContentDeleted` (ref 1) và `parentSub === null`; còn lại trả `'forbidden content in source'`. Quy tắc `actors` giữ nguyên.
- Test: update tự tạo có hai item tham chiếu `origin` lẫn nhau kết thúc trong < 1 s với vi phạm; embed / format / binary / any vào `source` bị từ chối; gõ chữ và xoá bình thường vẫn qua.

## 22b — peer-guard: từ chối update nhảy clock

- Với mỗi clientID trong update: struct đầu phải có `clock <= Y.getState(doc.store, c)` (clientID mới: `=== 0`, đã có) và các struct liền nhau không hở; struct `Y.Skip` bị từ chối. Lý do trả `'clock gap'`.
- Nhờ vậy mọi update qua guard đều được áp ngay, `roomBytes` (đếm ở handler `'update'`) phản ánh đúng.
- Test: update của clientID đã sở hữu bắt đầu sau khoảng hở bị từ chối; update gối đầu (clock thấp hơn state) vẫn qua.

## 22c — Tên phòng WebSocket dạng chuẩn (`apps/api/src/index.ts`)

- Ở nhánh `/parties/doc-room/:id`: nếu đoạn thô trên đường dẫn khác `encodeURIComponent(safeDecode(đoạn))` → `404` trước khi xác thực hay chuyển tiếp. Tên DO mà partyserver dùng do đó luôn trùng tên mà revoke/purge/cron dùng.
- Test: `ROOM%41BC` kiểu bí danh của một phòng hợp lệ → 404; id thường vẫn nối được.

## 22d — Đọc body có trần (`apps/api/src/api.ts` + `apps/api/src/body.ts` mới)

- `readCapped(req: Request, max: number): Promise<Uint8Array | null>` — đọc `req.body` theo luồng, vượt `max` thì huỷ reader và trả `null`; `content-length` khai lớn hơn `max` trả `null` ngay.
- Dùng cho upload ảnh (`MAX_ASSET_BYTES`), `/api/report`, `/api/feedback` (trần hiện có của từng route). Mã trạng thái khi vượt giữ như hiện tại (413).
- Test: body dạng stream không có `content-length`, dài hơn trần → 413 và stream bị huỷ sớm.

## 22e — Upload ảnh đua với xoá phòng (`apps/api/src/api.ts`, `assets.ts`)

- Sau khi `put` ảnh: kiểm lại phòng còn sống; không còn → xoá ảnh vừa ghi, trả như phòng không tồn tại.
- Mọi đường xoá phòng (chủ xoá, takedown, cron) quét xoá ảnh của phòng **thêm một lần sau** khi bản ghi phòng đã xoá.
- Test: phòng bị xoá giữa lúc kiểm quyền và `put` → không còn dòng ảnh nào của phòng, `GET /api/a/:id` 404.

## 22f — `update_doc` hỏi khi tài liệu đã chia sẻ (`apps/extension/src/app/bridge-executor.ts`, `packages/ui` `ConfirmAgentDialog`)

- `ConfirmRequest` thêm biến thể `{ kind: 'update_shared'; title: string }` (tên theo đúng kiểu discriminant đang dùng trong file). Bản dịch vi + en: "… muốn sửa một tài liệu đang được chia sẻ. Người có link sẽ thấy thay đổi ngay."
- `update_doc`: sau khi `baseHash` khớp, nếu tài liệu đang chia sẻ → `confirm(...)`; từ chối / hết giờ → lỗi như `share_doc` bị từ chối; đồng ý → kiểm lại `baseHash` rồi mới ghi. Tài liệu chưa chia sẻ: không hỏi (như cũ).
- Test: đã chia sẻ + từ chối → không ghi; đã chia sẻ + đồng ý → ghi; chưa chia sẻ → không hỏi.

## 22g — In mã khoá máy chủ + zod (`packages/mcp`)

- Khi khởi động, dòng log stderr thêm `mã máy chủ <ABCD-1234>` = `fingerprint(keyId(serverKey))`, cùng giá trị hộp thoại ghép cặp của extension hiển thị.
- `zod` → `4.6.6` (ghim chính xác), cập nhật `pnpm-lock.yaml`.
- Test: hàm dựng dòng khởi động chứa mã khớp với khoá trong file ghép cặp tạm (`MDR_PAIR_FILE`).

## 22h — Tài liệu

`docs/MCP.md`: mã trong hộp thoại so với dòng khởi động của `le-sach-mcp`; `update_doc` vào tài liệu đã chia sẻ cần đồng ý; ghi chú ghim-lần-đầu không an toàn trên máy nhiều người dùng / tiến trình sandbox không tin cậy. `DESIGN.md` §4, `CHANGELOG`, handover.

## Để lại có chủ ý

- Trần tổng dung lượng Durable Object và bộ đếm quota nguyên tử: cần quyết định vận hành (giới hạn theo gói Cloudflare, có thể chặn người dùng thật) — không vá mù.
- Cửa sổ ghim-lần-đầu 10 phút: giữ thiết kế v2, chỉ ghi rõ giới hạn ở tài liệu.
