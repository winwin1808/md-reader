# Intent: Phase 11 — Vá bảo mật trước khi phát hành 1.3.0
Author: haonq. Status: designed. Phase: 11
Design: docs/superpowers/specs/2026-10-27-phase-11-design.md

Nguồn: security audit đầy đủ 2026-10-27 (skill `security-audit`, run-1 tại `~/security-audit-skill/md-reader/run-1`,
bản sao REPORT ở `docs/research/security-audit-2026-10-27.md` — KHÔNG commit cho tới khi vá xong). Người dùng: "mở phase 11
sửa hết các lỗi bảo mật đã đề ra". 1.3.0 chưa nộp store, `le-sach-mcp` chưa publish npm → được đổi giao thức cầu nối.

## Problem

Audit tìm 8 hướng tấn công có đường đi đầy đủ trong mã nguồn (chưa chạy thật vì không có sandbox) và 2 mảng chưa soi:

1. XSS lưu trữ: info string của code fence lọt qua sanitize (`/^language-/`) rồi vào `innerHTML` ở header khối code
   (`packages/ui/src/Viewer.tsx`) — chạy script trên trang xem link chia sẻ (web) và app page; trang web không có CSP.
2. Link đã thu hồi / hết hạn vẫn đọc-ghi được trên WebSocket đang mở, và tới 60 s trên kết nối mới (cache xác thực).
3. `update_doc` từ AI tự lưu xuống file trên đĩa qua handle đã cấp quyền, không hỏi người dùng.
4. Export HTML chèn Content-Type ảnh từ xa (không kiểm) vào thuộc tính `src` → chèn thuộc tính/handler; file export không có CSP.
5. Người có link sửa đặt `meta.formatVersion` > 2 → phía chủ ném lỗi không bắt, không bind phòng, không checkpoint, MCP ghi hỏng.
6. Cầu nối MCP: xác thực bằng header Origin giả được, gửi `pairKey` dạng rõ trong `hello`, tin `welcome` không cần chứng minh;
   extension tin mọi listener trên loopback → tiến trình/OS user khác trên cùng máy chiếm cặp ghép, đọc/sửa tài liệu.
7. Người ẩn danh làm cạn tài nguyên chung: khoá bản cài tự đặt nên quota theo khoá vô nghĩa, quota bytes theo IP bị bỏ qua khi
   phòng có khoá, IPv6 không gộp, update Yjs không giới hạn kích thước, DO storage không trần.
8. Xoá phòng / takedown: purge DO lỗi thì nội dung mồ côi, không phát hiện, không thử lại (D1 bị xoá trước nên chủ mất quyền thử lại).
9. (Chưa soi) Giả clientID trong awareness relay.

## Proposed outcome

- Không còn đường chèn HTML từ nội dung tài liệu vào DOM ngoài sanitize; trang web có CSP chặn script inline; export HTML có CSP và
  chỉ nhúng ảnh có MIME `image/*` hợp lệ.
- Thu hồi / hết hạn link có hiệu lực ngay: socket đang mở bị đóng, cache xác thực bị xoá, kết nối mới nhận 410.
- Sửa của AI chỉ ghi vào Y.Doc; ghi xuống file trên đĩa cần người dùng bấm Lưu (hoặc sửa tay sau đó); có chỉ báo "AI đã sửa — chưa lưu".
- `formatVersion` lạ từ peer không làm hỏng phiên của chủ.
- Cầu nối MCP v2: máy chủ MCP có cặp khoá ECDSA riêng (file 0600), extension ghim khoá công khai khi người dùng duyệt ghép cặp,
  mỗi kết nối chứng minh hai chiều bằng chữ ký trên nonce; không bí mật nào đi qua dây.
- Quota bytes theo IP luôn áp dụng, IPv6 gộp theo /64, trần kích thước message Yjs và tổng dung lượng mỗi phòng.
- Xoá phòng: purge DO + ảnh trước, kiểm kết quả, chỉ xoá D1 khi purge thành công; lỗi → 502 để thử lại.
- Awareness: relay không cho client sửa state của clientID khác.
- Audit lại có mục tiêu sau khi vá; docs/privacy/MCP.md cập nhật; Worker deploy lại.

## Affected packages

`packages/core` (sanitize schema, export html, migrate/compat, bridge protocol v2) · `packages/ui` (Viewer) · `apps/web` (CSP `_headers`) ·
`apps/api` (revoke/expiry, quota, size caps, purge ordering, awareness) · `apps/extension` (autosave gate, compat, bridge v2) ·
`packages/mcp` (khoá ECDSA, bắt tay v2).

## Constraints

- 8 ràng buộc khoá cứng giữ nguyên; không đổi schema Y.Doc (`formatVersion` vẫn 2).
- Content script ≤ 60 KB gz, không Yjs.
- Vẫn Workers Free (DO SQLite + D1). Không thêm dependency mới nếu WebCrypto/Node crypto đủ.
- Mỗi phase con ≤5 file / ≤300 dòng / ≤1 file test mới; mỗi lỗ hổng có test hồi quy tái hiện được (đỏ trước khi vá).
- Không chạm máy chủ thật khi test; deploy chỉ sau khi merge.

## Non-goals

Remote MCP/OAuth; tài khoản người dùng; WAF/rate limit của Cloudflare (ngoài repo); TTL tự xoá phòng cũ (ghi nợ); lọc nội dung Yjs
theo kiểu (chỉ cho edit peer ghi `source`) — để sau, phase này chỉ làm phía chủ chịu lỗi được.
