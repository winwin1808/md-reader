const fs = require('fs')

// Update Intent
let intent = fs.readFileSync('docs/superpowers/intent/2026-09-11-phase-2-export.md', 'utf8')
intent = intent.replace(
  /## Proposed outcome/,
  `## Proposed outcome
- Bổ sung bộ Typography chuẩn và 5 bộ Theme màu (Midnight Navy, Evergreen, Burnt Sienna, Deep Rose, Obsidian/Ivory).
- Tối ưu UI hiện tại (2a-opt): Bố cục layout có sidebar chứa Table of Content, gom tất cả tuỳ chọn màu sắc/light-dark vào 1 nút Settings (icon). Có tuỳ chọn bật/tắt tự động format file .md.`
)
intent = intent.replace(
  /\| 2a \| Typography \& Themes \| Bổ sung typography cho Viewer, UI chọn 5 theme màu, lưu trạng thái theme. \|/,
  `| 2a | Typography & Themes | Bổ sung typography cho Viewer, UI chọn 5 theme màu, lưu trạng thái theme. |\n| 2a-opt | UI Layout & Settings | Layout 2 cột (Viewer + ToC), gom Settings vào popover, tuỳ chọn auto-format |`
)
fs.writeFileSync('docs/superpowers/intent/2026-09-11-phase-2-export.md', intent)

// Update DESIGN.md
let design = fs.readFileSync('docs/DESIGN.md', 'utf8')
design = design.replace(
  /\| 2a \| Typography \& Themes \| Bổ sung typography cho Viewer, UI chọn 5 theme màu, lưu trạng thái theme. \|/,
  `| 2a | Typography & Themes | Bổ sung typography cho Viewer, UI chọn 5 theme màu, lưu trạng thái theme. |\n| 2a-opt | UI Layout & Settings | Layout 2 cột (Viewer + ToC), gom Settings vào popover, tuỳ chọn auto-format |`
)
fs.writeFileSync('docs/DESIGN.md', design)

// Update Spec
let spec = fs.readFileSync('docs/superpowers/specs/2026-09-11-phase-2-design.md', 'utf8')
spec = spec.replace(
  /\| 2a \| Typography \& Themes \| done \|/,
  `| 2a | Typography & Themes | done |\n| 2a-opt | UI Layout & Settings | pending |`
)

spec += `
## 2a-opt — UI Layout & Settings

**Builds:** 
- \`packages/ui/src/components/SettingsPopover.tsx\` (gom ThemePicker và switch auto-format vào đây).
- \`apps/extension/src/app/App.tsx\` (Sửa layout thành dạng 2 cột: Main content và Sidebar ToC).
- Cập nhật logic worker/content-script để tôn trọng tuỳ chọn auto-format.

**Consumes:** Viewer, Toc, ThemePicker.
**Interfaces:**
- Thêm biến \`autoFormatMd: boolean\` vào \`chrome.storage.sync\`.
- Layout: \`<div className="app-container"><main className="content"><Viewer /></main><aside className="sidebar"><Toc /></aside></div>\`.
**Sizing:** 3 file, ~200 dòng.
`
fs.writeFileSync('docs/superpowers/specs/2026-09-11-phase-2-design.md', spec)
