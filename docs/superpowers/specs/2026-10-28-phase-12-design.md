# Design: Phase 12 — Gia cố máy chủ tiếp
Author: haonq (coordinator: Claude Opus). Status: designed. Phase: 12
Intent: docs/superpowers/intent/2026-10-28-phase-12-gia-co-may-chu.md

## Approach chosen
- (a) Lọc peer ở DocRoom bằng hoàn tác CRDT: y-partyserver áp update của client với `transactionOrigin = connection` (server/index.js `readSyncMessage(..., connection, …)`).
  DocRoom nghe `afterTransaction`: origin là kết nối có `state.prefix` (link, không phải chủ) mà transaction đổi kiểu ngoài `source`, hoặc đổi `meta.actors` ở khoá không thuộc clientID
  vừa ghi trong transaction đó → `UndoManager` (scope `meta` + `history`, trackedOrigins = các kết nối link) `undo()` ngay rồi đóng kết nối 4403. Bác bỏ: giải mã update trước khi áp
  (phải tự suy parent từ origin item — dễ sai, tốn).
- (b) `rooms.last_seen` (migration 0004) cập nhật khi có kết nối WS (tối đa 1 lần/ngày/phòng); cron hằng ngày xoá ≤ 25 phòng `last_seen < now − 90 ngày` qua `deleteRoomEverywhere`
  (đã purge trước, kiểm kết quả) và xoá `usage_daily` có `day < hôm nay − 2`.
- (c) Trần toàn cục ảnh trong `limits.decide('asset')`: tổng dung lượng ảnh đang lưu ≤ 3 GiB (SUM `assets.size`) → `QUOTA_EXCEEDED`; ảnh tải lên toàn máy chủ/ngày ≤ 1 GiB → rate (429).

Bỏ qua sub-phase branch: các task song song commit thẳng lên `phase-12` bằng pathspec (khác §8 DESIGN — để tăng tốc, review theo dải commit của từng sub-phase).

## Sub-phase queue
- 12a: planned
- 12b: planned
- 12c: planned
- 12d: planned
- 12e: pending

## Sizing
12a room.ts + test (2) · 12b migration + tokens(2) + index + tests (≤5) · 12c limits + test (2) · 12d index + limits + wrangler + tests (≤5) · 12e docs.
Thứ tự: 12a ∥ 12b ∥ 12c → 12d (cần 12b, 12c) → 12e.
