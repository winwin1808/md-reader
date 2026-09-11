# Plan: Phase 2 — Sub-phase 2a-opt
Author: Antigravity. Status: built. Phase: 2. Sub-phase: 2a-opt
Spec: docs/superpowers/specs/2026-09-11-phase-2-design.md
BranchPoint: HEAD

## Tasks

### [x] 2a-opt-1 — Settings Popover UI
FILES       packages/ui/src/components/SettingsModal.tsx, packages/ui/src/components/SettingsModal.test.tsx, packages/ui/src/index.ts
INTERFACES  
```ts
export interface SettingsModalProps {
  // Pass in the ThemePicker element or render it inside
  themePicker: React.ReactNode
  autoFormat: boolean
  onAutoFormatChange: (val: boolean) => void
}
export function SettingsModal(props: SettingsModalProps): React.JSX.Element
```
INVARIANTS  
- Component có một nút bấm Icon (dùng SVG bánh răng). Khi bấm mở ra modal (hộp thoại) chứa `themePicker` và một checkbox/switch cho `Auto-format .md files`.
TEST        `pnpm --filter @md-reader/ui test src/components/SettingsModal.test.tsx`
COMMIT      feat(ui): add SettingsModal component

### [x] 2a-opt-2 — App Layout and Settings Integration
FILES       apps/extension/src/app/App.tsx, apps/extension/src/app/app.css, apps/extension/src/app/App.test.tsx
INTERFACES  
- Cập nhật `App.tsx` sử dụng grid/flex layout có 2 cột: Cột trái (hoặc chính giữa) chứa `Viewer`, cột phải chứa `Toc`.
- Import và đặt `SettingsModal` ở góc trên cùng. Load/lưu state `autoFormatMd` từ `chrome.storage.sync`.
- Nếu chưa có `autoFormatMd`, mặc định là `true`.
INVARIANTS  
- `app.css` thêm class cho layout (`.app-layout`, `.main-content`, `.sidebar-toc`). Design gọn gàng hiện đại, có khoảng trắng tốt (padding/max-width). ToC nên sticky (cố định khi cuộn).
TEST        `pnpm --filter @md-reader/extension test src/app/App.test.tsx`
COMMIT      feat(extension): update modern UI layout with sidebar and settings

### [x] 2a-opt-3 — Auto-format content script toggle
FILES       apps/extension/src/content/index.ts
INTERFACES  
- Trước khi chèn iframe/UI đè lên trang markdown, content script phải check `chrome.storage.sync.get('autoFormatMd')`.
- Nếu false, không làm gì cả (trả lại trang text thuần cho trình duyệt). Nếu true (hoặc undefined), chạy tiếp logic tiêm Markdown Reader.
INVARIANTS  
- Phải fetch storage bất đồng bộ `await chrome.storage.sync.get(...)` ở đầu hàm chạy content script.
TEST        (Test thủ công qua build vì content script khó test DOM)
COMMIT      feat(extension): respect autoFormatMd setting in content script

## Handoff Notes
- **2a-opt-1**: No external UI lib used, manual basic modal and gear SVG icon.
- **2a-opt-2**: DocViewer logic was inlined into App.tsx to use the new layout and classes.
- **2a-opt-3**: Modified the IIFE to be async to await chrome.storage.sync.get.
- **2a-opt-3 (fix)**: Mocked chrome.storage.sync.get to resolve issue in jsdom environment.
- **2a-opt-2 (fix)**: Cast autoFormatMd as boolean to resolve typecheck error on initialization.
- **2a-opt-3 (fix)**: Cast chrome.storage.sync.get to any in vi.mocked to bypass strict mock type checking.
