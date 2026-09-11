# Design: Phase 2 — Export & Themes
Author: Antigravity. Status: designed. Phase: 2
Intent: docs/superpowers/intent/2026-09-11-phase-2-export.md

## Sub-phase queue

| # | Phase con | Trạng thái |
|---|---|---|
| 2a | Typography & Themes | done |
| 2a-opt | UI Layout & Settings | done |
| 2a-ux | Typography, Spacing & ToC Polish | done |
| 2b | HTML self-contained | done |
| 2c | mdast → docx | done |
| 2d | SVG → PNG | done |
| 2e | Print CSS + PDF | done |
| 2f | ExportDialog | pending |
| 2g | E2E khói | pending |

## Approach chosen

**Themes:**
Tạo CSS class cho mỗi theme (e.g., `.theme-midnight-navy`, `.theme-evergreen`). Khai báo CSS variables trong các class này để thay thế `--md-bg`, `--md-fg`, `--md-border`... `ThemeProvider` sẽ nhận thêm prop `colorTheme`.
Giao diện `ThemePicker` sẽ liệt kê 5 theme dựa trên các mã màu Hex. Trạng thái lưu tại `chrome.storage.sync`.

**Export HTML:**
Sử dụng hàm của `packages/core` nhận vào raw HTML, parse qua để tìm các thẻ `<img>`. Fetch các URL ảnh rồi gán lại base64 vào thuộc tính `src`. Nhúng nội dung file CSS (bao gồm theme hiện tại) trực tiếp vào thẻ `<style>`.

**Export docx:**
Dựa vào thư viện `docx` npm package. Convert mdast tree thành các node Paragraph, TextRun, Table. Ảnh tải bằng buffer và nhúng bằng ImageRun.

**Export PDF:**
Mở URL đặc biệt hoặc dùng `window.print()` trên app page với `@media print` CSS. 

## 2a — Typography & Themes

**Builds:** 
- `packages/ui/src/theme/typography.css` (bổ sung font chữ, margin, blockquote, table, code block styling chuẩn).
- `packages/ui/src/theme/color-themes.css` (khai báo CSS variables cho 5 theme: Midnight Navy, Evergreen, Burnt Sienna, Deep Rose, Obsidian/Ivory).
- `packages/ui/src/theme/ThemePicker.tsx` (danh sách 5 nút chọn màu).
- Cập nhật `ThemeProvider` và `App.tsx`.

**Consumes:** `Viewer` và `App.tsx` từ Phase 1.
**Interfaces:**
```ts
// @md-reader/ui
export type ColorTheme = 'navy' | 'green' | 'orange' | 'pink' | 'black'
// ThemeProvider nhận thêm:
export interface ThemeProviderProps {
  mode: 'light' | 'dark' | 'system'
  colorTheme?: ColorTheme // Mặc định 'black' (Obsidian/Ivory)
  onColorThemeChange?: (theme: ColorTheme) => void
  // ...
}
```
**Errors:** Không có lỗi nghiêm trọng (fallback sang theme mặc định).
**Tests:** `ThemePicker.test.tsx` đảm bảo click đổi theme gọi callback.
**Sizing:** ~4 file, ~150 dòng.

## 2b — HTML self-contained

**Builds:** 
- `packages/core/src/export/html.ts`

**Consumes:** HTML string sinh ra từ renderToHtml, chuỗi CSS của theme.
**Interfaces:**
```ts
// @md-reader/core
export interface ExportHtmlOptions {
  html: string
  cssContent: string
  title: string
}
// Quét thẻ <img> trong html, fetch url thành base64. 
export async function exportToHtml(options: ExportHtmlOptions): Promise<string>
```
**Errors:** Fetch ảnh thất bại -> Bỏ qua lỗi và giữ nguyên URL gốc, log cảnh báo.
**Tests:** Test hàm chuyển ảnh sang base64 trên 1 thẻ `<img src="mock">`.
**Sizing:** ~2 file, ~100 dòng.

## 2c — mdast → docx

**Builds:** 
- `packages/core/src/export/docx.ts`
- Cài đặt `docx` package.

**Consumes:** Root mdast (1c1).
**Interfaces:**
```ts
// @md-reader/core
import { Document } from 'docx'
import type { Root } from 'mdast'
export interface ExportDocxOptions {
  mdast: Root
  title?: string
  imageMap?: Record<string, { buffer: ArrayBuffer, width: number, height: number }>
}
export async function mdastToDocx(options: ExportDocxOptions): Promise<Blob>
```
**Errors:** Thẻ không hỗ trợ -> Fallback thành text thuần.
**Tests:** Convert 1 document đơn giản (heading, text, list) ra Blob thành công.
**Sizing:** ~3 file, ~250 dòng.

## 2d — SVG → PNG

**Builds:** 
- `packages/ui/src/export/rasterize.ts`

**Consumes:** Chuỗi SVG.
**Interfaces:**
```ts
// @md-reader/ui
export async function rasterizeSvg(svgString: string): Promise<{ buffer: ArrayBuffer, width: number, height: number }>
```
**Errors:** Canvas lỗi -> Bắn lỗi để bước docx xử lý.
**Tests:** Jsdom với fake canvas (hoặc bỏ qua render thực tế, chỉ mock).
**Sizing:** 2 file, ~50 dòng.

## 2e — Print CSS + PDF

**Builds:** 
- `packages/ui/src/print.css`

**Consumes:** DOM hiện tại.
**Interfaces:** Khai báo `@media print` làm ẩn Sidebar, reset nền thành trắng, đổi chữ thành đen. Thêm `window.print()` vào context.
**Sizing:** 1 file, ~30 dòng.

## 2f — ExportDialog

**Builds:** 
- `packages/ui/src/components/ExportDialog.tsx`

**Consumes:** Các hàm export từ 2b, 2c, 2d.
**Interfaces:** Dialog React hiển thị 3 lựa chọn (HTML, PDF, Word). Nút "Download".
**Sizing:** 2 file, ~100 dòng.

## 2g — E2E khói

**Builds:** 
- `apps/extension/e2e/export.spec.ts`

**Consumes:** Ứng dụng đã hoàn chỉnh.
**Sizing:** 1 file, ~80 dòng.

## 2a-opt — UI Layout & Settings

**Builds:** 
- `packages/ui/src/components/SettingsModal.tsx` (gom ThemePicker và switch auto-format vào đây).
- `apps/extension/src/app/App.tsx` (Sửa layout thành dạng 2 cột: Main content và Sidebar ToC).
- Cập nhật logic worker/content-script để tôn trọng tuỳ chọn auto-format.

**Consumes:** Viewer, Toc, ThemePicker.
**Interfaces:**
- Thêm biến `autoFormatMd: boolean` vào `chrome.storage.sync`.
- Layout: `<div className="app-container"><main className="content"><Viewer /></main><aside className="sidebar"><Toc /></aside></div>`.
**Sizing:** 3 file, ~200 dòng.

## 2a-ux — Typography, Spacing & ToC Polish

**Builds:**
- `packages/ui/src/theme/typography.css`: 17px base, 1.7 line-height, H1-H6 scale (36px, 28px, 22px, 18px, 16px, 14px), 24px paragraph spacing, scroll-margin-top.
- `apps/extension/src/app/app.css`: 740px measure column, 260px ToC, 56px gap, 180px bottom overscroll breathing room.
- `packages/ui/src/Toc.tsx`: Modern navigation rail without bullet points, depth indentation, active left border indicator, hover background.
- `packages/ui/src/components/SettingsModal.tsx`: Backdrop blur 8px, 16px border-radius, box-shadow, floating gear button styling.

**Sizing:** 4 files, ~250 lines.
