# Design: Phase 3 — Trình chiếu (Presentation & Slides)
Author: Antigravity. Status: designed. Phase: 3
Intent: docs/superpowers/intent/2026-09-14-phase-3-trinh-chieu.md

## Sub-phase queue

| # | Phase con | Trạng thái |
|---|---|---|
| 3a | `core/slides` | pending |
| 3b | `Deck` UI | pending |
| 3c | `SpeakerView` UI | pending |
| 3d | App Integration & Speaker Sync | pending |
| 3e | Deck → PDF Export | pending |

## Approach chosen

1. **Slide Splitting (`core/slides`):**
   - *Lựa chọn:* Phân tách tài liệu thành danh sách `Slide[]` dựa trên thẻ ranh giới `---` (`thematicBreak`). Nếu tài liệu không có bất kỳ thẻ `---` nào, tự động fallback sang chia theo Heading depth (H1 hoặc H2). Trích xuất ghi chú diễn giả `<!-- note: ... -->` vào thuộc tính `notes: string[]` của từng slide, và loại bỏ hoàn toàn các comment này khỏi HTML slide hiển thị để đảm bảo tính bảo mật nội dung của diễn giả.
   - *Phương án loại bỏ:* Không yêu cầu cấu trúc frontmatter phức tạp như Marp hay Slidev để giữ file Markdown thuần túy và tự nhiên cho việc đọc tài liệu thông thường.

2. **Giao diện Slide Deck (`Deck`):**
   - *Lựa chọn:* Component React toàn màn hình (Fullscreen API), duy trì khung tỉ lệ 16:9 responsive, căn giữa slide. Tái sử dụng CSS và cơ chế render của `.md-viewer` để kế thừa trọn vẹn styling code highlight, math/katex, tables và mermaid diagrams.
   - *Phương án loại bỏ:* Không nhúng Reveal.js hay các thư viện slide cồng kềnh ngoài vì sẽ làm tăng kích thước bundle và phá vỡ kiến trúc React / pure CSS của `@md-reader/ui`.

3. **Giao diện Diễn giả & Cơ chế Đồng bộ (`SpeakerView` & BroadcastChannel):**
   - *Lựa chọn:* Sử dụng API `BroadcastChannel("md-reader-slides-sync")` tiêu chuẩn của trình duyệt để đồng bộ 2 chiều giữa cửa sổ trình chiếu chính và cửa sổ Speaker View (`?speaker=true`). Diễn giả có thể mở Speaker View ở màn hình phụ: hiển thị slide hiện tại, xem trước slide kế tiếp, đồng hồ đếm giờ (elapsed timer) và danh sách speaker notes.
   - *Phương án loại bỏ:* Không dùng `chrome.runtime.sendMessage` trung gian qua service worker vì `BroadcastChannel` nhanh hơn, không phụ thuộc quyền extension, và hoạt động trơn tru trong mọi môi trường web tiêu chuẩn.

4. **Xuất Slide sang PDF (`Deck → PDF`):**
   - *Lựa chọn:* Bổ sung CSS in ấn dành riêng cho slide `@media print { @page { size: landscape; margin: 0; } }` với mỗi slide là một container `page-break-after: always`. Sử dụng `window.print()` nguyên bản (tuân thủ Ràng buộc 7 trong `DESIGN.md`).
   - *Phương án loại bỏ:* Không dùng thư viện headless hay tạo file PDF bằng canvas thủ công.

---

## 3a — `core/slides`

**Builds:**
- Module `packages/core/src/slides/`:
  - `types.ts`:
    ```ts
    export interface Slide {
      id: string
      index: number
      rawMarkdown: string
      html: string
      notes: string[]
      title?: string
    }

    export interface SlideSplitOptions {
      strategy?: 'hr' | 'heading' | 'auto'
      headingDepth?: number
    }
    ```
  - `split.ts`:
    - `splitIntoSlides(source: string, options?: SlideSplitOptions): Slide[]`
    - Cắt chuỗi markdown theo `---` hoặc heading depth.
    - Trích xuất `<!-- note: ... -->` và `<!-- speaker: ... -->` vào `slide.notes`.
    - Gọi `renderToHtml(slideRawMarkdown)` để tạo `slide.html` đã sanitize sạch comment.
    - Trích xuất title từ heading đầu tiên nếu có.
- Xuất khẩu `splitIntoSlides`, `Slide`, `SlideSplitOptions` tại `packages/core/src/index.ts`.

**Consumes:** `renderToHtml` từ `@md-reader/core`.
**Tests:** `packages/core/src/slides/slides.test.ts`:
  - Cắt slide theo `---`.
  - Cắt slide theo heading khi không có `---`.
  - Trích xuất speaker notes và xác nhận ghi chú không lọt vào `html`.
  - Edge case tài liệu rỗng hoặc chỉ có 1 slide.
**Sizing:** 4 files, ~220 lines diff, 1 new test file.

---

## 3b — `Deck` UI

**Builds:**
- `packages/ui/src/components/Deck.tsx`:
  ```ts
  export interface DeckProps {
    slides: Slide[]
    initialSlide?: number
    onClose?: () => void
    onSlideChange?: (index: number) => void
    onOpenSpeakerView?: () => void
    colorTheme?: ColorTheme
    mode?: 'light' | 'dark' | 'system'
  }
  export function Deck(props: DeckProps): React.JSX.Element
  ```
- `packages/ui/src/theme/deck.css`:
  - Chế độ toàn màn hình cố định `fixed; inset: 0; z-index: 100;`.
  - Khung slide 16:9 responsive (`aspect-ratio: 16/9; max-width: 90vw; max-height: 90vh;`).
  - Thanh tiến độ slide mỏng ở đáy (`.deck-progress-bar`).
  - Thanh điều khiển nổi hiển thị số trang `X / Y`, nút Prev, Next, Speaker View, Exit.
- Xử lý bàn phím: `ArrowRight`, `ArrowLeft`, `Space`, `Backspace`, `Home`, `End`, `Esc`.
- Xuất khẩu `Deck`, `DeckProps` tại `packages/ui/src/index.ts`.

**Consumes:** `Slide` từ `@md-reader/core`, `Viewer` styling.
**Tests:** `packages/ui/src/components/Deck.test.tsx`:
  - Render slide ban đầu.
  - Phím mũi tên / click nút next chuyển slide và gọi `onSlideChange`.
  - Nhấn phím Esc gọi `onClose`.
  - Nhấn nút Speaker View gọi `onOpenSpeakerView`.
**Sizing:** 4 files, ~260 lines diff, 1 new test file.

---

## 3c — `SpeakerView` UI

**Builds:**
- `packages/ui/src/components/SpeakerView.tsx`:
  ```ts
  export interface SpeakerViewProps {
    slides: Slide[]
    currentSlideIndex: number
    onSlideChange: (index: number) => void
    elapsedSeconds?: number
    onResetTimer?: () => void
  }
  export function SpeakerView(props: SpeakerViewProps): React.JSX.Element
  ```
- `packages/ui/src/theme/speaker-view.css`:
  - Layout 2 cột tối ưu cho diễn giả:
    - Cột trái: Khung xem slide hiện tại + Bảng đồng hồ (Giờ hiện tại, Đồng hồ đếm giờ Elapsed, nút Pause/Reset).
    - Cột phải: Xem trước slide kế tiếp (Next Slide) + Khung cuộn ghi chú diễn giả (`.speaker-notes-box`).
- Xuất khẩu `SpeakerView`, `SpeakerViewProps` tại `packages/ui/src/index.ts`.

**Consumes:** `Slide` từ `@md-reader/core`.
**Tests:** `packages/ui/src/components/SpeakerView.test.tsx`:
  - Render đúng slide hiện tại và slide tiếp theo.
  - Hiển thị speaker notes của slide tương ứng.
  - Điều khiển đồng hồ đếm giờ (start, reset).
**Sizing:** 4 files, ~240 lines diff, 1 new test file.

---

## 3d — App Integration & Speaker Sync

**Builds:**
- Cập nhật `packages/ui/src/components/TopToolbar.tsx`:
  - Thêm nút `Present` `[📽]` với `title="Trình chiếu (P)"`.
  - Prop: `onPresent?: () => void`.
- Cập nhật `apps/extension/src/app/App.tsx`:
  - Quản lý state `isPresenting: boolean` và `currentSlide: number`.
  - Phím tắt `P` kích hoạt trình chiếu khi không trong ô nhập liệu.
  - BroadcastChannel: kênh `"md-reader-slides-sync"` để đồng bộ `currentSlide` giữa Main Deck và Speaker View.
  - Hỗ trợ query parameter `?speaker=true`: nếu URL có param này, tự động render `SpeakerView` độc lập toàn màn hình.
  - Nút mở Speaker View trên Deck gọi `window.open('?speaker=true', 'md-speaker', 'width=1080,height=680')`.

**Consumes:** `splitIntoSlides` (`@md-reader/core`), `Deck` & `SpeakerView` (`@md-reader/ui`).
**Tests:** `apps/extension/src/app/App.test.tsx`:
  - Nhấn nút Present mở Deck.
  - Test chuyển slide và broadcast thông điệp qua `BroadcastChannel`.
**Sizing:** 4 files, ~260 lines diff, 0 new test files (cập nhật test hiện có).

---

## 3e — Deck → PDF Export

**Builds:**
- `packages/ui/src/theme/deck-print.css`:
  - `@media print`: `@page { size: landscape; margin: 0; }`.
  - `.deck-print-container`: ẩn thanh công cụ, mỗi slide ngắt trang `page-break-after: always`.
- Cập nhật `packages/ui/src/components/ExportModal.tsx`:
  - Thêm tuỳ chọn định dạng: "Slide PDF (Khổ ngang)" (`slide-pdf`).
- Cập nhật `apps/extension/src/app/App.tsx`:
  - Xử lý hành động xuất Slide PDF: gắn class print chuyên dụng và kích hoạt `window.print()`.

**Consumes:** `Slide` từ `@md-reader/core`, `ExportModal` từ `@md-reader/ui`.
**Tests:** `packages/ui/src/components/ExportModal.test.tsx` (kiểm tra tuỳ chọn slide-pdf) và `apps/extension/e2e/ux-reading.spec.ts` (hoặc test xuất slide).
**Sizing:** 4 files, ~200 lines diff, 0 new test files.
