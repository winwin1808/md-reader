# Intent: Phase 6 — Gia cố (Hardening)
Author: haonq. Status: draft. Phase: 6

Nguồn: `docs/research/2026-10-23-code-review-roadmap.md` (R1–R13) và
`docs/design/2026-10-23-ui-audit.md` (các bug chức năng). Đánh số lại phase được
duyệt 2026-10-23: phase 6 = Gia cố, phase 7 = Giao diện Lề sách + logo, phase 8 =
Chia sẻ & cộng tác (phase 6a–6g cũ của DESIGN.md §4, đổi số thành 8a–8g).

## Problem

405 test xanh nhưng lớp app dùng Y.Doc như một biến string: 6 chỗ xoá toàn bộ
`Y.Text` rồi chèn lại, nên khi hai bản cùng sửa thì nội dung nhân đôi, và lịch sử
"ai viết gì" bị xoá sạch. Mở lại file từ URL có thể mất hoặc nhân đôi bản sửa.
Autosave tự định dạng lại văn bản dưới con trỏ. Đọc đĩa lỗi bị coi là "đĩa rỗng",
và "Tải lại từ đĩa" xoá sạch tài liệu. Mọi file kéo-thả dùng chung một doc, recent
files không mở lại được, và quyền ghi file mất sau mỗi lần reload. Render nới lỏng
sanitize, `app.html` mở cho mọi trang, cache file phình không giới hạn. Không có
debounce 120ms. Sáu setting không nối vào đâu. "E2E" là jsdom có mock. `App.tsx`
875 dòng gánh mọi thứ. Phase 8 (cộng tác) không thể bắt đầu trên nền này.

## Proposed outcome

Người dùng sửa, đóng tab, mở lại, kéo file khác vào, reload trình duyệt: không bao
giờ mất chữ, không bao giờ nhân đôi chữ, và Cmd+S vẫn ghi thẳng về file trên đĩa
(xin lại quyền bằng một cú bấm khi cần). Gõ trong split view không giật. Mỗi
tài liệu có định danh riêng, có `formatVersion`, có lịch sử checkpoint ghi đúng
`clientIds`. Extension chỉ xin đúng quyền nó cần. Có ít nhất 3 luồng khói chạy
thật bằng Playwright trên Chromium load-unpacked. Phase 8 cắm được provider mới
qua một hook duy nhất mà không đụng `packages/core`.

## Affected packages

`packages/core` (doc: `applyTextChange`, registry types, migration; render:
plugin rehype thay regex sau sanitize; diff: thuật toán nhanh; math) ·
`packages/ui` (MermaidBlock cache/securityLevel, ConflictModal 3 chiều, Viewer
re-mount mermaid) · `apps/extension` (tách App.tsx thành hooks, load an toàn,
registry docId, file handle, manifest/worker/content, Playwright).

## Constraints

Ngoài 8 ràng buộc khoá cứng của DESIGN.md:

- **Không đổi giao diện** ở phase này trừ khi cần để hiện trạng thái mới (lỗi
  lưu, xin quyền). Thiết kế lại thuộc phase 7.
- Mọi thao tác ghi vào `Y.Text` từ app phải đi qua `applyTextChange` (delta nhỏ
  nhất) hoặc qua CodeMirror transaction. Cấm `delete(0, length)` + `insert`.
- Dữ liệu IndexedDB hiện có của người dùng (doc `'md-reader'`, doc theo URL) phải
  được migrate sang registry mới, không được mất.
- Mỗi thay đổi `core/doc` kèm test hội tụ 2 replica (DESIGN §6).
- Content script vẫn ≤ 60KB gz, không Yjs.

## Open questions

- Yjs `gc`: giữ `gc: true` và lưu text theo checkpoint, hay `gc: false` từ
  `formatVersion` mới? (ảnh hưởng 8g timeline)
- Tách App.tsx trước hay sau các bản sửa dữ liệu?
- Math: thêm remark-math + KaTeX lazy, hay xoá setting?
- PlantUML/Graphviz: xoá toggle hay để opt-in theo doc?
- Playwright: chạy trong `pnpm --filter extension e2e` riêng hay gộp test?

## Sub-phases

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 6a | `core/doc` applyTextChange | Ghi delta nhỏ nhất vào Y.Text; test hội tụ 2 replica cho format/revert/load |
| 6b | Tách App.tsx thành hooks | `useDocSession`, `useFileSave`, `useExport`, `useShortcuts` + ErrorBoundary, không đổi hành vi |
| 6c | Bỏ ghi đè toàn văn | 6 chỗ dùng `applyTextChange`; nút định dạng qua CodeMirror; autosave không format |
| 6d | Mở file an toàn | `whenSynced` + so `originHash`; lỗi đọc đĩa là trạng thái lỗi, không phải xung đột |
| 6e | Registry docId | uuid, mỗi doc một IDB, `createDoc`/`migrateDoc`, migrate dữ liệu cũ, recent mở lại được |
| 6f | File handle & diff 3 chiều | Khôi phục handle theo docId, nút Mở file, xin quyền bằng cử chỉ, `baseText` |
| 6g | Bảo mật render | Transform thành rehype plugin trước sanitize, `clobberPrefix`, mermaid `securityLevel` |
| 6h | Quyền & storage | Thu hẹp WAR, bỏ inject trùng, dọn `file_content_*`, regex `.mdx` |
| 6i | Hiệu năng | Debounce 120ms, slides/mindmap lười, cache mermaid, diff nhanh, lazy chunk |
| 6j | Setting ma & checkpoint | Nối math, xoá toggle không làm; checkpoint `clientIds` thật + lặng 30s |
| 6k | Playwright & dọn dẹp | 3 luồng khói load-unpacked; bỏ assert vô nghĩa; xoá `patch*.cjs`, `sources.txt` |
