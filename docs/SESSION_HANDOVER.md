# Session Handover — md-reader

Cập nhật: 2026-10-24. Branch: `phase-7` (xếp chồng trên `phase-6`).

## Đang ở đâu

- **Phase 6 (Gia cố) đã ship**: MR https://github.com/winwin1808/md-reader/pull/1
  (`phase-6` → `main`), **mở, chưa merge** — chờ người duyệt. 30 phase con 6a..6l.
- **Phase 7 (Giao diện Lề sách + logo)** đang chạy: spec
  `docs/superpowers/specs/2026-10-24-phase-7-design.md`, intent
  `docs/superpowers/intent/2026-10-24-phase-7-le-sach.md`. Hàng đợi 7a1..7s2 trong spec.
- **Phase 8 (Chia sẻ & cộng tác)** chưa bắt đầu; xếp chồng trên `phase-7`.

Cách chạy tiếp: mở spec phase 7, lấy phase con đầu tiên còn `pending`/`planned`, gọi
`plan-from-design` (hoặc `build-from-plan` nếu plan đã có). Model: subagent chỉ
sonnet (builder, reviewer, spiker) / haiku (guard); opus chỉ ở main loop cho spec/plan/quyết định.

## Trạng thái xanh lúc ship phase 6 (đo thật)

```
packages/core test        182 passed
packages/ui test          215 passed
apps/extension test       169 passed
pnpm -r typecheck         exit 0
pnpm -r build             exit 0
pnpm --filter extension e2e   3 passed (Playwright, Chromium load-unpacked)
dist/content.js           gz 11 763 B (giới hạn 61 440 B)
dist/app.js               gz ~408 kB (KaTeX trong chunk chính — hoãn tối ưu)
```

## Phase 6 đã làm gì (tóm tắt)

Delta nhỏ nhất khi ghi Y.Text · tách App.tsx thành hook · mở file an toàn (whenSynced +
originHash, banner khi file ngoài đổi) · `formatVersion: 2` + migration · registry `docId`
(`?doc=<id>`) mỗi doc một IDB · handle theo doc, xin lại quyền, "Mở file…" · diff 3 chiều thật ·
rehype plugin trước sanitize + `clobberPrefix` · manifest `storage`+`activeTab` · debounce
120ms, cache mermaid, Myers diff, chunk lazy · math KaTeX · checkpoint `clientIds` +
snapshot · Playwright smoke · 6l: `meta.remoteHash` tách mốc URL khỏi mốc đĩa, Cmd+S xin quyền,
flush khi `pagehide`.

## Món nợ đang mở

- Flake IDB `TransactionInactiveError` ~1/10 lượt `pnpm --filter extension test` (file test
  khác `useFileSave`) → phase con 7s1.
- Tên file hoa-thường lẫn lộn (`Readme.Md`) không khớp pattern của Chrome; trang localhost
  không đuôi `.md` không có widget. Word xuất công thức dạng TeX thô.
- Hai tab cùng mở một URL mới lần đầu có thể cùng import (race hẹp) → phase 8.

## Công cụ cục bộ (không commit)

- `.git/mdr-gate.sh <pkg...>` — test các package + typecheck + build, in tóm tắt.
- `.git/mdr-merge.sh <sub> <branch> "<tóm tắt>"` — đánh dấu plan reviewed, merge --no-ff
  vào `phase-$PHASE` (mặc định 6 → đặt `PHASE=7` cho phase 7), đánh dấu spec done.

## Đã cũ

- Bản handover cũ (2026-09-22) nói "Phase 6 = Chia sẻ" — sai; đánh số mới: 6 Gia cố,
  7 Lề sách, 8 Chia sẻ & cộng tác.
