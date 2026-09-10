# Intent: Phase 1 — Nền tảng & Trình đọc
Author: Hào NQ. Status: designed. Phase: 1
Design: docs/superpowers/specs/2026-09-10-phase-1-design.md

## Problem

Hôm nay không có chỗ nào đọc được file Markdown tử tế. Click một link `.md`
trên web thì Chrome trả ra plain text thô hoặc đẩy thẳng vào cửa sổ download;
mở file `.md` trên máy thì phải kéo vào editor hoặc dán lên một web viewer bên
thứ ba — nghĩa là nội dung tài liệu rời khỏi máy chỉ để được xem cho đúng.
Không có đường nào vừa đọc đẹp, vừa offline, vừa không gửi nội dung đi đâu.

Nỗi đau chính là nỗi đau người dùng ở trên. Việc thiếu nền tảng là hệ quả bắt
buộc của nó, không phải mục tiêu tự thân: repo hiện chưa có `packages/` hay
`apps/` nào, chưa có doc-model, parser hay UI shell, nên export / trình chiếu /
mindmap / chỉnh sửa / cộng tác ở các phase sau không có chỗ đặt chân. Phase 1
vừa trả nợ nỗi đau đọc, vừa dựng đúng lượng nền mà nỗi đau đó đòi hỏi — không
dựng thêm.

## Proposed outcome

Đúng như `docs/DESIGN.md` §4 ghi cho phase 1:

- **Click link `.md` → đọc đẹp ngay trong tab đó.** Content script match URL
  `.md`, render read-only trong Shadow DOM, có nút "Mở trong MD Reader".
- **Kéo file vào app page → đọc được.** Viewer có ToC, theme
  light/dark/system, code highlight.
- **Lần sau mở lại vẫn còn.** `y-indexeddb` giữ Y.Doc, app page có danh sách
  tài liệu gần đây.

Đo được ở `review-before-ship` cuối phase: `pnpm -r test` xanh; bundle content
script ≤ 60KB gz; test hội tụ 2 replica của `core/doc` xanh; format round-trip
ổn định; snapshot render có sẵn.

## Affected packages

Cả bốn — phase 1 là phase dựng nền nên chạm hết:

- **Root workspace** — `pnpm-workspace.yaml`, tsconfig base, vitest config,
  scripts ở `package.json`. Do phase con 1b dựng.
- **`packages/core`** — `parse` + `render` (1c), `doc` (1d), `format` (1e).
  Thuần TS + yjs; không react, không `chrome.*`, không `document`.
- **`packages/ui`** — `ThemeProvider` + token, `Viewer`, `Toc`, code highlight
  (1f). React; không `chrome.*`.
- **`apps/extension`** — manifest MV3, service worker, app page kéo-thả,
  `y-indexeddb`, danh sách gần đây (1g); content script (1h); mermaid lazy
  (1i). Lớp duy nhất được dùng `chrome.*`.

Phase con 1a (spike CSP/mermaid) chạy trên harness vứt đi, không commit code
sản phẩm vào package nào.

## Constraints

Không có ràng buộc bổ sung nào ngoài 8 khoá cứng đã chốt ở `CLAUDE.md` /
`docs/DESIGN.md`. 8 khoá cứng đó vẫn áp dụng đầy đủ cho mọi phase con của
phase này, và vi phạm là blocker cứng ở `review-before-ship` — đặc biệt các
mục liên quan trực tiếp tới phase 1: Y.Doc là nguồn sự thật với
`formatVersion` ngay từ đầu (1), ranh giới package (2), `core` không biết
provider (3), content script không dùng Yjs và ≤ 60KB gz (4), parser là
`unified`/`remark` với debounce 120ms re-parse toàn bộ (5), và không giả định
mermaid chạy được trong content script cho tới khi 1a có kết quả thật (8).

Điều kiện kích cỡ phase con cũng giữ nguyên, `plan-from-design` phải kiểm
trước khi ghi plan: ≤ 5 file bị chạm · ≤ 300 dòng diff dự kiến · ≤ 1 file test
mới.

## Open questions

Bốn câu dưới đây để `design-from-intent` tự chốt, không quay lại hỏi người:

1. **Kết quả spike 1a định hình 1i thế nào?** Nếu CSP chặn mermaid trong
   content script, đường degrade cụ thể là gì (code block thường? placeholder
   kèm nút mở app page?), và nó ảnh hưởng ngân sách 60KB gz ở 1h ra sao.
2. **Code highlight bằng gì?** `shiki` (đẹp, nặng, cần WASM/grammar) hay
   `highlight.js`/`prism` (nhẹ hơn) — và có khác nhau giữa app page và content
   script không, xét ngân sách bundle của 1h.
3. **Nhận diện `.md` ở content script rộng bao nhiêu?** Chỉ đuôi
   `.md`/`.markdown`, hay cả URL không đuôi mà `Content-Type` là
   `text/markdown`.
4. **Xử lý §5.2 (server trả `.md` về dạng download) ở đâu?** Content script,
   service worker, hay chấp nhận là hạn chế đã biết của phase 1.

## Sub-phases

Giữ nguyên `docs/DESIGN.md` §4 như lúc capture, không cắt lại về mặt nội dung.

> **Cập nhật sau design (2026-09-10):** `design-from-intent` giữ nguyên toàn bộ
> nội dung 9 mục dưới nhưng chia sáu trong số đó (1b, 1c, 1d, 1f, 1g, 1h) thành
> đơn vị nhỏ hơn để đạt điều kiện ≤5 file / ≤1 file test mới — thành 18 phase
> con. Bảng có hiệu lực là `Sub-phase queue` trong
> `docs/superpowers/specs/2026-09-10-phase-1-design.md`, và `DESIGN.md` §4 đã
> khớp theo.

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 1a | Spike CSP/mermaid | Có câu trả lời thật, ghi vào §5.1. Harness vứt đi, không commit code sản phẩm |
| 1b | Scaffold monorepo | `pnpm -r test` xanh với 1 test smoke mỗi package; tsconfig base, vitest, 3 package rỗng |
| 1c | `core/parse` + `core/render` | mdast + GFM + frontmatter + sanitize → HTML string, có snapshot test |
| 1d | `core/doc` | Y.Doc schema đầy đủ, import/export text, `originHash`, `formatVersion`, history append, **test hội tụ 2 replica** |
| 1e | `core/format` | Auto-format round-trip ổn định (format 2 lần ra cùng kết quả) |
| 1f | `ui` cơ bản | `ThemeProvider` + token light/dark/system, `Viewer`, `Toc`, code highlight |
| 1g | Extension shell | Manifest MV3, service worker, app page kéo-thả mở file, `y-indexeddb`, danh sách gần đây |
| 1h | Content script | Match `.md`, Shadow DOM, render read-only, nút "Mở trong MD Reader", **đo bundle gz** |
| 1i | Mermaid | Lazy ở app page + đường degrade theo kết quả 1a |
