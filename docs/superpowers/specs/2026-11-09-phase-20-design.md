# Design: Phase 20 — Trang chào mới + hướng dẫn từng bước trong app

Author: haonq. Status: in-progress. Phase: 20
Intent: yêu cầu trực tiếp 2026-11-09 — "UI trang chào hơi đơn điệu, làm hoành tráng hơn, thêm guide in-app chỉ từng nút làm gì, có next/previous". Người dùng chọn: guide chạy trên **app page thật**, tô sáng **nút thật**; **tự chạy một lần** khi mở tài liệu mẫu từ trang chào, xem lại được trong Cài đặt → Trợ giúp.

## Sub-phase queue

- 20a — `GuidedTour` (component, packages/ui) — done
- 20b — Mốc `data-tour` trên thanh công cụ + CSS tour — done
- 20c — Nút "Xem hướng dẫn từng bước" trong Cài đặt → Trợ giúp — done
- 20d — Nối tour vào extension (bước, tự chạy, xem lại) — done
- 20e — Trang chào mới — done
- 20f — E2E tour + ghi chú phát hành — planned

## Approach chosen

Tour tự viết (không thêm thư viện như driver.js/shepherd): một component React nhỏ trong `packages/ui` nhận danh sách bước có selector đích; extension cấp bước và quyết định khi nào chạy. Loại bỏ: (1) thư viện tour — thêm phụ thuộc + CSS lạ với Lề sách, khó i18n theo catalog; (2) carousel trên trang chào — người dùng đã chọn chỉ vào nút thật.

Ràng buộc giữ: `packages/ui` không `chrome.*`; `apps/extension` là lớp duy nhất dùng `chrome.*`; content script không đổi (≤ 60 KB gz); không thêm state-manager; i18n vi/en cùng khoá.

## Hướng thiết kế (Lề sách)

Màu: dùng token sẵn có — `--surface` (nền trang), `--paper` (tờ giấy), `--ink`, `--pencil` (chữ phụ, ghi chú lề), `--rule` (đường kẻ), `--accent` (hành động), `--hl` (dấu bút dạ cho ghi chú lề). Không màu cứng.
Chữ: Literata (`--font-body`) cho tiêu đề lớn và nội dung tờ giấy; IBM Plex Sans (`--font-ui`) cho giao diện và ghi chú lề. Không chữ in hoa toàn bộ, không nhãn trang trí trên tiêu đề, không mũi tên gắn sau chữ nút.
Điểm nhấn duy nhất: **một tờ giấy có ghi chú ngoài lề** — giống trang sách có người ghi chú bằng bút chì; mỗi ghi chú lề chỉ vào một phần của tờ giấy và nói tính năng đó. Mọi thứ khác yên tĩnh.
Chuyển động: một lần khi tải trang — ghi chú lề hiện lần lượt (cách nhau 120 ms, mờ → rõ + dịch 4 px). `prefers-reduced-motion: reduce` → không chuyển động. Tour: khung tô sáng trượt sang nút kế (200 ms) — chuyển động trả lời hành động bấm Tiếp; reduced-motion → nhảy thẳng.

## 20a — `GuidedTour`

`packages/ui/src/components/GuidedTour.tsx` (+ test), khoá `tour.*` trong `packages/ui/src/i18n/catalog/shell.ts`, export trong `packages/ui/src/index.ts`.

```ts
export interface TourStep {
  id: string
  /** Selector theo thứ tự ưu tiên; phần tử đầu tiên tìm thấy và đang hiển thị (getBoundingClientRect có width/height > 0) là đích. null/không tìm thấy → popover giữa màn hình, phủ mờ toàn bộ. */
  target: string[] | null
  title: string
  body: string
}
export interface GuidedTourProps {
  steps: TourStep[]
  open: boolean
  onClose(result: 'done' | 'skipped'): void
}
export function GuidedTour(props: GuidedTourProps): React.JSX.Element | null
```

Cấu trúc DOM (class là hợp đồng với CSS ở 20b): khi `open && steps.length > 0`, render qua `createPortal` vào `document.body`:
- `<div className="tour-layer">` (fixed, phủ toàn màn hình, chặn click xuống app; click vào lớp này không làm gì).
- `<div className="tour-spotlight" data-centered={bool}>` — fixed, đặt theo rect đích + đệm 6 px (style inline `top/left/width/height`); khi không có đích: `data-centered="true"`, kích thước 0 ở giữa màn hình (bóng phủ vẫn che toàn bộ).
- `<div className="tour-pop" role="dialog" aria-modal="true" aria-labelledby aria-describedby data-placement="below|above|center">` gồm `<p className="tour-progress">` (`tour.progress`: "{current}/{total}", có `aria-label` từ `tour.progressLabel` "Bước {current} trên {total}"), `<h2 className="tour-title">`, `<p className="tour-body">`, `<div className="tour-actions">` với `Bỏ qua` (`tour.skip`, class `tour-skip`), `Trước` (`tour.prev`, class `tour-prev`, ẩn ở bước đầu), `Tiếp`/`Xong` (`tour.next`/`tour.done`, class `tour-next`).
Vị trí popover: dưới đích 12 px nếu đủ chỗ (popover cao ước lượng bằng đo thật sau render), không thì trên; theo chiều ngang căn giữa đích rồi kẹp trong [16 px, innerWidth − 16 − width]. Không đích → giữa màn hình.
Hành vi: mở → focus nút Tiếp; Tab/Shift+Tab xoay vòng trong popover; `Escape` → `onClose('skipped')`; `ArrowRight` → tiếp, `ArrowLeft` → trước; Tiếp ở bước cuối → `onClose('done')`; Bỏ qua → `onClose('skipped')`. Đổi bước: nếu đích ngoài khung nhìn thì `scrollIntoView({ block: 'center' })`. Tính lại vị trí khi `resize`/`scroll` (capture) qua `requestAnimationFrame`; gỡ listener khi đóng/unmount. `open` false → không render gì, về bước 0 lần mở sau. Trả focus về phần tử đang focus trước khi mở.
Catalog `shell.ts` vi/en: `tour.skip` ("Bỏ qua"/"Skip"), `tour.prev` ("Trước"/"Back"), `tour.next` ("Tiếp"/"Next"), `tour.done` ("Xong"/"Done"), `tour.progress` ("{current}/{total}"), `tour.progressLabel` ("Bước {current} trên {total}"/"Step {current} of {total}").
Test: render với 3 bước có đích là nút thật trong DOM (mock `getBoundingClientRect`); bước 1 không có nút Trước; Tiếp → bước 2, Trước → bước 1; bước cuối hiện "Xong", bấm → `onClose('done')` một lần; Esc → `'skipped'`; ArrowRight/Left; đích không tồn tại → `data-placement="center"`; selector thứ hai dùng khi cái đầu không có; spotlight có style theo rect; focus nằm trên Tiếp khi mở và trả về khi đóng; `open=false` không render.

## 20b — Mốc `data-tour` + CSS tour

`TopToolbar.tsx` (+ test): thêm `data-tour` cho: nút mục lục `toc`, nhóm chế độ xem `view-mode` (trên `.tb-seg`), `IconBtn` nhận prop `tour?: string` → `data-tour`: `search`, `present`, `mindmap`, `share`, mỗi action theo `a.id` (`open`, `export`, `history`, `settings`, `blame`), `save`; nút Thêm `more`. Không đổi hành vi khác.
`packages/ui/src/theme/tour.css` + `@import` trong `packages/ui/src/viewer.css` (cạnh các theme khác): `.tour-layer` (fixed inset 0, z-index 10050 — trên modal 10000), `.tour-spotlight` (fixed, border-radius 8 px, `box-shadow: 0 0 0 9999px color-mix(in srgb, var(--ink) 55%, transparent)`, `outline: 2px solid var(--accent)`, `transition: top/left/width/height 200ms ease`, pointer-events none, z-index 10051), `.tour-pop` (fixed, z-index 10052, nền `var(--paper)`, viền `1px solid var(--rule)`, bo 10 px, `max-width: min(340px, calc(100vw - 32px))`, đệm 16 px 18 px, bóng nhẹ, font `var(--font-ui)`, màu `var(--ink)`), `.tour-progress` (màu `var(--pencil)`, cỡ 0.8rem, `font-variant-numeric: tabular-nums`), `.tour-title` (Literata 1.15rem 600), `.tour-body` (0.95rem, line-height 1.5), `.tour-actions` (flex, `Bỏ qua` đẩy trái bằng `margin-right:auto`, nút kiểu link màu pencil; Trước viền `--rule`; Tiếp nền `--accent` chữ `--paper`), focus-visible outline accent; `@media (prefers-reduced-motion: reduce) { .tour-spotlight { transition: none } }`; `@media print { .tour-layer, .tour-spotlight, .tour-pop { display: none } }`.
Test: render TopToolbar rộng → có `[data-tour="present"]`, `[data-tour="view-mode"]`, `[data-tour="settings"]` (truyền action id settings), `[data-tour="more"]`.

## 20c — Xem lại trong Cài đặt

`SettingsHelpProps` thêm `onStartTour?: () => void`. Có thì mục Trợ giúp hiện nút `settings.help.tour` ("Xem hướng dẫn từng bước" / "Take the guided tour") trước form góp ý. Test: có prop → bấm gọi một lần; không có → không có nút.

## 20d — Nối tour vào extension

`apps/extension/src/app/tour.ts` (+ test):
```ts
export const TOUR_DONE_KEY = 'mdr:tour-done'
export const TOUR_PARAM = 'tour'
export const TOUR_STEP_IDS = ['intro', 'view-mode', 'toc', 'search', 'present', 'mindmap', 'export', 'share', 'settings'] as const
export function tourSteps(t: (k: string) => string): TourStep[]   // intro target null; view-mode/toc: [`[data-tour="<id>"]`]; còn lại: [`[data-tour="<id>"]`, '[data-tour="more"]']
export function useGuidedTour(ready: boolean): { open: boolean; start(): void; onClose(r: 'done' | 'skipped'): void }
```
`useGuidedTour`: khi `ready` true lần đầu và URL có `tour=1` → đọc `chrome.storage.local[TOUR_DONE_KEY]`; chưa có → `open = true`. `onClose` → `open = false`, ghi `TOUR_DONE_KEY: true` (lỗi → `console.warn`), bỏ `tour` khỏi URL bằng `history.replaceState`. `start()` mở lại bất kể khoá. Đổi `ready` false→true lần nữa không tự mở lại.
Catalog `ext.ts` vi/en: `ext.tour.<id>.title` / `.body` cho 9 bước (nội dung ở plan 20d).
`App.tsx`: `const tour = useGuidedTour(<tài liệu đã sẵn sàng> && !isSpeakerMode)`; render `<GuidedTour steps={tourSteps(t)} open={tour.open} onClose={tour.onClose} />`; `help` thêm `onStartTour: () => { setSettingsOpen(false); tour.start() }`.
`WelcomeRoute.tsx`: mở mẫu → `'app.html' + docQuery + '&tour=1'`.

## 20e — Trang chào mới

`WelcomePage.tsx`, `welcome.css`, `WelcomePage.test.tsx`, catalog `ext.ts`. Giữ nguyên props (`status`, `onOpenSample`, `onOpenFileSettings`, `onDone`) và hành vi checklist. Bố cục ≥ 900 px hai cột (chữ trái 5/12, tờ giấy phải 7/12, căn trái), hẹp thì xếp dọc (tờ giấy dưới, ghi chú lề thành dòng dưới từng phần):

```
┌───────────────────────────────────────────────────────────────┐
│ [logo] MD Reader                                               │
│                                     ┌─────────────────┐ ghi chú│
│ Markdown, đọc như                   │ # Kế hoạch quý  │•Đọc như│
│ một cuốn sách.                      │ đoạn văn…       │ sách   │
│                                     │ - mục           │•Sửa tại│
│ lead…                               │ | bảng |        │ chỗ    │
│ [Mở tài liệu mẫu]  Vào MD Reader    │ ```code```      │•Trình  │
│ Hướng dẫn từng bước chạy cùng mẫu.  └─────────────────┘ chiếu  │
│                                       (2 tờ lệch phía sau)     │
│ Chuẩn bị · 2 trên 4 đã xong ▬▬▬▬───                            │
│ ① Ghim…  Đã xong   ② Cho phép…  [Mở cài đặt] …                 │
└───────────────────────────────────────────────────────────────┘
```
Chi tiết trong plan 20e.

## 20f — E2E + ghi chú phát hành

Mở rộng `apps/extension/e2e-pw/lifecycle.spec.ts`: sau khi bấm mở mẫu, popover tour hiện (`role=dialog` có "1/9"), Tiếp → "2/9", Trước → "1/9", Bỏ qua → đóng; khởi động lại và mở lại tài liệu với `tour=1` → không tự mở. `shared/release-notes.ts` 1.5.0 thêm một dòng "Trang chào mới và hướng dẫn từng bước" (bản 1.5.0 chưa nộp store).

## Deferred

- Tour cho chế độ Sửa (thanh định dạng), trình chiếu, mindmap bên trong — chỉ khi có phản hồi.
