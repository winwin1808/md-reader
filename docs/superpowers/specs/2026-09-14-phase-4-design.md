# Design: Phase 4 — Cài đặt Mở rộng, Reading Aids & Rich Rendering Suite
Author: Antigravity. Status: designed. Phase: 4
Intent: docs/superpowers/intent/2026-09-14-phase-4-extended-settings.md

## Sub-phase queue

| # | Phase con | Trạng thái |
|---|---|---|
| 4a | `core/rendering-options` | pending |
| 4b | Reading Aids UI (`WordCountBar`, `CelebrationConfetti`) | pending |
| 4c | Presentation Customization in `Deck` | pending |
| 4d | SettingsModal Revamp (Tabbed Layout & Sections) | pending |
| 4e | Extension Integration & E2E Verification | pending |

## Approach chosen

1. **Parser & Rendering Options in Core (`core/rendering-options`):**
   - *Lựa chọn:* Mở rộng `renderToHtml(parsed, options?: RenderOptions)` trong `@md-reader/core`.
     - Frontmatter: Tách YAML metadata; nếu `stripFrontmatter: true` loại bỏ khỏi văn bản; nếu `displayMetadata: true` sinh metadata card HTML trang nhã ở đầu bài.
     - Typographer: Thay thế các ký tự phổ biến `(c)` → `©`, `(tm)` → `™`, `--` → `–`, `---` → `—`, và smart quotes uốn lượn (“ ”, ‘ ’) trong các text node (bảo vệ text trong code block và math).
     - GitHub Alerts: Nhận diện `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`, chuyển thành div `.markdown-alert .markdown-alert-{type}` kèm svg icon và tiêu đề theo ngôn ngữ được chọn.
     - External Links: Tự động phát hiện thẻ `<a>` có href bắt đầu bằng `http://` hoặc `https://`, gắn class `external-link` và icon chỉ báo liên kết ngoài.
   - *Phương án loại bỏ:* Không tích hợp các plugin cồng kềnh ngoài unified để giữ kích thước gói core siêu nhẹ và tốc độ parse tức thì.

2. **Reading Aids Components (`WordCountBar`, `CelebrationConfetti`):**
   - *Lựa chọn:*
     - `WordCountBar`: Component React thanh công cụ nổi ở góc dưới hoặc cố định chân trang. Thống kê từ, ký tự và tính reading time (`Math.ceil(words / 200)` phút). Lắng nghe sự kiện scroll trên container tài liệu; khi cuộn gần chạm đáy (còn < 120px hoặc > 90% chiều cao) tự động mờ dần/ẩn đi (`auto-hide`).
     - `CelebrationConfetti`: Hiệu ứng chúc mừng confetti bằng Canvas HTML5 siêu nhẹ (tự viết bằng requestAnimationFrame không cần thư viện nặng). Kích hoạt 1 lần khi người đọc cuộn chạm 100% đáy tài liệu nếu bật tính năng.
   - *Phương án loại bỏ:* Không kéo thư viện `canvas-confetti` ngoài (tiết kiệm bundle).

3. **Presentation Customization (`Deck`):**
   - *Lựa chọn:* Cho phép truyền prop `presentationSettings` vào `Deck`:
     - `slideBgColor`, `slideTextColor`, `slideHeadingColor`, `slideAccentColor`, `slideFont`, `slideBgImage`, `slideImageOpacity`.
     - Các giá trị này được áp dụng trực tiếp thông qua CSS variables hoặc inline styles vào `.deck-slide` và `.deck-overlay`.

4. **SettingsModal Revamp:**
   - *Lựa chọn:* Chuyển đổi `SettingsModal` từ danh sách phẳng sang bố cục Tab dọc/ngang 5 nhóm chức năng:
     1. Giao diện (Theme, ColorTheme, Font Scale, Font Family, Auto Format).
     2. Core Rendering (Front Matter, Metadata Card, Tables, Task Lists).
     3. Nội dung & Sơ đồ (Math, Mermaid, PlantUML, Graphviz, GitHub Alerts, Localize Alert Titles).
     4. Hỗ trợ đọc (Typographer, External Links, Word Count, Auto-hide Word Count, Reading Progress, Confetti).
     5. Trình chiếu (Colors, Font, Background Image, Opacity).

---

## 4a — `core/rendering-options` (done)

**Builds:**
- Mở rộng `packages/core/src/render/`:
  - `types.ts`:
    ```ts
    export interface RenderOptions {
      stripFrontmatter?: boolean // default: true
      displayMetadata?: boolean // default: false
      typographer?: boolean // default: false
      externalLinks?: boolean // default: false
      githubAlerts?: boolean // default: true
      taskLists?: boolean // default: true
      enableMath?: boolean // default: true
      enableMermaid?: boolean // default: true
      localizeAlerts?: string // default: 'en'
    }
    ```
  - Cập nhật `renderToHtml(parsed: ParseResult, options?: RenderOptions): RenderResult`
  - Transformer xử lý:
    - Typographer thay thế smart quotes và ký tự typography.
    - GitHub Alerts bóc tách blockquote `[!NOTE]`, `[!TIP]`, v.v.
    - External links gắn `external-link` class và SVG icon.
    - Metadata card render khi `displayMetadata` bật.
- **Tests:** `packages/core/src/render/render-options.test.ts`.
- **Sizing:** 4 files, ~260 lines diff, 1 new test file.

---

## 4b — Reading Aids UI (done)

**Builds:**
- `packages/ui/src/components/WordCountBar.tsx`:
  - Props: `text: string`, `visible?: boolean`, `autoHide?: boolean`, `scrollElementRef?: React.RefObject<HTMLElement | null>`.
  - Hiển thị: `{words} từ · {chars} ký tự · {readTime} phút đọc`.
- `packages/ui/src/components/CelebrationConfetti.tsx`:
  - Canvas 2D confetti nhẹ nhàng bắn pháo giấy khi trigger.
- `packages/ui/src/theme/reading-aids.css`: Styling thanh word count, external link icons, và alerts.
- **Tests:** `packages/ui/src/components/WordCountBar.test.tsx` và `CelebrationConfetti.test.tsx`.
- **Sizing:** 5 files, ~270 lines diff, 1 new test file.

---

## 4c — Presentation Customization in `Deck`

**Builds:**
- Cập nhật `packages/ui/src/components/Deck.tsx`:
  - Mở rộng `DeckProps` nhận `presentationSettings?: PresentationSettings`.
  - Áp dụng background color, text color, heading color, accent color, slide font, background image & opacity.
- Cập nhật `packages/ui/src/theme/deck.css`.
- **Tests:** `packages/ui/src/components/Deck.test.tsx`.
- **Sizing:** 3 files, ~180 lines diff, 0 new test files.

---

## 4d — SettingsModal Revamp

**Builds:**
- Cập nhật `packages/ui/src/components/SettingsModal.tsx`:
  - Chuyển thành giao diện 5 tab với navigation icons / labels.
  - Quản lý đầy đủ các nhóm toggle / input:
    - Core Rendering, Media & Diagrams, Reading Aids, Presentation.
  - Nút đóng, backdrop blur, hỗ trợ lưu thay đổi.
- **Tests:** `packages/ui/src/components/SettingsModal.test.tsx`.
- **Sizing:** 3 files, ~280 lines diff, 0 new test files.

---

## 4e — Extension Integration & E2E Verification

**Builds:**
- Cập nhật `apps/extension/src/app/App.tsx`:
  - Đọc và lưu trữ toàn bộ options qua `chrome.storage.sync`.
  - Truyền `renderOptions` vào `renderToHtml`.
  - Render `WordCountBar` và `CelebrationConfetti`.
  - Nối presentation settings vào `Deck`.
- Cập nhật `apps/extension/src/app/App.test.tsx` và `apps/extension/e2e/ux-reading.spec.ts`.
- **Sizing:** 4 files, ~260 lines diff, 0 new test files.
