# Intent: Phase 12 — Gia cố máy chủ tiếp
Author: haonq. Status: designed. Phase: 12
Design: docs/superpowers/specs/2026-10-28-phase-12-design.md

## Problem
Sau phase 11 còn 2 mục audit vá một phần: (5) người có link sửa vẫn ghi được `meta`/`history` (đặt `formatVersion`, xoá `aiUnsaved`, sửa tên tác giả người khác);
(7) chưa có trần toàn cục cho dung lượng ảnh và phòng bỏ không sống mãi → tài khoản Cloudflare Workers Free (D1 5 GB, DO storage) có thể bị lấp đầy. Bảng `usage_daily` không bao giờ được dọn.

## Proposed outcome
- Kết nối bằng link sửa chỉ được ghi `source` và mục `meta.actors[<clientID của chính nó>]` (tên tác giả cho blame); mọi thay đổi khác lên `meta`/`history` bị hoàn tác ngay và kết nối bị đóng.
- Trần toàn cục: tổng dung lượng ảnh lưu trữ và dung lượng ảnh tải lên mỗi ngày trên toàn máy chủ.
- Phòng không ai mở trong 90 ngày tự xoá (cron hằng ngày); `usage_daily` cũ hơn 2 ngày bị dọn.
- Privacy/listing nói đúng chính sách lưu trữ mới; Worker + migration D1 deploy.

## Constraints
8 ràng buộc khoá cứng giữ nguyên; Workers Free (DO SQLite + D1, cron trigger); không đổi schema Y.Doc; không thêm dependency; test hồi quy đỏ trước.

## Non-goals
Tài khoản người dùng; thông báo email trước khi xoá phòng; R2/KV.
