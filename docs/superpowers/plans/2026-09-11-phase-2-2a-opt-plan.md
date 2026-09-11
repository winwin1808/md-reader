# Plan: Phase 2 — Sub-phase 2a-opt
Author: Antigravity. Status: planned. Phase: 2. Sub-phase: 2a-opt
Spec: docs/superpowers/specs/2026-09-11-phase-2-design.md
BranchPoint: HEAD

## Tasks

### [ ] 2a-opt-1 — Settings Popover UI
FILES       packages/ui/src/components/SettingsPopover.tsx, packages/ui/src/components/SettingsPopover.test.tsx, packages/ui/src/index.ts
INTERFACES  
```ts
export interface SettingsPopoverProps {
  // Pass in the ThemePicker element or render it inside
  themePicker: React.ReactNode
  autoFormat: boolean
  onAutoFormatChange: (val: boolean) => void
}
export function SettingsPopover(props: SettingsPopoverProps): React.JSX.Element
```
INVARIANTS  
- Component có một nút bấm Icon (dùng SVG bánh răng). Khi bấm mở ra popover/dropdown chứa `themePicker` và một checkbox/switch cho `Auto-format .md files`.
TEST        `pnpm --filter @md-reader/ui test src/components/SettingsPopover.test.tsx`
COMMIT      feat(ui): add SettingsPopover component

### [ ] 2a-opt-2 — App Layout and Settings Integration
FILES       apps/extension/src/app/App.tsx, apps/extension/src/app/app.css, apps/extension/src/app/App.test.tsx
INTERFACES  
- Cập nhật `App.tsx` sử dụng grid/flex layout có 2 cột: Cột trái (hoặc chính giữa) chứa `Viewer`, cột phải chứa `Toc`.
- Import và đặt `SettingsPopover` ở góc trên cùng. Load/lưu state `autoFormatMd` từ `chrome.storage.sync`.
- Nếu chưa có `autoFormatMd`, mặc định là `true`.
INVARIANTS  
- `app.css` thêm class cho layout (`.app-layout`, `.main-content`, `.sidebar-toc`). Design gọn gàng hiện đại, có khoảng trắng tốt (padding/max-width). ToC nên sticky (cố định khi cuộn).
TEST        `pnpm --filter @md-reader/extension test src/app/App.test.tsx`
COMMIT      feat(extension): update modern UI layout with sidebar and settings

### [ ] 2a-opt-3 — Auto-format content script toggle
FILES       apps/extension/src/content/index.ts
INTERFACES  
- Trước khi chèn iframe/UI đè lên trang markdown, content script phải check `chrome.storage.sync.get('autoFormatMd')`.
- Nếu false, không làm gì cả (trả lại trang text thuần cho trình duyệt). Nếu true (hoặc undefined), chạy tiếp logic tiêm Markdown Reader.
INVARIANTS  
- Phải fetch storage bất đồng bộ `await chrome.storage.sync.get(...)` ở đầu hàm chạy content script.
TEST        (Test thủ công qua build vì content script khó test DOM)
COMMIT      feat(extension): respect autoFormatMd setting in content script
