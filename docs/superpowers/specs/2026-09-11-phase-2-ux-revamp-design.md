# Design: Phase 2 — Trải nghiệm Đọc A4 & UX/UI Chuyên nghiệp
Author: Antigravity. Status: shipped. Phase: 2
Intent: docs/superpowers/intent/2026-09-11-phase-2-ux-revamp.md

## Sub-phase queue

| # | Phase con | Trạng thái |
|---|---|---|
| 2h | Layout A4 & Progress | done |
| 2i | Top Toolbar & Reading Mode | done |
| 2j | In-document Search | done |
| 2k | Elements: Code copy & Tables | done |
| 2l | ToC Navigation & Font Family | done |
| 2m | E2E UX & Reading Smoke | done |

## Approach chosen

1. **Bố cục A4 Document & Workspace (2h):**
   - *Lựa chọn:* Phân tách không gian thành 2 tầng màu: `--md-workspace-bg` (nền làm việc bao quanh, trung tính, hơi tối hoặc hơi ngả màu) và `--md-doc-bg` (mặt giấy tài liệu A4, sắc nét, có border 1px tinh tế và shadow mềm 0 4px 24px). Bổ sung thanh tiến độ đọc mỏng (3px) cố định ở đỉnh màn hình (`position: fixed; top: 0`).
   - *Phương án loại bỏ:* Không làm hiệu ứng chia trang vật lý từng tờ ngắt dòng cứng nhắc vì gây giật khung hình và cản trở việc cuộn đọc văn bản liên tục trên web.

2. **Top Toolbar & Reading Mode (2i):**
   - *Lựa chọn:* Sticky toolbar tối giản cố định ở đầu trang (`height: 48px`, `backdrop-filter: blur(12px)`), bao gồm: nút ToC `[☰]`, tên tài liệu, bộ điều khiển cỡ chữ `[A-] [100%] [A+]`, chuyển nhanh theme, nút Tìm kiếm `[⌕]`, nút Reading Mode `[📖]`, nút Settings và Export. Reading mode ẩn toàn bộ toolbar/sidebar, chỉ để lại tài liệu và một floating control nhỏ khi di chuột.
   - *Phương án loại bỏ:* Không nhồi nhét quá nhiều dropdown phức tạp vào toolbar; các cài đặt nâng cao vẫn nằm trong SettingsModal.

3. **In-document Search (2j):**
   - *Lựa chọn:* Search overlay/bar kích hoạt bằng `Cmd+F` hoặc nút tìm kiếm trên toolbar. Duyệt DOM text node bằng TreeWalker an toàn, bọc từ khoá bằng `<mark class="md-search-match">`, điều hướng Next/Prev bằng `scrollIntoView({ behavior: 'smooth', block: 'center' })`.
   - *Phương án loại bỏ:* Không regex thay thế trên source markdown Y.Text vì sẽ làm trigger re-parse toàn bộ tài liệu và làm bẩn CRDT history.

4. **Code Block Copy & Table Enhancement (2k):**
   - *Lựa chọn:* Custom rendering hoặc post-process cho `<pre><code>` gắn header thanh mảnh có badge ngôn ngữ + nút Copy với hiệu ứng `Copied ✓` sau 1.5s; Table header áp dụng màu theme accent chính (`--md-accent`) với chữ trắng tương phản, zebra striping trên hàng chẵn, và bọc wrapper `overflow-x: auto`.
   - *Phương án loại bỏ:* Không dùng thư viện copy bên ngoài, dùng `navigator.clipboard.writeText`.

5. **ToC Thu gọn & Font Family (2l):**
   - *Lựa chọn:* ToC hỗ trợ collapse/expand các nhánh H2/H3 theo H1, visual indicator thanh mảnh cho section đang active khi scroll; bổ sung tuỳ chọn font family (`sans`, `serif`, `mono`) qua CSS variable `--md-font-family`.

---

## 2h — Layout A4 & Progress

**Builds:**
- `packages/ui/src/theme/a4.css`:
  - Khai báo CSS variables `--md-workspace-bg`, `--md-doc-bg`, `--md-doc-shadow`.
  - Class `.a4-document-container`: `max-width: 820px; margin: 24px auto; background: var(--md-doc-bg); border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid var(--md-border); padding: 56px 64px;`.
  - Empty state styling `.md-empty-doc`.
- `packages/ui/src/components/ReadingProgress.tsx`:
  - Thanh tiến độ mỏng 3px cố định ở top, chiều rộng tính theo % scroll của cửa sổ.
- Cập nhật `packages/ui/src/Viewer.tsx`: nhận prop `emptyPlaceholder?: React.ReactNode` hoặc render thông báo trang nhã khi source rỗng.

**Consumes:** `Viewer`, `typography.css`.
**Interfaces:**
```ts
// packages/ui/src/components/ReadingProgress.tsx
export interface ReadingProgressProps {
  color?: string
}
export function ReadingProgress(props: ReadingProgressProps): React.JSX.Element
```
**Tests:** Unit test `ReadingProgress.test.tsx` kiểm tra thanh tiến độ cập nhật width theo scroll event.
**Sizing:** 3 files, ~180 lines diff.

---

## 2i — Top Toolbar & Reading Mode

**Builds:**
- `packages/ui/src/components/TopToolbar.tsx`:
  - Sticky header 48px: Nút menu ToC `[☰]`, Title tài liệu (truncate đẹp), Controls cụm phải:
    - Font scale: `[A-]` `100%` `[A+]` (cho phép chuyển đổi 85% / 100% / 115% / 130%).
    - Theme quick toggle / Accent indicator.
    - Search button `[⌕]`.
    - Reading Mode button `[📖]`.
    - Settings & Export triggers.
- `packages/ui/src/theme/reading-mode.css`:
  - `.reading-mode`: ẩn toolbar, ẩn sidebar, căn giữa document hoàn toàn, hiển thị nút thoát floating tối giản.
- Cập nhật `apps/extension/src/app/App.tsx`: tích hợp `TopToolbar`, state `fontScale` ('sm'|'md'|'lg'|'xl') lưu vào `chrome.storage.sync`, state `isReadingMode: boolean`.

**Consumes:** `ExportModal`, `SettingsModal`, `ThemeProvider`.
**Interfaces:**
```ts
// packages/ui/src/components/TopToolbar.tsx
export type FontScale = 'sm' | 'md' | 'lg' | 'xl'

export interface TopToolbarProps {
  title: string
  tocOpen: boolean
  onToggleToc: () => void
  fontScale: FontScale
  onFontScaleChange: (scale: FontScale) => void
  isReadingMode: boolean
  onToggleReadingMode: () => void
  onOpenSearch: () => void
  rightActions?: React.ReactNode
}
export function TopToolbar(props: TopToolbarProps): React.JSX.Element
```
**Tests:** `TopToolbar.test.tsx` kiểm tra tương tác các nút A-, A+, toggle ToC, reading mode.
**Sizing:** 4 files, ~260 lines diff.

---

## 2j — In-document Search

**Builds:**
- `packages/ui/src/components/DocumentSearch.tsx`:
  - Thanh tìm kiếm nổi (floating bar) ở góc trên bên phải hoặc đè lên toolbar: input tìm kiếm, số lượng `N / M`, nút `↑` (Prev), `↓` (Next), nút `✕` (Close).
  - Phím tắt: `Ctrl/Cmd + F` mở search, `Enter` next, `Shift+Enter` prev, `Esc` đóng.
- `packages/ui/src/components/useDocumentSearch.ts` (hook tìm kiếm & highlight DOM):
  - Nhận container ref của Viewer.
  - Sử dụng `TreeWalker` tìm text node khớp từ khoá, bọc bằng `<mark class="md-search-highlight">` (và `.md-search-active` cho kết quả hiện tại).
  - Tự động scroll đến kết quả active và dọn sạch `<mark>` khi đóng search.
- `packages/ui/src/theme/search.css`: styling cho search bar và `<mark>`.

**Consumes:** `Viewer` container.
**Interfaces:**
```ts
// packages/ui/src/components/DocumentSearch.tsx
export interface DocumentSearchProps {
  isOpen: boolean
  onClose: () => void
  containerRef: React.RefObject<HTMLElement | null>
}
export function DocumentSearch(props: DocumentSearchProps): React.JSX.Element
```
**Tests:** `DocumentSearch.test.tsx` kiểm tra nhập từ khóa, đếm số match, phím next/prev, và clear highlight khi close.
**Sizing:** 4 files, ~270 lines diff.

---

## 2k — Elements: Code copy & Tables

**Builds:**
- `packages/ui/src/components/CodeBlockWrapper.tsx` (hoặc Viewer post-mount wrapper):
  - Tự động nhận diện các khối `<pre><code>` trong Viewer, chèn header thanh mảnh hiển thị language (ví dụ: `javascript`, `python`) và nút `Copy`.
  - Click Copy gọi `navigator.clipboard.writeText`, hiển thị `Copied ✓` trong 1.5 giây.
- `packages/ui/src/theme/table-enhanced.css`:
  - Table header: `background: var(--md-accent); color: #ffffff; font-weight: 600; padding: 12px 16px;`.
  - Table container: `overflow-x: auto; display: block; border-radius: 8px; border: 1px solid var(--md-border);`.
  - Zebra striping: `tbody tr:nth-child(even) { background-color: rgba(0, 0, 0, 0.02); }` (hoặc rgba(255,255,255,0.03) ở dark mode).
  - Task list checkbox styling tinh tế.

**Consumes:** `Viewer`, `typography.css`.
**Interfaces:**
```ts
// packages/ui/src/components/CodeCopyButton.tsx
export function CodeCopyButton({ code }: { code: string }): React.JSX.Element
```
**Tests:** `CodeCopy.test.tsx` kiểm tra copy code vào clipboard và đổi text sang `Copied ✓`.
**Sizing:** 3 files, ~200 lines diff.

---

## 2l — ToC Navigation & Font Family

**Builds:**
- Nâng cấp `packages/ui/src/Toc.tsx`:
  - Hỗ trợ gập/mở (collapsible) theo cấp cha con (H1 -> H2/H3).
  - Highlight active heading với dải accent bar bên trái.
  - Smooth scroll khi click heading kèm bù trừ offset của Top Toolbar (`scroll-margin-top: 64px`).
- Cập nhật `packages/ui/src/theme/typography.css`:
  - Khai báo 3 font family: Sans-serif (`--md-font-sans`), Serif (`--md-font-serif`), Monospace (`--md-font-mono`).
- Cập nhật `packages/ui/src/components/SettingsModal.tsx`:
  - Thêm lựa chọn Font Family (Sans-serif, Serif, Monospace).

**Consumes:** `Toc`, `SettingsModal`, `typography.css`.
**Interfaces:**
```ts
export type FontFamily = 'sans' | 'serif' | 'mono'
```
**Tests:** `Toc.test.tsx` bổ sung test collapsible hierarchy và active section indicator.
**Sizing:** 4 files, ~240 lines diff.

---

## 2m — E2E UX & Reading Smoke

**Builds:**
- `apps/extension/e2e/ux-reading.spec.ts`:
  - Render App với tài liệu mẫu dài có Headings H1-H3, Code blocks, Bảng biểu.
  - Kiểm tra giao diện A4 container và thanh Reading Progress khi cuộn.
  - Kiểm tra Top Toolbar: thay đổi font scale (A-, A+) cập nhật kích thước chữ.
  - Kiểm tra In-document Search: nhấn `Cmd+F` hoặc click Search, gõ từ khoá, kiểm tra highlight và match count.
  - Kiểm tra Code Copy: click Copy hiển thị `Copied ✓`.
  - Kiểm tra ToC gập/mở và chuyển đổi font family trong Settings.

**Consumes:** Toàn bộ ứng dụng đã tích hợp 2h - 2l.
**Sizing:** 1 file, ~180 lines.
