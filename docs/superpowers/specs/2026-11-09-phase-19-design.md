# Phase 19 — PDF trình chiếu không cắt chữ

Author: haonq. Status: designed. Phase: 19
Intent: docs/superpowers/intent/2026-11-09-phase-19-pdf-trinh-chieu.md

Ship: *tài liệu dài xuất PDF trình chiếu và trình chiếu trên màn hình không còn chữ bị cắt; người dùng tự đặt được chỗ ngắt.*

## Sub-phase queue

- 19a — Dấu ngắt thủ công trong `splitIntoSlides` — done
- 19b — Thuật toán chia `paginateBlocks` — done
- 19c1 — Tách khối và dựng lại HTML slide — done
- 19c2 — Đo trên sân khấu ẩn `useSlidePagination` — done
- 19d1 — Chia danh sách và bảng dài — done
- 19d2 — Thu nhỏ khối quá lớn + cảnh báo — done
- 19e1 — Print CSS đúng kích thước slide — done
- 19e2 — Nối Present và Speaker view — done
- 19e3 — Xuất PDF chờ chia xong — done
- 19f — Cài đặt bật/tắt tự chia — done
- 19g1 — Tính vị trí chèn dấu ngắt — done
- 19g2 — Nút "Ngắt slide tại đây" — done
- 19h1 — E2E không cắt chữ — done
- 19h2 — Tài liệu — done

## Approach chosen

Có hai nguyên nhân, nên sửa hai chỗ. **(1) Hình học:** `.deck-print-slide` dùng `100vw × 100vh` trên trang `landscape`, tức khổ giấy tỉ lệ khác 16:9, trong khi `Deck` là 1280×720.
PDF đổi sang `@page { size: 1280px 720px }` với slide đúng 1280×720, nên đo một lần là đúng cho cả màn hình lẫn PDF. **(2) Chia:** đo chiều cao thật từng khối trên sân khấu ẩn 1280×720,
hàm thuần trong core quyết định chỗ ngắt, rồi dựng slide mới từ chính HTML đã sanitize.

Đã loại:
- **Ước lượng theo số dòng/ký tự trong core:** không biết font, cỡ chữ, ảnh, sơ đồ, nên vẫn cắt chữ.
- **Để trình duyệt tự ngắt trang khi in (bỏ `overflow: hidden`):** PDF không khớp Present, và mất bố cục slide.
- **Luôn thu nhỏ cả slide cho vừa:** không cắt chữ nhưng slide dài thành chữ tí hon, trái với mục tiêu.

## Giả định đã chốt (thay cho open questions)

- **Danh sách dài** tách theo mục cấp một; **bảng dài** tách theo hàng và lặp `thead`. Khối còn lại (code, ảnh, đoạn) không tách.
- **Không lặp tiêu đề** ở slide tiếp nối. Heading không bao giờ nằm cuối slide tách khỏi khối sau nó (`keepWithNext`).
- **Không bao giờ cắt:** khối quá lớn được zoom tới khi vừa, không có mức sàn. Zoom < 0.6 thì báo chữ nhỏ và gợi ý ngắt tay.
- **Chờ render:** `document.fonts.ready`, ảnh `decode()`, rồi chiều cao ổn định 150 ms; tổng tối đa 5 giây, hết giờ thì đo với trạng thái hiện có.
- **Cài đặt là toàn cục** trong `readerSettings`, khoá `slideAutoSplit`, thiếu = bật. Muốn chỉnh theo tài liệu thì dùng dấu ngắt.
- **Tắt tự chia:** quay về một slide cho mỗi phần Markdown; dấu `<!-- slide-break -->` vẫn có hiệu lực; print CSS mới vẫn áp dụng.
- **Zoom** đặt bằng `element.style.zoom` qua CSSOM, không đưa thuộc tính `style` vào HTML.
- **`apps/web` không dùng `Deck`,** nên ngoài phạm vi. Không đổi schema Y.Doc, không đổi kích thước content script.

---

## 19a — Dấu ngắt thủ công

Sửa `packages/core/src/slides/split.ts`, `slides.test.ts`. Thuần TS.

```ts
export const SLIDE_BREAK_MARKER = '<!-- slide-break -->'
export function isSlideBreakLine(line: string): boolean  // /^\s*<!--\s*slide-break\s*-->\s*$/i
```

Sau khi chia theo chiến lược, mỗi section được tách tiếp tại dòng dấu **ngoài khối code**. Dấu không tham gia `hasHr` / `hasMatchingHeading`, nên không đổi chiến lược. Section rỗng do dấu ở đầu/cuối bị bỏ. Hàng `notes` đi theo phần chứa chúng.
Test: ngắt ở cả `hr`, `heading`, `fallback`; trong code không ngắt; không đổi chiến lược; dấu không xuất hiện trong `html`, `renderToHtml` của tài liệu và đầu ra docx.

## 19b — Thuật toán chia

Tạo `packages/core/src/slides/paginate.ts` + test; sửa `types.ts`, `index.ts`. Hàm thuần nên ở core (§2.4); không đọc DOM.

```ts
export interface BlockBox {
  height: number          // gồm khoảng cách tới khối sau
  width: number
  keepWithNext: boolean   // heading
}
export interface SlidePage {
  start: number           // chỉ số khối, gồm
  end: number             // không gồm
  zoom: number            // 1 hoặc < 1 khi là khối quá lớn đứng một mình
}
export function paginateBlocks(blocks: BlockBox[], maxH: number, maxW: number): SlidePage[]
export const SMALL_ZOOM = 0.6
```

Tham lam từ trên xuống. Khối `height > maxH` hoặc `width > maxW` đứng một mình với `zoom = min(maxH/h, maxW/w)`. Heading `keepWithNext` chuyển sang trang sau cùng khối kế tiếp; dãy toàn heading không gây lặp vô hạn. Danh sách rỗng → `[]`.

`Slide` thêm trường tuỳ chọn (không đổi type cũ):

```ts
part?: { index: number; total: number }
zoom?: number
```

Test: vừa khít; heading không mồ côi; khối quá lớn; dãy toàn heading; luôn phủ đủ mọi khối, không trùng.

## 19c1 — Tách khối và dựng lại HTML

Tạo `packages/ui/src/slides/slide-blocks.ts` + test. DOM nên ở ui.

```ts
export function splitBlockElements(root: HTMLElement): HTMLElement[]   // con cấp một, bỏ node rỗng
export function buildPagedSlides(source: Slide, elements: HTMLElement[], pages: SlidePage[]): Slide[]
```

`buildPagedSlides` nối `outerHTML` của `pages[i]`, id `<source.id>-p<i>`, `part` khi có nhiều hơn một trang, `zoom` khi < 1. `notes` và `title` chỉ ở phần đầu. `rawMarkdown` giữ nguyên ở mọi phần. `index` đánh lại ở 19c2. Không sinh HTML mới ngoài các phần tử đã sanitize. Mermaid: dùng `<pre><code>` gốc, không dùng SVG đã vẽ.

## 19c2 — Đo trên sân khấu ẩn

Tạo `packages/ui/src/slides/useSlidePagination.tsx` + test.

```ts
export interface SlideFitWarning { slideId: string; zoom: number }
export interface SlidePagination { slides: Slide[]; ready: boolean; warnings: SlideFitWarning[] }
export type BlockMeasure = (el: HTMLElement, next: HTMLElement | null) => BlockBox
export function useSlidePagination(
  slides: Slide[],
  opts: { enabled: boolean; mermaid: boolean; presentationSettings?: PresentationSettings; measure?: BlockMeasure },
): SlidePagination & { stage: React.ReactNode }
```

`stage` dùng `SlideContent` trong khối `position: fixed; left: -99999px; width: 1280px; height: 720px; visibility: hidden`, cùng class và biến như `Deck`, `aria-hidden`. `maxH`, `maxW` tính từ vùng nội dung sau padding. `enabled: false` → trả nguyên `slides`, `ready: true`. Lỗi đo một slide → giữ nguyên slide đó, `console.warn`. `slides` đổi giữa chừng → huỷ lượt cũ. Test tiêm `measure` vì jsdom không có layout.

## 19d1 — Chia danh sách và bảng dài

Sửa `slide-blocks.ts` và test.

```ts
export function expandOversized(el: HTMLElement, maxH: number, measure: (e: HTMLElement) => number): HTMLElement[]
```

`ul`/`ol` quá `maxH` → mỗi phần một danh sách cùng thẻ; `ol` giữ số bằng thuộc tính `start`. `table` quá `maxH` → nhóm hàng `tbody`, mỗi phần có bản sao `thead`. Khối tách ra vẫn lớn thì để 19d2 xử lý. Test: `start` đúng, `thead` lặp, không mất mục, không tách khối vừa.

## 19d2 — Thu nhỏ khối quá lớn + cảnh báo

Sửa `Deck.tsx` (`SlideContent` nhận `zoom?: number`), `useSlidePagination.tsx`, catalog `present.ts`, test sẵn có.

`SlideContent` đặt `ref.current.style.zoom`. `warnings` nhận slide có `zoom < SMALL_ZOOM`. Hiện chú thích trong khung điều khiển `Deck` và `ExportModal`: "Slide {i} chữ nhỏ, nên thêm dấu ngắt" (vi + en). Không chặn xuất.

## 19e1 — Print CSS đúng kích thước

Sửa `packages/ui/src/theme/deck-print.css` + `print.test.ts` hoặc test CSS sẵn có.

`@page slide-deck { size: 1280px 720px; margin: 0 }`; `.deck-print-slide` `width: 1280px; height: 720px`, bỏ `100vw/100vh`, padding khớp `Deck`. Giữ `overflow: hidden` làm lưới an toàn, vì nội dung đã được chia.

## 19e2 — Nối Present và Speaker view

Sửa `apps/extension/src/app/App.tsx`, `Deck.tsx`, `SpeakerView.tsx` và test sẵn có.

App bọc `splitIntoSlides` bằng `useSlidePagination`; `Deck`, `SpeakerView` và khối in dùng cùng `slides` đã chia. Khi `ready` còn false thì hiện trạng thái chờ ngắn. Hai cửa sổ đo độc lập nhưng sân khấu cố định 1280×720 nên ra cùng dãy. Chỉ số nhận qua `BroadcastChannel` trước khi `ready` được giữ lại và áp dụng sau. Vị trí hiện tại vượt số slide → kẹp về cuối.

## 19e3 — Xuất PDF chờ chia xong

Sửa `apps/extension/src/app/hooks/useExport.ts`, `App.tsx`, `useExport.test.ts`.

```ts
// tham số mới của useExport
waitSlidesReady?: () => Promise<void>
```

`'slides-pdf'`: bật `isPrintingSlides` → `await waitSlidesReady()` → `printSlides()`. Hết thời gian 7 giây vẫn in, không treo (lâu hơn trần đo 5 giây của hook để lần đo chạm trần vẫn kịp); lượt hết hạn bị huỷ, không ghi `printHtml` muộn. Danh sách trang ở `ExportModal` phản ánh số slide đã chia.

## 19f — Cài đặt

Sửa `SettingsModal.tsx`, catalog `settings.ts`, `App.tsx`, test sẵn có. Công tắc "Tự chia slide khi nội dung dài" ở nhóm `slides`. Khoá `slideAutoSplit?: boolean`, truyền thành `enabled: settings.slideAutoSplit !== false`. Mô tả nêu cú pháp `<!-- slide-break -->`.

## 19g1 — Tính vị trí chèn dấu ngắt

Sửa `split.ts`, `slides.test.ts`.

```ts
export function slideBreakInsertion(text: string, cursor: number): { at: number; insert: string }
```

Chèn ở đầu dòng của khối chứa con trỏ, có dòng trống bao quanh. Con trỏ trong khối code → chèn trước dòng mở rào. Ngay sau một dấu sẵn có → không tạo dấu đôi (`insert: ''`).

## 19g2 — Nút ngắt

Sửa `FormattingToolbar.tsx`, `App.tsx` (`handleFormatAction`), catalog, test sẵn có. `FormatAction` thêm `'slideBreak'`. Chèn bằng một transaction CodeMirror, tức delta nhỏ nhất trên `Y.Text`. Có Icon và nhãn vi + en.

## 19h1 — E2E

Playwright: tài liệu dài gồm đoạn văn, danh sách, bảng, code, có một dấu ngắt → vào chế độ in slide → mọi `.deck-print-slide` có `scrollHeight <= clientHeight`, số slide > số phần Markdown, và `page.pdf({ preferCSSPageSize: true })` có đúng số trang bằng số slide.

## 19h2 — Tài liệu

Sửa `docs/ROADMAP.md`, `docs/ROADMAP.en.md` (đánh dấu xong, thêm P19), README nếu có phần trình chiếu. Tài liệu cú pháp dấu ngắt, kể cả trong `docs/MCP*.md` để AI dùng được. Không đổi phiên bản trong phase này.

## Deferred

- Màn xem trước để bấm chọn chỗ ngắt.
- Tách khối code dài theo dòng.
- Dấu "giữ các khối này cùng slide".
- Hiển thị dấu ngắt thành widget trong live preview.
- Slide trên `apps/web`.
