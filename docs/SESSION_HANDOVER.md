# Session Handover — md-reader

Cập nhật: 2026-09-10 (phiên 2). Branch đang đứng: `phase-1`.

## Đang ở đâu

Phase 1 (Nền tảng & Trình đọc) đang chạy. **Khối scaffold xong hết** — 5/18
phase con merged vào `phase-1`. Chưa mở MR.

| # | Phase con | Trạng thái |
|---|---|---|
| 1a | Spike CSP/mermaid | ✅ done |
| 1b1 | Root workspace & tooling | ✅ done |
| 1b2 | `packages/core` skeleton | ✅ done |
| 1b3 | `packages/ui` skeleton | ✅ done |
| 1b4 | `apps/extension` skeleton | ✅ done |
| 1c1 | `core/parse` | ⬜ **pending — chạy tiếp từ đây** |
| 1c2 → 1i | 12 phase con còn lại | ⬜ pending |

Bảng đầy đủ + interface từng phase con:
`docs/superpowers/specs/2026-09-10-phase-1-design.md` §Sub-phase queue.

## Chạy tiếp thế nào

```
/plan-from-design docs/superpowers/specs/2026-09-10-phase-1-design.md 1c1
```

Nó tự chain plan → build → review → phase con kế tiếp. Không cần chạy lại
`capture-intent` hay `design-from-intent` — hai stage đó chạy một lần mỗi
phase và đã xong.

**Lưu ý về 1c1:** phiên này có mở branch `phase-1-1c1-core-parse` rồi **xoá
lại vì chưa ghi commit nào** — chưa có plan cho 1c1, `plan-from-design` sẽ tạo
branch mới từ đầu. Không có việc dở dang nào phải dọn.

Hướng chia task đã cân cho 1c1 (chưa ghi thành plan, cứ coi là gợi ý):
`parseMarkdown` + frontmatter + error handling một task (3 file, 1 test file),
`sanitizeSchema` một task riêng (3 file, 1 test file) — tách vì mỗi task chỉ
được một file test mới, và schema kiểm được bằng assertion cấu trúc thay vì
phải chạy pipeline render (render là 1c2). Kiểu của schema nên viết
`typeof defaultSchema` từ `rehype-sanitize`, KHÔNG import
`hast-util-sanitize` — nó là transitive dep, không được khai trong
`packages/core/package.json`.

## Trạng thái xanh lúc dừng (đo thật, không phải nhớ)

```
pnpm --filter core test        1 test file, 1 passed
pnpm --filter ui test          1 test file, 2 passed
pnpm --filter extension test   1 test file, 1 passed
pnpm -r typecheck              exit 0
pnpm -r build                  exit 0
dist/content.js                85 B, vỏ IIFE, 0 import, gz 104/61440
```

Toolchain đã pin: `typescript@7.0.2` · `vitest@5.0.0` · `pnpm@10.10.0` ·
`vite@8.2.2` · `react@19.3.0` (một bản duy nhất, dùng chung ui + extension) ·
`yjs@13.6.32` · unified v11 (12 dep, đã xác minh tương thích bằng cách dựng
nguyên pipeline).

**Dependency của cả ba package đã khai trọn từ phase con skeleton.** 1c1 trở
đi KHÔNG được chạm `package.json` nào — nếu thấy thiếu dep thì đó là lỗi plan.

## CodeGraph đã bật (2026-09-10)

`codegraph init -i` đã chạy: **14 file, 32 node, 37 edge**, backend
`node:sqlite` (WAL + FTS5). Xác nhận sống qua MCP bằng `codegraph_status`.

- Chỉ `.codegraph/.gitignore` được commit. `codegraph.db` là index local từng
  máy nên nó tự ignore — mỗi máy tự chạy `codegraph init -i` một lần.
- `.cursor/` (rules codegraph sinh cho Cursor) đã đưa vào `.gitignore`; repo
  này dùng Claude Code, `CLAUDE.md` đã có mục CodeGraph.
- Index sẽ còn rất nhỏ cho tới khi 1c1 trở đi thêm code thật (hiện chỉ có 3
  `constant`: `CORE_VERSION`, `UI_VERSION`, `EXTENSION_VERSION`).

## Ba món nợ đang mở — đọc trước khi làm phase con liên quan

Chi tiết ở spec, mục "Khung build extension — sự thật đã đo ở 1b4":

1. **1g1** — manifest PHẢI khai `"background": { "type": "module" }`. `worker`
   nằm trong build ESM chung với app, nên `worker.js` sẽ có `import` tương
   đối; MV3 service worker chỉ nạp được nếu khai `type: module`.
2. **1g2** — entry HTML sinh `dist/src/app/index.html` giữ path nguồn, không
   phẳng. Phải rewrite hoặc chuyển `index.html` lên gốc `src/`.
3. **1h1 + 1h2** — `apps/extension/src/content/index.ts` là **placeholder**.
   1h1 phải THAY TRỌN thân file. 1h2 phải có cổng grep `mdReaderPlaceholder`
   trong `dist/content.js` và FAIL nếu còn (chuỗi đó sống sót minify — đã
   xác nhận).

Thêm: **1h1 phải xác nhận lại kết luận spike 1a bằng tay trên Chrome branded.**
Bằng chứng hiện có đến từ Chromium unbranded, vì binary branded từ chối
`--load-extension`.

## Hai chỗ tài liệu gốc đã sửa trong phiên này

- **Phase 1 chia lại 9 → 18 phase con.** 1b/1c/1d/1f/1g/1h vượt rõ điều kiện
  ≤5 file / ≤1 test file của §4 (1b một mình ~19 file). `DESIGN.md` §4 và
  `CLAUDE.md` đã khớp; toàn dự án 47 phase con.
- **`DESIGN.md` §8: branch phase con đổi từ `phase-1/1a-…` sang
  `phase-1-1a-…`.** Git không cho ref `phase-1` và `phase-1/x` cùng tồn tại,
  nên sơ đồ cũ không tạo được branch nào.

## Kết luận spike 1a (đã ghi vào DESIGN.md §5.1)

Chọn **nhánh (a)**: style inline trong Shadow DOM, `adoptedStyleSheets`, và
SVG mermaid **không** bị CSP trang chủ chặn ở cả 5 chính sách đã thử, kể cả
`default-src 'none'`. 0 `securitypolicyviolation` trên 6/6 URL.

**Nhưng điều đó KHÔNG đảo quyết định A1/A2 của spec:** content script vẫn
không render mermaid ở phase 1, và lý do là ngân sách 60KB gz — không phải
CSP. Nhánh degrade (b) vẫn phải cài ở 1h1 làm lưới an toàn.
