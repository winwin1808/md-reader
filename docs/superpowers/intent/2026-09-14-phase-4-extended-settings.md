# Intent: Phase 4 — Cài đặt Mở rộng, Reading Aids & Rich Rendering Suite
Author: Antigravity. Status: draft. Phase: 4

## Problem
Hiện tại MD Reader đã có trải nghiệm đọc A4 xuất sắc, hệ thống export đa dạng và chế độ Presentation hoàn chỉnh. Tuy nhiên, các tuỳ chọn tuỳ biến cho việc đọc sâu, hỗ trợ đọc (Reading Aids), phong cách hiển thị nội dung (Core Rendering, Math, Diagrams, GitHub Alerts, Typographer), cũng như khả năng cá nhân hoá giao diện trình chiếu (màu sắc, ảnh nền, font) vẫn chưa được mở rộng đầy đủ trong bảng cài đặt (Settings).

## Proposed outcome
Người dùng có bảng Settings đa mục (Tabbed/Sectioned modal) cho phép tinh chỉnh toàn diện:
1. **Core Rendering & Metadata**:
   - Strip YAML front matter (`---`) hoặc hiển thị formatted Metadata card ở đầu trang.
   - Hỗ trợ Advanced Tables (multiline cells, rowspan, headerless tables) và GitHub task lists (checkboxes).
2. **Content & Media**:
   - Bật/tắt KaTeX Math Equations ($...$ inline, $$...$$ display).
   - Bật/tắt Mermaid diagrams.
   - Hỗ trợ PlantUML diagrams qua public diagram server kèm hộp thoại xác nhận đồng thuận (consent).
   - Render đồ thị Graphviz DOT cục bộ.
   - GitHub Alerts blockquote (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) với biểu tượng và tuỳ chọn bản địa hoá tiêu đề (Localize Alert Titles).
3. **Reading Aids**:
   - Typographer: tự động chuyển đổi `(c)` → `©`, `(tm)` → `™`, `--` → `–`, `---` → `—`, và smart quotes uốn lượn.
   - External Link Indicators: icon chỉ báo link ra ngoài trang.
   - Word count bar: hiển thị số từ, số ký tự và thời gian đọc ước tính; có tuỳ chọn tự động ẩn khi cuộn gần đáy trang.
   - Toggle hiển thị Reading progress bar ở đỉnh trang.
   - Hiệu ứng Celebration confetti khi đọc hết tài liệu.
4. **Presentation Mode Settings**:
   - Tuỳ biến Background Color, Text Color, Heading Color, Accent Color, Font slide, Background Image URL và Image Opacity.

## Affected packages
- `packages/core`: parser hooks, typographer transform, metadata extractor, GitHub alerts parser, diagrams/math hooks.
- `packages/ui`: `WordCountBar`, `CelebrationConfetti`, cập nhật `SettingsModal` đa tabs, cập nhật `Deck` với custom style/background, alerts styling, external link icons.
- `apps/extension`: lưu trữ đồng bộ cài đặt vào `chrome.storage.sync`, kết nối các props và handlers vào `App.tsx`.

## Constraints
- Tuân thủ ranh giới package: `packages/core` thuần TS, `packages/ui` thuần React/CSS, `apps/extension` duy nhất dùng `chrome.*`.
- Ngân sách content script ≤ 60KB gz (hiện tại 10.14KB gz).
- Confetti và PlantUML không làm vỡ bảo mật CSP (PlantUML cần explicit user consent).

## Sub-phases
| # | Phase con | Xong nghĩa là |
|---|---|---|
| 4a | `core/rendering-options` | Parser hỗ trợ options: frontmatter strip/metadata, typographer, github alerts, tasklist, external links |
| 4b | Reading Aids UI | `WordCountBar` (words, chars, reading time, auto-hide), `CelebrationConfetti` animation, progress toggle |
| 4c | Presentation Customization | `Deck` hỗ trợ custom colors (bg, text, heading, accent), custom font, background image & opacity |
| 4d | SettingsModal Revamp | Bảng Settings dạng tab phân chia rõ ràng: Display, Core Rendering, Media & Diagrams, Reading Aids, Presentation |
| 4e | Extension Integration & E2E | Lưu `chrome.storage.sync`, wire toàn bộ options vào `App.tsx` & `Viewer`, smoke tests xanh |
