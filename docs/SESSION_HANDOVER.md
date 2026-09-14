# Session Handover — md-reader

Cập nhật: 2026-09-14 (phiên 8). Branch đang đứng: `main`.

## Đang ở đâu

**Phase 4 (Cài đặt Mở rộng, Reading Aids & Rich Rendering Suite) đã hoàn tất toàn bộ 5/5 phase con và merged vào `main`!**

| # | Phase con | Trạng thái |
|---|---|---|
| 4a | `core/rendering-options` (RenderOptions, typographer, alerts, external links, frontmatter) | ✅ done |
| 4b | Reading Aids UI (`WordCountBar`, `CelebrationConfetti`, `reading-aids.css`) | ✅ done |
| 4c | Presentation Customization in `Deck` (colors, font, bg image, opacity) | ✅ done |
| 4d | SettingsModal Revamp (5 tabs layout: Display, Core, Media, Reading, Presentation) | ✅ done |
| 4e | Extension Integration & E2E (`chrome.storage.sync` persistence, App.tsx wiring) | ✅ done |

Specs & Intent tương ứng:
- `docs/superpowers/intent/2026-09-14-phase-4-extended-settings.md`
- `docs/superpowers/specs/2026-09-14-phase-4-design.md`

## Trạng thái xanh lúc dừng (đo thật, không phải nhớ)

```
pnpm --filter core test        10 test files, 112 passed
pnpm --filter ui test          18 test files, 137 passed
pnpm --filter extension test   8 test files, 29 passed
Tổng cộng                      36 test files, 278 passed
pnpm -r typecheck              exit 0
pnpm -r build                  exit 0
dist/content.js                25.77 kB, gz 10.04 kB (giới hạn 61.44 kB / 60KB)
```

## Tính năng đã hoàn tất

1. **Tab 1: Giao diện (Display)**
   - Chế độ sáng / tối / theo hệ thống (`mode: 'light' | 'dark' | 'system'`).
   - 5 chủ đề màu (`github`, `dracula`, `nord`, `sepia`, `solarized-dark`).
   - Kiểu phông chữ (Sans-serif, Serif, Monospace).
   - Tự động mở file Markdown (`autoFormatMd`).
2. **Tab 2: Core Rendering**
   - Front Matter: Loại bỏ YAML frontmatter (`stripFrontmatter`).
   - Display Metadata: Hiển thị card metadata ở đầu bài viết (`displayMetadata`).
   - Advanced Tables: Multiline cells, rowspan, headerless tables (`advancedTables`).
   - Task Lists: Checkboxes định dạng GitHub task lists (`taskLists`).
3. **Tab 3: Nội dung & Sơ đồ (Media & Diagrams)**
   - Math Equations: LaTeX math equations inline `$...$` & display `$$...$$` (`enableMath`).
   - Mermaid Diagrams: Lưu đồ, sequence, class diagrams (`enableMermaid`).
   - PlantUML Diagrams: Sơ đồ PlantUML qua public server kèm xác nhận consent (`enablePlantUml`).
   - Graphviz Diagrams: DOT-language graphs render WebAssembly nội bộ (`enableGraphviz`).
   - GitHub Alerts: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` với icon SVG & màu sắc chuẩn (`githubAlerts`).
   - Localize Alert Titles: Hiển thị tiêu đề alert song ngữ Việt/Anh (`localizeAlerts`).
4. **Tab 4: Hỗ trợ đọc (Reading Aids)**
   - Typographer: Tự động chuyển đổi `(c)` → `©`, `(tm)` → `™`, `--` → `–`, `---` → `—`, và smart quotes (“ ”, ‘ ’) an toàn trên text nodes (`typographer`).
   - External Link Indicators: Nhận diện link ngoài, mở tab mới và đính kèm SVG indicator (`externalLinks`).
   - Show word count: Thanh pill hiển thị số từ, số ký tự và thời gian đọc ước tính (`showWordCount`).
   - Auto-hide word count: Tự động ẩn thanh khi cuộn gần cuối trang (`autoHideWordCount`).
   - Show reading progress: Thanh tiến độ đọc 3px trên đỉnh trang (`showReadingProgress`).
   - Celebration animation: Pháo giấy confetti Canvas 2D rực rỡ khi đọc hết tài liệu (`celebrationConfetti`).
5. **Tab 5: Trình chiếu (Presentation Mode)**
   - Background Color: Tùy chỉnh màu nền slide (`slideBgColor`).
   - Text Color: Tùy chỉnh màu chữ (`slideTextColor`).
   - Heading Color: Tùy chỉnh màu tiêu đề H1-H4 (`slideHeadingColor`).
   - Accent Color: Màu nhấn cho liên kết, progress bar (`slideAccentColor`).
   - Slide Font: Phông chữ riêng cho bài thuyết trình (`slideFont`).
   - Background Image URL: Hình nền tùy chọn từ URL (`slideBgImage`).
   - Image Opacity: Độ mờ hình nền 0% - 100% (`slideImageOpacity`).
