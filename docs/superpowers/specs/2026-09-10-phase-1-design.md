# Design: Phase 1 — Nền tảng & Trình đọc
Author: haonq. Status: designed. Phase: 1
Intent: docs/superpowers/intent/2026-09-10-phase-1-nen-tang-va-trinh-doc.md

Spec này nằm trong khuôn `docs/DESIGN.md`. Chỗ nào spec này im lặng thì
DESIGN.md quyết định.

---

## Sub-phase queue

Bảng §4 gốc có 9 phase con; sáu trong số đó vượt rõ điều kiện sizing (≤5 file ·
≤300 dòng · ≤1 file test mới) nên **đã chia lại ở đây**, và `DESIGN.md` §4 được
cập nhật khớp. 18 phase con, chạy đúng thứ tự này:

| # | Phase con | Status |
|---|---|---|
| 1a | Spike CSP/mermaid (harness vứt đi) | done |
| 1b1 | Root workspace & tooling | done |
| 1b2 | `packages/core` skeleton | done |
| 1b3 | `packages/ui` skeleton | done |
| 1b4 | `apps/extension` skeleton | done |
| 1c1 | `core/parse` — remark pipeline + frontmatter + sanitize schema | done |
| 1c2 | `core/render` — mdast → HTML string + ToC | done |
| 1d1 | `core/doc` — schema, import/export, `originHash`, `formatVersion` | done |
| 1d2 | `core/doc` — history append + test hội tụ 2 replica | done |
| 1e | `core/format` — round-trip idempotent | done |
| 1f1 | `ui` — `ThemeProvider` + token light/dark/system | done |
| 1f2 | `ui` — `Viewer` + `Toc` + code highlight CSS | done |
| 1g1 | Extension — manifest MV3 + service worker + build đa entry | done |
| 1g2 | Extension — app page shell: Y.Doc + `y-indexeddb` + theme bridge | pending |
| 1g3 | Extension — kéo-thả mở file + registry + danh sách gần đây | pending |
| 1h1 | Content script — detect + Shadow DOM + render read-only + nút mở app | pending |
| 1h2 | Content script — cổng ngân sách 60KB gz | pending |
| 1i | Mermaid — lazy ở app page + đường degrade | pending |

## Approach chosen

**Một lõi render duy nhất, hai vỏ khác nhau.** `core/parse` + `core/render` cho
ra HTML string thuần; app page bọc nó bằng React (`packages/ui`), còn content
script tiêu thụ **cùng hàm đó bằng DOM thuần, không React, không Yjs**. Đây là
điểm quyết định của phase: nó vừa giữ §2.4 (core không biết môi trường), vừa là
cách duy nhất còn hy vọng lọt ngân sách 60KB gz — chỉ riêng React + Yjs đã
~85KB gz.

*Đã loại — `packages/ui` dùng chung cho cả content script.* Đẹp về code reuse,
nhưng kéo React vào mọi trang web người dùng mở và phá thẳng §5.3. Content
script chỉ có ba việc: dựng Shadow DOM, nhét HTML string, gắn một nút.

*Đã loại — content script chỉ là một redirect sang app page.* Rẻ nhất, ngân
sách không thành vấn đề, nhưng phá thẳng outcome của intent ("click link `.md`
→ đọc đẹp **ngay**"). Chuyển tab là đúng thứ người dùng đang tránh.

---

## Giả định đã chốt (từ `Open questions` của intent)

Bốn câu hỏi mở đều được quyết ở đây, không quay lại hỏi người.

### A1 — Kết quả spike 1a **không** định hình được/không của mermaid trong content script; nó chỉ ghi lại sự thật

Quyết: **content script không bao giờ render mermaid trong phase 1, bất kể 1a
ra gì.** Không phải vì CSP mà vì §5.3: mermaid ~500KB gz, ngân sách 60KB. Mọi
code block `mermaid` trong content script thành placeholder + nút "Mở trong MD
Reader" — tức nhánh (b) của §5.1, chọn từ đầu và không phụ thuộc spike.

Giá trị của 1a vẫn còn nguyên và vẫn chạy trước 1b1: nó trả lời **liệu Shadow
DOM có sống được dưới `style-src 'self'` chặt hay không**, và đó là câu hỏi
1h1 phụ thuộc thật. Bảng 5 dòng ghi vào §5.1 gồm cột "Shadow DOM + style inline
hoá render đúng?" bên cạnh cột mermaid. Nếu Shadow DOM cũng bị chặn ở trang
CSP chặt thì 1h1 phải có đường degrade riêng (xem 1h1 · Error handling), và đó
là lý do spike đi trước scaffold.

Ràng buộc 8 được tôn trọng: không stage nào giả định mermaid chạy trong content
script — spec này giả định điều ngược lại.

### A2 — Code highlight: `rehype-highlight` với tập ngôn ngữ hạn chế, trong `core/render`

Quyết: highlight làm ở **`core/render`** bằng `rehype-highlight`
(highlight.js), với một registry ngôn ngữ khai báo tường minh ở
`core/render/languages.ts`, **không** dùng bundle "common" của highlight.js.
Tập phase 1: `ts, tsx, js, jsx, json, bash, css, html, md, yaml, python, go,
sql, diff` (14). CSS token màu do `packages/ui` cấp qua CSS custom properties
(1f2), không import theme CSS của highlight.js.

Vì sao: highlight là biến đổi trên hast, nên nó thuộc core theo §2.5; nó chạy
được trên Node (phase 6 cần render share-link server-side); và app page với
content script dùng **đúng một** đường highlight, không hai.

*Đã loại — `shiki`.* Đẹp hơn rõ rệt nhưng cần WASM + grammar tải rời, không
chia sẻ được với content script dưới 60KB, và thêm một cơ chế tải asset mà MV3
phải khai báo `web_accessible_resources`. Nếu sau này app page muốn shiki thì
đó là một tuỳ chọn của `RenderOptions`, không phải viết lại.

**Cần lever nếu 1h2 báo vượt ngân sách** — theo đúng thứ tự, không đảo:
1. Thu tập ngôn ngữ về 6 (`ts, js, json, bash, md, yaml`).
2. Content script gọi `renderToHtml(..., { highlight: false })` — app page vẫn
   highlight. Code block ra `<pre><code>` trơn, vẫn đọc được.
3. Vẫn vượt → **blocker cho người ở `review-before-ship`.** Không được đổi
   parser (ràng buộc 5), không được bỏ GFM, không được tự nới ngưỡng.

### A3 — Nhận diện `.md`: đúng phạm vi manifest §3, cộng một guard runtime

Quyết: manifest match **chính xác** `*://*/*.md`, `*://*/*.markdown`,
`file:///*` — không hơn. Không `<all_urls>`, nên **không** sniff `Content-Type`
cho URL không đuôi: muốn làm được thế phải xin quyền toàn bộ web, và §3 cấm.

Trong phạm vi đó, content script vẫn cần một guard vì `file:///*` match mọi
file: `shouldActivate(loc, doc)` bật khi (a) `pathname` (đã bỏ query/hash,
so sánh không phân biệt hoa thường) kết thúc `.md` hoặc `.markdown`, **hoặc**
(b) `doc.contentType === 'text/markdown'`. Ngoài ra tắt. Với `file:///`, người
dùng phải tự bật "Allow access to file URLs" — app page empty state nói câu đó.

Hạn chế đã biết, ghi xuống chứ không sửa: URL markdown không đuôi (`raw`
endpoint của một số git host) không được đọc tại chỗ trong phase 1.

### A4 — §5.2 (server trả `.md` dạng download): không xử lý, đúng như §5.2 đã chốt

`Content-Disposition: attachment` thì Chrome tải xuống trước khi content script
kịp chạy; không có API nào sửa được mà không dùng
`declarativeNetRequest` + quyền rộng — cả hai bị §3 cấm. Đường vòng duy nhất
là app page: kéo file vừa tải vào. 1g3 phải nói câu đó **thành chữ trong empty
state của DropZone**, đây là yêu cầu của spec chứ không phải tuỳ ý copywriting.

---

## Nền chung mọi phase con phải tuân

### Tên package & import

| Thư mục | `name` trong package.json | Import từ ngoài |
|---|---|---|
| `packages/core` | `@md-reader/core` | `@md-reader/core` |
| `packages/ui` | `@md-reader/ui` | `@md-reader/ui` |
| `apps/extension` | `@md-reader/extension` (private) | — |

Import chéo package **chỉ** bằng tên workspace (§2.4). Trong cùng package thì
đường dẫn tương đối.

**Đã giải quyết ở 1b2.2 (đo thật):** `pnpm --filter core test` CHẠY ĐƯỢC —
pnpm giải được tên bỏ scope (`core` → `@md-reader/core`). Lệnh trong
`CLAUDE.md` §Stack đúng nguyên trạng, không cần sửa. Root vẫn có
`test:core` / `test:ui` / `test:extension` làm đường thay thế. Không stage nào
cần mở lại câu hỏi này.

### Toolchain đã chốt ở 1b1 (đo thật, không đoán)

- `typescript@7.0.2` · `vitest@5.0.0` · `pnpm@10.10.0` · node v22.23.0.
  TS7 nhận `tsconfig.base.json` không lỗi option nào; `declaration: true` +
  `noEmit: true` **không** xung đột trên TS7 (đã chạy `tsc` xác nhận).
- `tsconfig.base.json` cố ý **không** khai `paths` và `lib` chỉ có `["ES2022"]`
  — không có `DOM`.
- **Ràng buộc bắt buộc chép vào `INVARIANTS` của 1b3 và 1b4:** hai package đó
  phải tự khai `"lib": ["ES2022", "DOM", "DOM.Iterable"]` trong tsconfig của
  mình. `builder` bị cấm đọc DESIGN.md nên nếu plan không chép dòng này, nó sẽ
  không biết và typecheck sẽ vỡ ở file React/`chrome.*` đầu tiên. `packages/core`
  thì KHÔNG được thêm `DOM` — đó là thứ giữ ràng buộc "core không dùng
  document/window" thành lỗi biên dịch chứ không phải lời nhắc.
- `vitest.workspace.ts` là đường deprecated, tồn tại chỉ vì trạng thái
  zero-package. **1b2 phải thử chuyển lại `test.projects` và xoá file đó.**

### Đã xác minh bằng chạy thật ở 1b2 — không stage nào cần kiểm lại

- **12 version unified pin cố định tương thích nhau.** Reviewer dựng nguyên
  pipeline `unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter)
  .use(remarkRehype).use(rehypeSlug).use(rehypeHighlight).use(rehypeSanitize)
  .use(rehypeStringify)`, `tsc --noEmit` 0 lỗi và runtime ra HTML đúng. Cùng
  một thế hệ unified v11. 1c1/1c2 nối pipeline này được ngay.
- **`exports` trỏ thẳng `./src/index.ts` resolve được.** Đã giả lập một package
  consumer: cả `tsc --noEmit` (`moduleResolution: bundler`) và
  `vite build`/esbuild đều resolve `@md-reader/core` đúng. Không cần field
  `types`. 1b3/1b4 sẽ không vỡ vì chuyện này.
- **Hàng rào DOM có hiệu lực thật**: đặt `document.title` vào một file dưới
  `packages/core/src/` → `TS2584 Cannot find name 'document'`. Ràng buộc §2.4
  là lỗi biên dịch, không phải lời nhắc.
- **Mỗi package tự cấp `vitest.config.ts`** nên môi trường không đè nhau:
  core dùng `node`, `packages/ui` (1b3) dùng `jsdom`, không có setting global
  nào để phải ghi đè.

### Ràng buộc React một-bản-duy-nhất (phát sinh từ review 1b3)

`packages/ui` khai `react`/`react-dom` ở `dependencies`, không
`peerDependencies`. Hôm nay đúng — pnpm dedup ra một bản vì version khớp tuyệt
đối — nhưng nó **không tự bảo vệ**. Vì thế:

- **1b4 và 1g2 PHẢI pin `react` và `react-dom` đúng `19.3.0`**, giống hệt
  `packages/ui`. Chép dòng này vào `INVARIANTS` của chúng.
- **1g2 phải có một cổng cơ học**: sau khi build app page, xác nhận chỉ có
  MỘT bản React trong `node_modules` mà extension resolve tới
  (`pnpm why react` hoặc đếm số bản trong bundle). Hai bản React = hook/context
  vỡ lúc runtime, và hôm nay không cổng nào bắt được.
- Nếu về sau `packages/ui` được publish hay bundle độc lập thì mới cần chuyển
  sang `peerDependencies`; trong phase 1-5 nó chỉ dùng nội bộ workspace.

### Khung build extension — sự thật đã đo ở 1b4, và ba món nợ

Build extension là **hai lệnh vite**, không một:
`build` = `pnpm clean && vite build && vite build --config vite.content.config.ts`.

- `vite.config.ts` — app + worker, ESM, có plugin react, `emptyOutDir: false`.
- `vite.content.config.ts` — **chỉ** content, `format: 'iife'`,
  `inlineDynamicImports: true`, KHÔNG plugin react, `emptyOutDir: false`.
- Lý do tách, đã đo thật: một khối `rollupOptions.output` chung khiến Rollup
  tách chunk vendor mà `content.js` phải `import` → `dist/content.js` ra
  `import{t as e}from"./react.js"`. MV3 `content_scripts` **không nạp ES
  module**, nên đó là lỗi runtime, không phải chuyện gọn gàng.
- Trạng thái hiện tại: `dist/content.js` 85 byte, vỏ IIFE, 0 `import`,
  **gz 104/61440**.

**Ba món nợ bắt buộc chép vào `INVARIANTS` của phase con tương ứng:**

1. **1g1** — `worker` vẫn nằm trong build ESM chung với app. Nếu app và worker
   cùng import `@md-reader/core` thì `worker.js` sẽ có
   `import{...}from"./yjs.js"` (đã tái tạo được). MV3 service worker nạp được
   import tương đối **chỉ khi** manifest khai `"background": { "type":
   "module" }`. Quên là lỗi y hệt content script.
2. **1g2** — entry HTML `app` sinh `dist/src/app/index.html`, giữ nguyên path
   nguồn, không phẳng như hai JS entry. Phải rewrite hoặc chuyển
   `index.html` lên gốc `src/`.
3. **1h1 + 1h2** — `src/content/index.ts` hiện là placeholder ghi
   `document.documentElement.dataset.mdReaderPlaceholder`. **1h1 phải THAY
   TRỌN thân file**, không thêm code bên cạnh. **1h2 phải có cổng grep
   `mdReaderPlaceholder` trong `dist/content.js` và FAIL nếu còn** — chuỗi đó
   đã được xác nhận sống sót minify. Ngoài ra `pnpm dev` không watch content;
   phải chạy `dev:content` song song.

### Dependency được phép trong phase 1

Không dep nào ngoài danh sách này mà không ghi lý do trong plan.

- **core**: `yjs`, `unified`, `remark-parse`, `remark-gfm`,
  `remark-frontmatter`, `remark-stringify`, `remark-rehype`, `rehype-slug`,
  `rehype-highlight`, `rehype-sanitize`, `rehype-stringify`, `yaml`;
  dev: `@types/mdast`, `@types/hast`, `vitest`, `typescript`.
- **ui**: `react`, `react-dom`, `@md-reader/core`; dev:
  `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `vitest`,
  `@types/react`, `@types/react-dom`.
- **extension**: `yjs`, `y-indexeddb`, `react`, `react-dom`,
  `@md-reader/core`, `@md-reader/ui`; dev: `vite`, `@vitejs/plugin-react`,
  `vitest`.
- **mermaid** chỉ vào `packages/ui` ở 1i, và chỉ qua `import()` động.

### Ranh giới, nhắc lại thành thứ kiểm được

- `packages/core`: không `react`, không `chrome.*`, không `document`/`window`.
  Hash dùng `globalThis.crypto.subtle` (có trên cả Node 18+ và browser) —
  không `require('crypto')`, không polyfill.
- `packages/ui`: không `chrome.*`. Nhận `Y.Doc` qua context, nhận dữ liệu qua
  props. Không component nào tự đọc file hay biết provider.
- `apps/extension`: lớp duy nhất gọi `chrome.*`, lớp duy nhất `import`
  `y-indexeddb`.
- `apps/extension/src/content/**`: **không** `yjs`, **không** `y-indexeddb`,
  **không** `react`, **không** `@md-reader/ui`.

---

## 1a — Spike CSP/mermaid

**Builds.** Một MV3 tối giản viết tay ở `spike/csp-mermaid/`, **ngoài
workspace**: `manifest.json` + `content.js` (~30 dòng, không build, không TS,
không test) + `NOTES.md`. Mermaid nạp từ file local trong thư mục spike, không
CDN.

**Consumes.** Không gì. Phase con này chạy trước cả scaffold.

**Interfaces produced.** Không code. Đầu ra là **văn bản**: bảng 5 dòng ghi
thẳng vào `docs/DESIGN.md` §5.1, cột:

```
| Trang | CSP quan sát được | Shadow DOM + style inline render đúng? | mermaid render đúng? | Ghi chú |
```

Bắt buộc trong 5 trang: một trang `style-src 'self'` chặt, một trang
`file:///`, một trang không có CSP. Kèm **một câu kết luận** chọn nhánh (a) hay
(b) của §5.1 cho *Shadow DOM* — nhánh cho mermaid đã chốt là (b) theo A1.

**Error handling.** Không đo được CSP của một trang → ghi "không xác định" vào
bảng, không đoán. Ba dòng "không xác định" trở lên = spike thất bại, báo cho
người, không tự đi tiếp.

**Tests must prove.** Không có test. Bằng chứng là bảng có số liệu quan sát
thật, mỗi dòng kèm URL.

**Package.** Không package nào. `spike/` được thêm vào `.gitignore` ở 1b1 và
thư mục bị xoá ở 1b1 — không commit code sản phẩm từ đây.

**Sizing.** 3 file, ~60 dòng, 0 test. ✓

---

## 1b1 — Root workspace & tooling

**Builds.** `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`,
`vitest.workspace.ts`, `.gitignore`.

**Consumes.** Kết luận của 1a (chỉ để xoá `spike/`).

**Interfaces produced.**

- `pnpm-workspace.yaml`: `packages: ['packages/*', 'apps/*']`.
- `tsconfig.base.json`: `target ES2022`, `module ESNext`,
  `moduleResolution bundler`, `strict true`,
  `noUncheckedIndexedAccess true`, `verbatimModuleSyntax true`,
  `declaration true`, `skipLibCheck true`. Không `paths` mapping — resolution
  đi qua workspace link, đó là điều giữ §2.4 kiểm được.
- Root `package.json`: `private: true`, `packageManager` giữ nguyên
  `pnpm@10.10.0` (đã pin ở commit d741d1b), scripts `test` (`vitest run`),
  `typecheck` (`tsc -b`), và bộ `test:core` / `test:ui` / `test:extension` nếu
  A-note ở §"Tên package" yêu cầu.
- `vitest.workspace.ts`: liệt kê `packages/*` + `apps/*`.

**Error handling.** Không có runtime.

**Tests must prove.** `pnpm -r test` chạy được và **không fail** khi chưa có
package nào (vitest với 0 project là pass, không phải error — nếu nó error thì
1b1 phải cấu hình `passWithNoTests`).

**Package.** Root. Không code sản phẩm.

**Sizing.** 5 file, ~80 dòng, 0 test file mới. ✓

---

## 1b2 — `packages/core` skeleton

**Builds.** `packages/core/package.json`, `tsconfig.json`, `src/index.ts`,
`src/smoke.test.ts`.

**Consumes.** `tsconfig.base.json` (1b1).

**Interfaces produced.**

```ts
// packages/core/src/index.ts
export const CORE_VERSION = '0.1.0'
```

`package.json`: `name: '@md-reader/core'`, `type: 'module'`,
`main`/`exports` trỏ `./src/index.ts` (workspace consume TS trực tiếp qua
Vite; không build step cho package trong phase 1), `scripts.test: 'vitest run'`.
Khai `dependencies` toàn bộ dep core ở §"Dependency được phép" **ngay tại đây**
để các phase con sau không phải sửa `package.json` (giữ chúng trong 5 file).

**Error handling.** Không có runtime.

**Tests must prove.** `CORE_VERSION` export được — 1 test smoke, chạy môi
trường `node` (§6).

**Package.** `packages/core`. Không react/chrome/document nào xuất hiện.

**Sizing.** 4 file, ~40 dòng, 1 test file. ✓

---

## 1b3 — `packages/ui` skeleton

**Builds.** `packages/ui/package.json`, `tsconfig.json`, `vitest.config.ts`,
`src/index.ts`, `src/smoke.test.tsx`.

**Consumes.** `@md-reader/core` (1b2) — smoke test import `CORE_VERSION` để
chứng minh workspace link chạy.

**Interfaces produced.**

```ts
// packages/ui/src/index.ts
export const UI_VERSION = '0.1.0'
```

`vitest.config.ts`: `environment: 'jsdom'`, plugin react, setup file cho
`@testing-library/jest-dom`. `package.json` khai đủ dep ui.

**Error handling.** Không có runtime.

**Tests must prove.** Render một `<div>` bằng testing-library trong jsdom pass,
và `CORE_VERSION` import qua tên workspace được (không đường dẫn tương đối).

**Package.** `packages/ui`.

**Sizing.** 5 file, ~60 dòng, 1 test file. ✓

---

## 1b4 — `apps/extension` skeleton

**Builds.** `apps/extension/package.json`, `tsconfig.json`, `vite.config.ts`,
`src/shared/version.ts`, `src/shared/version.test.ts`.

**Consumes.** `@md-reader/core` (1b2), `@md-reader/ui` (1b3).

**Interfaces produced.**

```ts
// apps/extension/src/shared/version.ts
export const EXTENSION_VERSION = '0.1.0'
```

`vite.config.ts` dựng khung build **đa entry** mà 1g1/1h1 sẽ điền:
`build.rollupOptions.input = { app: 'src/app/index.html', worker:
'src/worker/index.ts', content: 'src/content/index.ts' }`,
`build.target: 'chrome120'`, `build.modulePreload: false`,
`build.rollupOptions.output.format: 'es'`. Entry nào chưa có file thì 1b4 để
comment sẵn, không khai — build phải xanh ở 1b4.

*Đã loại — `@crxjs/vite-plugin`.* Nó tự sinh manifest và tự inject content
script; tiện, nhưng che mất đúng thứ phase 1 cần kiểm bằng mắt (manifest tối
thiểu, ranh giới entry, kích thước bundle content script), và MV3 support của
nó từng vỡ theo bản Chrome. Manifest viết tay + copy là 10 dòng config.

**Error handling.** Không có runtime.

**Tests must prove.** 1 test smoke thuần TS (§6: extension chỉ test logic
thuần), và `pnpm --filter @md-reader/extension build` chạy xanh.

**Package.** `apps/extension`. Chưa gọi `chrome.*` ở phase con này.

**Sizing.** 5 file, ~70 dòng, 1 test file. ✓

---

## 1c1 — `core/parse`

**Builds.** `packages/core/src/parse/index.ts`,
`src/parse/sanitize-schema.ts`, `src/parse/parse.test.ts`, cập nhật
`src/index.ts`.

**Consumes.** Dep đã khai ở 1b2.

**Interfaces produced.** Các phase con sau tiêu thụ **nguyên văn** những chữ ký
này.

```ts
// @md-reader/core
import type { Root } from 'mdast'
import type { Schema } from 'hast-util-sanitize'

export interface ParseOptions {
  /** GFM: table, task list, strikethrough, autolink. Default: true */
  gfm?: boolean
}

export interface ParseResult {
  /** mdast, frontmatter đã bị tách ra khỏi cây */
  tree: Root
  /** YAML frontmatter đã parse. {} khi không có. */
  frontmatter: Record<string, unknown>
  /** source gốc, giữ nguyên từng ký tự */
  raw: string
}

export function parseMarkdown(source: string, options?: ParseOptions): ParseResult

/** Schema của rehype-sanitize, nới cho <svg> (mermaid/mindmap) và class hljs-*. */
export const sanitizeSchema: Schema
```

Pipeline: `unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter,
['yaml'])`. Frontmatter đọc bằng node `yaml` đầu cây, parse bằng `yaml`, rồi
**loại khỏi `tree`** — §2.5: frontmatter vào `meta`, không render.

`sanitizeSchema` = `defaultSchema` mở rộng: thêm tag `svg, g, path, rect,
circle, ellipse, line, polyline, polygon, text, tspan, defs, marker,
foreignObject`; thêm attribute `className` cho `code`/`span` với giá trị bắt
đầu `hljs-`/`language-`; thêm `id` cho heading (1c2 cần `rehype-slug`).
**Raw HTML mặc định tắt** — `parseMarkdown` không bật `allowDangerousHtml`;
toggle "tin tài liệu này" của §2.5 là tuỳ chọn của `renderToHtml` (1c2), lưu
theo doc ở phase sau.

**Error handling.** Frontmatter YAML sai cú pháp → **không throw**: trả
`frontmatter: {}` và ghi cảnh báo vào `frontmatter.__parseError` (string).
Người dùng mở một file lỗi frontmatter vẫn phải đọc được phần còn lại. Source
rỗng → `tree` là `Root` với `children: []`, không lỗi.

**Tests must prove.** Một file test duy nhất, snapshot + assertion:
GFM table/task-list/strikethrough vào đúng node type; frontmatter được tách ra
và không còn trong `tree`; frontmatter lỗi trả `{}` + `__parseError`; source
rỗng không throw; `raw` bằng đúng input.

**Package.** `packages/core` — thuần TS trên mdast, không DOM. §2.4 ✓

**Sizing.** 4 file, ~200 dòng, 1 test file. ✓

---

## 1c2 — `core/render` + ToC

**Builds.** `packages/core/src/render/index.ts`, `src/render/languages.ts`,
`src/render/render.test.ts`, cập nhật `src/index.ts`.

**Consumes.** `parseMarkdown`, `sanitizeSchema`, `ParseResult` (1c1).

**Interfaces produced.**

```ts
// @md-reader/core
export interface TocEntry {
  /** id do rehype-slug sinh; khớp id trong html */
  id: string
  depth: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  children: TocEntry[]
}

export interface RenderOptions {
  /** Default: true. Content script có thể tắt để giữ ngân sách (A2 lever 2). */
  highlight?: boolean
  /** Default: false. Toggle "tin tài liệu này" của §2.5. */
  allowRawHtml?: boolean
}

export interface RenderResult {
  html: string
  toc: TocEntry[]
}

export function renderToHtml(parsed: ParseResult, options?: RenderOptions): RenderResult

/** Cây ToC từ mdast heading. Lồng theo depth, bỏ qua bậc nhảy cách. */
export function extractToc(tree: Root): TocEntry[]
```

Pipeline: `mdast → remarkRehype → rehypeSlug → [rehypeHighlight] →
rehypeSanitize(sanitizeSchema) → rehypeStringify`. **`rehypeSanitize` luôn
chạy sau cùng trước stringify**, kể cả khi `allowRawHtml: true` (lúc đó schema
nới thêm, không bỏ hẳn) — đây là điều kiện, không phải mặc định.

`languages.ts` export `const HIGHLIGHT_LANGUAGES` — 14 ngôn ngữ ở A2, đăng ký
tường minh. Ngôn ngữ không có trong registry → code block ra `<pre><code>` trơn,
không throw.

`extractToc` phải sinh id **giống hệt** `rehype-slug` (dùng
`github-slugger`, đúng thứ rehype-slug dùng) để `Toc` click nhảy đúng anchor.
Heading nhảy bậc (h1 → h3) thì h3 thành con trực tiếp của h1, không sinh node
giả.

**Error handling.** `renderToHtml` không throw với bất kỳ mdast hợp lệ nào.
Code block có `lang` lạ, ảnh thiếu alt, link `javascript:` (bị sanitize bỏ) —
tất cả degrade im lặng. Sanitize xoá gì thì xoá, không báo lỗi lên UI ở phase 1.

**Tests must prove.** Một file test: snapshot HTML cho một fixture markdown đủ
món (heading, table, task list, code có/không lang, ảnh, link, inline HTML);
`allowRawHtml: false` xoá `<script>` và `on*` attribute; `highlight: false`
cho `<pre><code>` không class `hljs`; `extractToc` ra cây đúng với heading nhảy
bậc; id trong `toc` xuất hiện đúng trong `html`.

**Package.** `packages/core`. Ra `string`, không chạm DOM — nên chạy được trên
Node cho phase 6. §2.4 ✓

**Sizing.** 4 file, ~220 dòng, 1 test file. ✓

---

## 1d1 — `core/doc`: schema, import/export, hash

**Builds.** `packages/core/src/doc/schema.ts`, `src/doc/doc.ts`,
`src/doc/hash.ts`, `src/doc/doc.test.ts`, cập nhật `src/index.ts`.

**Consumes.** `yjs` (1b2). Không consume parse/render — doc-model độc lập với
parser.

**Interfaces produced.** Schema phải đúng ngay (§5.4); mọi thay đổi sau này
bắt buộc migration + fixture cũ.

```ts
// @md-reader/core
import * as Y from 'yjs'

export const FORMAT_VERSION = 1

export interface DocMeta {
  title: string
  formatVersion: number
  originPath: string | null
  /** SHA-256 hex của nội dung file lúc import. null khi doc chưa từng từ file. */
  originHash: string | null
  createdAt: number
  /** clientID → tên tự khai. Rỗng ở phase 1; §2.3 cần chỗ bám. */
  actors: Record<string, string>
}

export interface HistoryEntry {
  id: string
  actor: string
  ts: number
  label: string
  clientIds: number[]
}

/** Tên key cố định. Không stage nào được đổi. */
export const DOC_KEYS = {
  source: 'source',
  meta: 'meta',
  history: 'history',
} as const

export function createDoc(init?: {
  title?: string
  source?: string
  originPath?: string | null
  originHash?: string | null
}): Y.Doc

export function getSource(doc: Y.Doc): Y.Text
export function getMeta(doc: Y.Doc): Y.Map<unknown>
export function getHistory(doc: Y.Doc): Y.Array<HistoryEntry>

/** Đọc meta ra object thường, điền default cho field thiếu. */
export function readMeta(doc: Y.Doc): DocMeta

/** Thay toàn bộ Y.Text bằng text, trong MỘT transaction. Set originPath/originHash. */
export function importText(
  doc: Y.Doc,
  text: string,
  opts: { originPath?: string | null; originHash: string },
): void

export function exportText(doc: Y.Doc): string

/** SHA-256 hex qua globalThis.crypto.subtle. Chạy cả Node 18+ và browser. */
export function hashText(text: string): Promise<string>

/**
 * Hook migration của §5.4. v1 là no-op; nó tồn tại để phase sau có chỗ bám và
 * để test fixture cũ có hàm gọi.
 */
export function migrateDoc(doc: Y.Doc): { from: number; to: number }
```

`importText` khi doc đã có nội dung: `delete(0, len)` rồi `insert(0, text)`
trong cùng transaction — **không** diff, không merge (§2.1: không bao giờ tự
merge im lặng).

**Error handling.** `readMeta` trên doc thiếu key → trả default, không throw
(doc cũ / doc lạ vẫn mở được). `migrateDoc` gặp `formatVersion` **lớn hơn**
`FORMAT_VERSION` → throw `UnsupportedFormatVersionError` (doc từ bản
extension mới hơn; mở là hỏng dữ liệu). `hashText` là async — không có đường
sync, gọi nơi nào phải await.

**Tests must prove.** Một file test: `createDoc` sinh đúng ba key và
`formatVersion === 1`; `importText` → `exportText` round-trip đúng từng ký tự
kể cả unicode + newline cuối file; `importText` lần hai thay sạch nội dung cũ;
`readMeta` trên `new Y.Doc()` trơn trả default; `hashText` khớp một hằng
SHA-256 biết trước; `migrateDoc` với `formatVersion: 2` throw.

**Package.** `packages/core` — `yjs` được phép (§2.4), `crypto.subtle` không
phải `document`/`window`. Core **không** biết provider (§2.2): nó chỉ nhận
`Y.Doc`, không bao giờ tự tạo persistence.

**Sizing.** 5 file, ~230 dòng, 1 test file. ✓

---

## 1d2 — `core/doc`: history + hội tụ hai replica

**Builds.** `packages/core/src/doc/history.ts`,
`src/doc/converge.test.ts`, cập nhật `src/index.ts`.

**Consumes.** 1d1 trọn bộ.

**Interfaces produced.**

```ts
// @md-reader/core
export function appendHistory(
  doc: Y.Doc,
  entry: Omit<HistoryEntry, 'id' | 'ts'> & { ts?: number },
): HistoryEntry

export function listHistory(doc: Y.Doc): HistoryEntry[]

/** clientID của mọi struct đang sống trong Y.Text "source". Nền cho blame phase 6. */
export function sourceClientIds(doc: Y.Doc): number[]
```

`id` sinh bằng `crypto.randomUUID()`. `Y.Array "history"` là **append-only** —
không có hàm xoá/sửa entry ở API công khai, và đó là chủ ý.

**Error handling.** `appendHistory` với `actor` rỗng → throw
`TypeError('history entry requires an actor')`. Ghi rác vào lịch sử append-only
là thứ không xoá lại được, nên đây là chỗ đúng để nghiêm.

**Tests must prove.** Đây là test hội tụ mà §6 bắt buộc cho mọi tính năng của
`core/doc`. Một file test, ba ca:
1. Hai `Y.Doc` cùng `importText` một base, mỗi bên `insert` ở vị trí khác nhau
   trong `source`, đồng bộ hai chiều bằng `Y.applyUpdate` → `exportText()` hai
   bên **bằng nhau**.
2. Hai replica mỗi bên `appendHistory` một entry, đồng bộ → cả hai thấy **đủ
   2 entry**, không mất, không trùng id.
3. Sau ca 1, `sourceClientIds` ở cả hai replica trả cùng tập (đã sort).

**Package.** `packages/core`.

**Sizing.** 3 file, ~150 dòng, 1 test file. ✓

---

## 1e — `core/format`

**Builds.** `packages/core/src/format/index.ts`, `src/format/format.test.ts`,
cập nhật `src/index.ts`.

**Consumes.** `parseMarkdown` (1c1) cho GFM/frontmatter setting.

**Interfaces produced.**

```ts
// @md-reader/core
export interface FormatOptions {
  bullet?: '-' | '*' | '+'
  emphasis?: '_' | '*'
  strong?: '_' | '*'
  /** true = ``` fence; false = indent 4 space. Default: true */
  fences?: boolean
  listIndent?: 'one' | 'tab' | 'mixed'
  /** Ngắt dòng mềm. 0 = không ngắt. Default: 0 */
  printWidth?: number
}

export const defaultFormatOptions: Required<FormatOptions>

/** remark-parse → remark-stringify. Giữ frontmatter nguyên văn ở đầu output. */
export function formatMarkdown(source: string, options?: FormatOptions): string
```

Default chốt ở đây, không để mở: `bullet: '-'`, `emphasis: '_'`,
`strong: '*'`, `fences: true`, `listIndent: 'one'`, `printWidth: 0`.
`printWidth: 0` là mặc định vì reflow đoạn văn tạo diff khổng lồ trên file
người khác viết — phase 5 nối format vào luồng save (5e), và một cái save
không được đổi 400 dòng không liên quan.

**Error handling.** `formatMarkdown` không throw. Không parse được (không xảy
ra với remark, nhưng vẫn) → trả `source` nguyên văn. Format **không bao giờ
được làm mất nội dung**: nếu output rỗng mà input không rỗng thì trả `source`.

**Tests must prove.** Một file test:
1. **Idempotence** — `format(format(x)) === format(x)` trên ≥6 fixture (list
   lồng, table, code fence trong list, frontmatter, task list, reference link).
2. **Không mất nội dung** — `parseMarkdown(format(x)).tree` và
   `parseMarkdown(x).tree` có cùng chuỗi text node (so sánh sau khi rút text).
3. Frontmatter còn nguyên ở đầu output, không bị reformat YAML.
4. Default option áp đúng: bullet `-`, strong `**`, emphasis `_`.

**Package.** `packages/core`.

**Sizing.** 3 file, ~140 dòng, 1 test file. ✓

---

## 1f1 — `ui`: ThemeProvider + token

**Builds.** `packages/ui/src/theme/ThemeProvider.tsx`,
`src/theme/tokens.css`, `src/theme/ThemeProvider.test.tsx`, cập nhật
`src/index.ts`.

**Consumes.** 1b3.

**Interfaces produced.**

```ts
// @md-reader/ui
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeContextValue {
  mode: ThemeMode
  /** 'system' đã giải ra theo prefers-color-scheme */
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

export interface ThemeProviderProps {
  mode: ThemeMode
  /** Lớp trên (apps/extension) lưu vào chrome.storage.sync. ui KHÔNG biết chrome. */
  onModeChange?: (mode: ThemeMode) => void
  children: React.ReactNode
}

export function ThemeProvider(props: ThemeProviderProps): JSX.Element
export function useTheme(): ThemeContextValue
```

`mode` là **controlled prop**, không state nội bộ — §2.6: `apps/extension` là
lớp bơm giá trị vào, `ui` chỉ đọc và gọi `onModeChange`. `ThemeProvider` đặt
`data-theme={resolved}` trên phần tử bọc của nó (không trên `document.
documentElement` — component không được chạm root, Shadow DOM ở 1h1 cần thế).

`tokens.css`: CSS custom properties trên `[data-theme='light']` và
`[data-theme='dark']` — `--md-bg`, `--md-fg`, `--md-fg-muted`, `--md-border`,
`--md-link`, `--md-code-bg`, `--md-code-fg`, `--md-selection`, cộng bộ
`--md-hljs-*` (keyword, string, comment, number, function, tag, attr) mà A2
cần. Đây là nguồn duy nhất của màu; không component nào hardcode màu.

**Error handling.** `useTheme` gọi ngoài provider → throw
`Error('useTheme must be used within ThemeProvider')`. `mode: 'system'` khi
`window.matchMedia` không tồn tại → `resolved: 'light'`.

**Tests must prove.** Một file test: `mode='dark'` → `data-theme='dark'`;
`mode='system'` với `matchMedia` mock `prefers-color-scheme: dark` →
`resolved: 'dark'`, và đổi mock rồi phát event → `resolved` cập nhật;
`setMode` gọi `onModeChange` và **không** tự đổi `mode` (controlled);
`useTheme` ngoài provider throw.

**Package.** `packages/ui`. Không `chrome.*` — cửa duy nhất ra ngoài là
`onModeChange`. §2.4 ✓

**Sizing.** 4 file, ~180 dòng, 1 test file. ✓

---

## 1f2 — `ui`: Viewer + Toc + CSS highlight

**Builds.** `packages/ui/src/Viewer.tsx`, `src/Toc.tsx`,
`src/viewer.css`, `src/Viewer.test.tsx`, cập nhật `src/index.ts`.

**Consumes.** `TocEntry` (1c2), `ThemeProvider` token (1f1).

**Interfaces produced.**

```ts
// @md-reader/ui
import type { TocEntry } from '@md-reader/core'

export interface ViewerProps {
  /** HTML đã sanitize từ core/render. Viewer KHÔNG tự sanitize lại. */
  html: string
  className?: string
  /** Gọi khi heading đang đọc đổi, để Toc highlight. */
  onActiveHeadingChange?: (id: string | null) => void
}

export function Viewer(props: ViewerProps): JSX.Element

export interface TocProps {
  entries: TocEntry[]
  activeId?: string | null
  onSelect?: (id: string) => void
}

export function Toc(props: TocProps): JSX.Element
```

`Viewer` dùng `dangerouslySetInnerHTML`. Điều này an toàn **chỉ vì**
`core/render` đã sanitize bằng `sanitizeSchema`, và đó là hợp đồng: Viewer
nhận HTML đã sạch, không nhận markdown, không tự parse. Ghi thành comment
ngay trên chỗ gọi.

`onActiveHeadingChange` dùng `IntersectionObserver` trên các heading có `id`.
`Toc` render `<nav>` lồng theo `entries`, `onSelect` nhận id (điều hướng là
việc của lớp trên, `Toc` không tự `scrollIntoView`).

`viewer.css`: typography + spacing cho HTML của `core/render`, ăn màu từ
token 1f1, gồm cả rule `.hljs-*` map sang `--md-hljs-*`. Không import CSS của
highlight.js.

**Error handling.** `html: ''` → khung rỗng, không lỗi. `entries: []` → `Toc`
trả `null` (không render `<nav>` trống). `IntersectionObserver` không tồn tại
(jsdom) → bỏ qua theo dõi, không throw.

**Tests must prove.** Một file test: `Viewer` render đúng HTML truyền vào và
class trên `<code>` còn nguyên; `Toc` render cây lồng đúng bậc; click item gọi
`onSelect` với id đúng; `activeId` gắn `aria-current`; `entries: []` không
render `<nav>`; `Viewer` không throw khi `IntersectionObserver` undefined.

**Package.** `packages/ui`.

**Sizing.** 5 file, ~250 dòng, 1 test file. ✓

---

## 1g1 — Extension: manifest + service worker + build đa entry

**Builds.** `apps/extension/manifest.json`, `src/worker/index.ts`,
`src/worker/routing.ts`, `src/worker/routing.test.ts`, cập nhật
`vite.config.ts`.

**Consumes.** 1b4.

**Interfaces produced.**

```jsonc
// manifest.json — quyền tối thiểu đúng §3, không hơn
{
  "manifest_version": 3,
  "name": "MD Reader",
  "version": "0.1.0",
  "permissions": ["storage"],
  "background": { "service_worker": "worker.js", "type": "module" },
  "action": { "default_title": "MD Reader" },
  "content_scripts": [{
    "matches": ["*://*/*.md", "*://*/*.markdown", "file:///*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

Không `<all_urls>`, không `declarativeNetRequest`, không `tabs`. Mở app page
bằng `chrome.runtime.getURL` + `chrome.tabs.create` — `tabs` **không** cần
permission cho `create`.

```ts
// apps/extension/src/worker/routing.ts — logic thuần, test được
export interface OpenAppRequest { type: 'open-app'; source?: string; name?: string }
export type WorkerMessage = OpenAppRequest

export function appPageUrl(base: string, params?: { docId?: string }): string
export function isOpenAppRequest(value: unknown): value is OpenAppRequest

// src/worker/index.ts — lớp chrome.*, mỏng, không logic
```

`chrome.storage.sync` cho theme (§2.6) được đọc/ghi ở worker qua hai hàm mỏng
`getThemeMode()` / `setThemeMode(mode)`; 1g2 gọi chúng qua message.

**Error handling.** Message không đúng dạng → worker bỏ qua và log warn, không
throw (throw trong service worker giết worker). `chrome.storage` lỗi → dùng
`'system'` làm mặc định.

**Tests must prove.** Một file test, chỉ logic thuần (§6 — không mock sâu
`chrome.*`): `appPageUrl` sinh URL đúng có/không `docId`; `isOpenAppRequest`
loại `null`, string, object thiếu `type`, và nhận đúng dạng hợp lệ.

**Package.** `apps/extension` — lớp duy nhất được `chrome.*`. §2.4 ✓

**Sizing.** 5 file, ~180 dòng, 1 test file. ✓

---

## 1g2 — Extension: app page shell (Y.Doc + y-indexeddb + theme bridge)

**Builds.** `apps/extension/src/app/index.html`, `src/app/main.tsx`,
`src/app/doc-store.ts`, `src/app/doc-store.test.ts`, `src/app/theme-bridge.ts`.

**Consumes.** `createDoc`/`getSource`/`readMeta` (1d1), `parseMarkdown` +
`renderToHtml` (1c1/1c2), `ThemeProvider` (1f1), `Viewer`/`Toc` (1f2),
`appPageUrl` (1g1).

**Interfaces produced.**

```ts
// apps/extension/src/app/doc-store.ts
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

export interface OpenedDoc {
  docId: string
  doc: Y.Doc
  persistence: IndexeddbPersistence
}

/** Chọn & gắn provider — §2.2: việc này của apps/extension, KHÔNG của core. */
export function bindPersistence(docId: string, doc: Y.Doc): IndexeddbPersistence

/** Mở doc đã có trong IndexedDB. Chờ 'synced' trước khi trả. */
export function openExistingDoc(docId: string): Promise<OpenedDoc>

/** docId ổn định theo nội dung: 'doc-' + originHash. Cùng file mở lại = cùng doc. */
export function docIdFromHash(hash: string): string
```

`main.tsx` là React root: `ThemeProvider` (mode lấy từ `theme-bridge`) bọc
layout `Toc` + `Viewer`. Vòng dữ liệu: `getSource(doc).observe` → debounce
**120ms** (§2.5) → `parseMarkdown` → `renderToHtml` → `setState({html, toc})`.
Debounce là điều kiện, không phải tinh chỉnh.

`theme-bridge.ts` là **lớp duy nhất** của app page nói chuyện
`chrome.storage.sync`: `readThemeMode(): Promise<ThemeMode>` và
`writeThemeMode(mode): Promise<void>`. `ThemeProvider` nhận `mode` + gọi
`onModeChange` → `writeThemeMode`.

**Error handling.** `openExistingDoc` với `docId` không tồn tại → trả doc rỗng
(IndexedDB tạo store mới), **không** throw; UI hiện empty state.
`IndexeddbPersistence` fail (private mode, quota) → app page vẫn chạy in-memory
và hiện banner "sẽ không lưu được", không trang trắng. `readThemeMode` lỗi →
`'system'`.

**Tests must prove.** Một file test, logic thuần: `docIdFromHash` ổn định và
khác nhau cho hash khác nhau; debounce 120ms gộp nhiều thay đổi `Y.Text` liên
tiếp thành **một** lần render (dùng fake timer, hàm render inject vào để
test được — không test qua DOM thật). Không mock `chrome.*` sâu, không test
`IndexeddbPersistence` (§6).

**Package.** `apps/extension`. `packages/core` vẫn không biết provider nào
đang chạy — nó chỉ nhận `Y.Doc`. §2.2 ✓

**Sizing.** 5 file, ~260 dòng, 1 test file. ✓

---

## 1g3 — Extension: kéo-thả mở file + registry + danh sách gần đây

**Builds.** `apps/extension/src/app/registry.ts`,
`src/app/registry.test.ts`, `src/app/DropZone.tsx`, `src/app/RecentList.tsx`,
cập nhật `src/app/main.tsx`.

**Consumes.** 1g2 trọn bộ, `hashText` + `importText` + `createDoc` (1d1).

**Interfaces produced.**

```ts
// apps/extension/src/app/registry.ts — registry của §2.2
export interface DocRecord {
  docId: string
  name: string
  originPath: string | null
  /** FileSystemFileHandle để dành cho phase 5. Phase 1 luôn ghi null. */
  fileHandle: null
  lastOpenedAt: number
}

export function putRecord(rec: DocRecord): Promise<void>
export function listRecent(limit?: number): Promise<DocRecord[]>   // desc theo lastOpenedAt, default 20
export function removeRecord(docId: string): Promise<void>

// src/app/open-file.ts nằm trong registry.ts để giữ 5 file:
export function openDocFromFile(file: File): Promise<OpenedDoc>
```

`openDocFromFile`: đọc text → `hashText` → `docIdFromHash` →
`bindPersistence` → chờ `synced` → nếu doc rỗng thì `importText(doc, text,
{ originPath: file.name, originHash: hash })`; nếu doc **đã có** nội dung thì
**không** ghi đè, mở nội dung đã lưu (§2.1: không tự merge im lặng từ đĩa) →
`putRecord`.

`DropZone` nhận drop + `<input type=file>` (drop-only là bẫy accessibility).
Empty state của nó phải có câu về §5.2 theo A4: *"Trang trả file `.md` về dạng
tải xuống thì extension không đọc tại chỗ được — kéo file vừa tải vào đây."*

`RecentList` render `listRecent()`, click → `openExistingDoc`, có nút xoá khỏi
danh sách (`removeRecord`, không xoá Y.Doc).

**Error handling.** Drop nhiều file → mở file đầu, thông báo đã bỏ qua phần
còn lại. Drop file không phải `.md`/`.markdown` → từ chối kèm lý do, không mở.
File > 5MB → mở nhưng cảnh báo (§2.5 chưa tối ưu cho file lớn, YAGNI tới phase
5). `file.text()` fail → thông báo lỗi đọc file, giữ nguyên trang.
Bản ghi registry trỏ tới doc đã bị xoá → `listRecent` vẫn trả, click ra empty
doc + nút xoá khỏi danh sách.

**Tests must prove.** Một file test, logic thuần: `putRecord` +
`listRecent` sắp `lastOpenedAt` giảm dần và tôn trọng `limit`; `removeRecord`
xoá đúng bản ghi; `openDocFromFile` với doc đã có nội dung **không** gọi
`importText` (spy); tên file không phải markdown bị từ chối. IndexedDB dùng
`fake-indexeddb` nếu cần — dev dep này được phép, ghi lý do trong plan.

**Package.** `apps/extension`.

**Sizing.** 5 file, ~280 dòng, 1 test file. ✓

---

## 1h1 — Content script: detect + Shadow DOM + render read-only

**Builds.** `apps/extension/src/content/index.ts`, `src/content/detect.ts`,
`src/content/detect.test.ts`, `src/content/shadow.ts`,
`src/content/reader.css` (import dạng string).

**Consumes.** `parseMarkdown` + `renderToHtml` (1c1/1c2), token màu của 1f1
(copy giá trị vào `reader.css`, **không** import `@md-reader/ui`), kết luận
Shadow DOM của 1a.

**Interfaces produced.**

```ts
// apps/extension/src/content/detect.ts
/** A3: đuôi .md/.markdown (bỏ query/hash, không phân biệt hoa thường), hoặc contentType text/markdown. */
export function shouldActivate(loc: Pick<Location, 'pathname'>, contentType: string): boolean

/** Lấy source markdown từ trang Chrome đang hiện dạng plain text. null nếu không tin được. */
export function extractSource(doc: Document): string | null

// apps/extension/src/content/shadow.ts
export interface MountResult { root: ShadowRoot; host: HTMLElement }
export function mountReader(target: HTMLElement, html: string, css: string): MountResult
```

`index.ts` là toàn bộ đường chạy, và nó **cố ý ngắn**: `shouldActivate` →
`extractSource` → `parseMarkdown` → `renderToHtml(parsed, { highlight: true })`
→ `mountReader` → gắn nút "Mở trong MD Reader" (`chrome.runtime.sendMessage`
với `OpenAppRequest` của 1g1, mang theo `source`).

**Mermaid**: theo A1, code block `mermaid` **không** render ở đây. `index.ts`
thay chúng bằng placeholder + nút mở app page — một hàm ~15 dòng đi trên HTML
string trước khi mount, không thư viện.

Cấm trong `src/content/**`, kiểm được bằng grep: `yjs`, `y-indexeddb`, `react`,
`react-dom`, `@md-reader/ui`, `mermaid`.

**Error handling.** `extractSource` trả `null` (trang không phải plain text
như tưởng, đã bị framework nào đó dựng DOM) → **không làm gì**, để nguyên
trang. Đây là mặc định an toàn: content script chạy trên trang người khác.
`mountReader` xong mà `root.firstElementChild` có `clientHeight === 0` → nghi
CSS bị CSP chặn (§5.1 nhánh b): xoá reader, để nguyên trang gốc, chỉ chèn nút
"Mở trong MD Reader" ở góc. **Không bao giờ để trang trắng** — §5.1 (c).

**Tests must prove.** Một file test cho `detect.ts` (§6: extension chỉ test
logic thuần): `shouldActivate` bật cho `/a/b.md`, `/x.MARKDOWN`,
`/a.md?x=1#y`, và `contentType: 'text/markdown'`; tắt cho `/a.mdx`,
`/readme.md.html`, `/`, `contentType: 'text/html'`; `extractSource` lấy đúng
text từ `<pre>` đơn của Chrome plain-text viewer và trả `null` khi DOM có
nhiều element khác.

**Package.** `apps/extension/src/content` — không Yjs, không React, không ui.
Ràng buộc 4 ✓

**Sizing.** 5 file, ~240 dòng, 1 test file. ✓

---

## 1h2 — Content script: cổng ngân sách 60KB gz

**Builds.** `apps/extension/scripts/check-content-size.mjs`, cập nhật
`apps/extension/package.json`, cập nhật `docs/DESIGN.md` §5.3 (số đo thật).

**Consumes.** Bundle của 1h1.

**Interfaces produced.**

```
node scripts/check-content-size.mjs
  → in "content.js: <n> KB gz (budget 60 KB)"
  → exit 1 nếu vượt
```

Gắn vào `package.json`: `"build": "vite build && node
scripts/check-content-size.mjs"` — cổng nằm **trong** build, không phải một
lệnh rời ai cũng quên chạy. Đo `gzipSync` trên chính file `dist/content.js`
sau build, không ước lượng.

**Error handling.** Không tìm thấy `dist/content.js` → exit 1 kèm câu "chạy
vite build trước", không exit 0 im lặng. Đây là cổng chặn, fail-closed.

**Tests must prove.** Không có unit test (script build). Bằng chứng là **số
đo thật** ghi vào §5.3 và output build xanh. Nếu vượt 60KB: đi đúng thứ tự
lever ở A2 (thu ngôn ngữ → tắt highlight ở content script → blocker cho
người). Không nới ngưỡng, không đổi parser.

**Package.** `apps/extension`. Ràng buộc 4 ✓

**Sizing.** 3 file, ~70 dòng, 0 test file mới. ✓

---

## 1i — Mermaid: lazy ở app page + đường degrade

**Builds.** `packages/ui/src/MermaidBlock.tsx`,
`src/MermaidBlock.test.tsx`, cập nhật `packages/ui/src/index.ts`,
cập nhật `packages/ui/package.json` (thêm `mermaid`), cập nhật
`apps/extension/src/app/main.tsx` (nối vào).

**Consumes.** `Viewer` (1f2), `sanitizeSchema` cho `<svg>` (1c1), kết luận của
1a (chỉ để ghi vào §5.1, không đổi thiết kế — A1).

**Interfaces produced.**

```ts
// @md-reader/ui
export interface MermaidBlockProps {
  code: string
  /** 'light' | 'dark' — lấy từ useTheme().resolved */
  theme?: 'light' | 'dark'
  onError?: (error: Error) => void
}

/** Lazy: import('mermaid') chỉ chạy khi component mount lần đầu. */
export function MermaidBlock(props: MermaidBlockProps): JSX.Element
```

`mermaid` **chỉ** vào bằng `await import('mermaid')` trong effect — không
top-level import, để app page bundle không kéo 500KB vào entry. `Viewer` nhận
thêm cách thay `<pre><code class="language-mermaid">` bằng `MermaidBlock`:
làm bằng một prop `renderBlock?: (lang: string, code: string) => ReactNode`
thêm vào `ViewerProps` — đây là mở rộng có kiểm soát của interface 1f2, không
phải viết lại nó, và plan phải nêu rõ 1f2 bị chạm.

**Error handling.** `import('mermaid')` fail → `onError` + render code block
trơn (không trang trắng). `mermaid.render` throw (syntax sai trong diagram) →
hiện code block trơn kèm thông báo lỗi cú pháp ngay dưới, giữ nguyên text của
người dùng. Không bao giờ ném lỗi ra ngoài component.

**Tests must prove.** Một file test với `mermaid` được mock: mount →
`import` được gọi **một lần**, không nhiều; `mermaid.render` throw → render
fallback code block + `onError` được gọi; đổi `theme` → render lại với theme
mới; `code` rỗng → không gọi `render`.

**Package.** `packages/ui` cho component, `apps/extension` chỉ nối vào. Content
script **không** liên quan (A1). Ràng buộc 6/8 ✓

**Sizing.** 5 file, ~200 dòng, 1 test file. ✓

---

## Deferred to phase sau

Ghi ở đây để không lọt vào plan phase 1:

- **Phase 2**: export HTML/PDF/Word, `ExportDialog`, E2E Playwright.
- **Phase 4**: `MermaidBlock` xuất PNG/SVG; excalidraw.
- **Phase 5**: `Editor` + `y-codemirror.next`, File System Access,
  `fileHandle` thật trong `DocRecord` (phase 1 luôn `null`), save/diff ba
  chiều, `originHash` **so lại trước khi ghi**, format-and-save (5e dùng
  `formatMarkdown` của 1e), split view, history checkpoint tự động.
- **Phase 6**: WebSocket provider, `BlameGutter` (dùng `sourceClientIds` của
  1d2), `HistoryTimeline` (dùng `listHistory`), `meta.actors` được điền thật.
- Toggle "tin tài liệu này" của §2.5 lưu **theo từng doc**: phase 1 chỉ có
  tham số `allowRawHtml` ở `renderToHtml`; chỗ lưu lựa chọn là việc phase 5.
