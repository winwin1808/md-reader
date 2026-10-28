# Design: Phase 13 — Hoàn thiện trải nghiệm trước khi lên store
Author: haonq (coordinator: Claude Opus). Status: designed. Phase: 13
Intent: docs/superpowers/intent/2026-10-28-phase-13-hoan-thien.md

## Approach chosen
- `SyncStatus` thêm `'revoked'` (đóng 4410) và `'full'` (4413, 1009) ở cả ba nơi khai báo (extension `shared/collab.ts`, web `collab.ts`, ui `TopToolbar`); nhãn riêng.
- `DocSession.newerFormat` → banner `ext.notice.newerFormat` cùng kiểu các notice hiện có.
- `bridge.decide` đổi state đồng bộ trước mọi await (chặn lần gọi thứ hai).
- Content script gửi `alertLang` (theo cài đặt `localizeAlerts` giống App: true → 'vi', còn lại 'en') trong message `renderMd`; worker truyền vào `renderMarkdownForPage`.
- `useExport` nhận `resolveImage` (resolver đang dùng cho Viewer) và truyền `fetchImage` cho `exportToHtml` để ảnh tương đối được nhúng.
- Flake: tìm nguyên nhân thật (thời gian cố định / timer thật) và sửa test, không tăng timeout mù.
Task song song commit thẳng lên `phase-13` (worktree `../md-reader-13`) bằng pathspec.

## Sub-phase queue
- 13a1: planned
- 13a2: planned
- 13b: planned
- 13c: planned
- 13d: planned
- 13e: planned
- 13f: planned
