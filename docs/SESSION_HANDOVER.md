# Session Handover — md-reader

Cập nhật: 2026-09-14 (phiên 7). Branch đang đứng: `main`.

## Đang ở đâu

**Phase 3 (Trình chiếu / Slides) đã hoàn tất toàn bộ 5/5 phase con và merged vào `main`!**

| # | Phase con | Trạng thái |
|---|---|---|
| 3a | `core/slides` (Smart slide splitting & speaker notes) | ✅ done |
| 3b | `Deck` UI (16:9 Presentation overlay & keyboard nav) | ✅ done |
| 3c | `SpeakerView` UI (Diễn giả, realtime clock, timer & preview) | ✅ done |
| 3d | App Integration & Speaker Sync (`BroadcastChannel`) | ✅ done |
| 3e | Deck → PDF Export (Landscape `@page slide-deck`, `printSlides`) | ✅ done |

Specs tương ứng:
- `docs/superpowers/specs/2026-09-14-phase-3-design.md` (Trình chiếu & Slides)

## Trạng thái xanh lúc dừng (đo thật, không phải nhớ)

```
pnpm --filter core test        9 test files, 97 passed
pnpm --filter ui test          17 test files, 124 passed
pnpm --filter extension test   8 test files, 26 passed
Tổng cộng                      34 test files, 247 passed
pnpm -r typecheck              exit 0
pnpm -r build                  exit 0
dist/content.js                25.77 kB, gz 10.14 kB (giới hạn 61.44 kB / 60KB)
```

## Chạy tiếp thế nào

Phase 3 đã ship trọn vẹn vào `main`. Tiếp theo là triển khai cụm tính năng **Settings Mở rộng & Reading Aids** theo yêu cầu mới nhất của người dùng:
1. **Settings Modal Tabs / Sections**:
   - **Core Rendering**: Front Matter (strip YAML frontmatter), Display Metadata (card đầu trang), Advanced Tables (multiline, rowspan), Task Lists.
   - **Content & Media**: Math Equations (LaTeX), Mermaid Diagrams, PlantUML Diagrams (server public + consent), Graphviz Diagrams (DOT Wasm), GitHub Alerts, Localize Alert Titles.
   - **Reading Aids**: Typographer (`©`, `™`, `–`, `—`, smart quotes), External Link Indicators, Word count & Reading time (auto-hide cuối trang), Reading progress bar toggle, Celebration animation (confetti khi đọc hết bài).
   - **Presentation Settings**: Slide Background Color, Text Color, Heading Color, Accent Color, Font, Background Image URL, Image Opacity.

