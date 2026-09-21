# Session Handover — md-reader

Cập nhật: 2026-09-21 (phiên 11). Branch: `main` / `master` (Phase 1-5 đã merge hoàn toàn vào main và master).

## Đang ở đâu

**Phase 1 đến Phase 5 đã hoàn tất và đã merge 100% vào `main` và `master`!**
Đồng thời đã hoàn thiện sửa lỗi đồng bộ cài đặt đa file, cô lập IndexedDB theo URL, ưu tiên lưu trữ local và hiển thị widget nổi khi mở file markdown.

| # | Phase con | Trạng thái |
|---|---|---|
| 5a | `Editor` component CodeMirror 6 (`y-codemirror.next`, `Y.Text "source"`, `Y.UndoManager`) | ✅ done |
| 5b | File System Access API (`file-system.ts`, IndexedDB handle persistence, Open/Save/Save As) | ✅ done |
| 5c | Phát hiện xung đột & Hộp thoại 3-Way Diff (`computeLineDiff`, `detectConflict`, `ConflictModal`) | ✅ done |
| 5d | Thanh công cụ `FormattingToolbar` & phím tắt Markdown thông minh, tự tiếp tục danh sách khi Enter | ✅ done |
| 5e | Container 3 chế độ xem `SplitViewContainer` (Reading/Editor/Split) & 2-way synchronized scrolling | ✅ done |
| 5f | Pipeline lưu đĩa `App.tsx`: `Cmd+S`, dot `•`, `formatMarkdown`, debounced auto-save, history checkpoint | ✅ done |
| 5g | Bộ kiểm thử tích hợp E2E Smoke Tests toàn diện cho toàn bộ Phase 5 (`apps/extension/e2e/editor.spec.ts`) | ✅ done |

Specs & Intent tương ứng:
- `docs/superpowers/intent/2026-09-14-phase-5-editing.md`
- `docs/superpowers/specs/2026-09-14-phase-5-editing-design.md`
- Các plans: `docs/superpowers/plans/2026-09-14-phase-5-5{a,b,c,d,e,f,g}-plan.md`

## Trạng thái xanh lúc dừng (đo thật, không phải nhớ)

```
packages/core test        12 test files, 133 passed
packages/ui test          25 test files, 206 passed
apps/extension test       12 test files, 65 passed
Tổng cộng                 49 test files, 404 passed (0 failed)
pnpm -r typecheck         exit 0
pnpm -r build             exit 0
dist/content.js           30.49 kB, gz 11.65 kB (giới hạn 61.44 kB / 60KB)
```

## Tính năng đã hoàn tất ở Phase 5

1. **CodeMirror 6 Core & Yjs 2-way Binding (`Editor`):**
   - Tích hợp `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/language`.
   - Kết nối 2 chiều với `Y.Text "source"` và `Y.UndoManager` thông qua `y-codemirror.next`.
   - Hỗ trợ `onEditorReady`, `editorViewRef` để thao tác và kiểm tra vùng chọn chính xác.

2. **File System Access API & IndexedDB Handle Persistence:**
   - Hỗ trợ lưu trực tiếp về file gốc trên đĩa thông qua `FileSystemFileHandle` (`saveToHandle`, `openLocalFile`, `saveFileAs`).
   - Lưu handle an toàn vào IndexedDB (`idb-handle.ts`), tự động khôi phục và xác thực quyền khi mở lại.

3. **Phát hiện Xung đột & Hộp thoại 3-Way Diff (`ConflictModal`):**
   - Thuật toán `computeLineDiff` (LCS DP) và `detectConflict` theo SHA-256 `originHash` trong `@md-reader/core`.
   - Giao diện `ConflictModal` toàn màn hình với nền mờ, hiển thị song song hai bản (Cục bộ vs Ngoài đĩa) tô màu trực quan (xanh lá cho thêm mới, đỏ cho xóa).
   - Hai lựa chọn an toàn: "Giữ bản sửa của tôi (Ghi đè)" hoặc "Tải lại từ đĩa (Bỏ thay đổi)".

4. **Thanh công cụ Định dạng & Phím tắt Markdown (`FormattingToolbar`):**
   - 14 thao tác định dạng: Bold, Italic, Strike, Heading 1-3, Bullet list, Numbered list, Task list, Blockquote, Inline code, Code block, Math, Link, Table.
   - Giữ nguyên vùng chọn text sau khi áp dụng định dạng.
   - Tự động tiếp tục bullet/number/task list khi nhấn Enter; tự động thoát danh sách khi nhấn Enter ở dòng trống.

5. **3 Chế độ Xem & Cuộn Đồng bộ 2 Chiều (`SplitViewContainer`):**
   - 3 chế độ xem: Chế độ Đọc (Reading), Soạn thảo (Editor), Chia đôi 50:50 (Split View).
   - Cuộn đồng bộ 2 chiều (Synchronized Scrolling) giữa Editor và Live Preview theo tỉ lệ tiến độ cuộn.
   - Cơ chế bảo vệ `syncingTargetRef` kết hợp hủy `cancelAnimationFrame` ngăn ngừa vòng lặp phản hồi cuộn vô tận và không bị drop scroll khi người dùng thao tác nhanh.

6. **Tích hợp Lưu đĩa Toàn diện trong `App.tsx`:**
   - Phím tắt toàn cục `Cmd+S` / `Ctrl+S`.
   - Chỉ báo tài liệu chưa lưu `•` (`.dirty-indicator`) cạnh tiêu đề file.
   - Tự động định dạng Markdown trước khi lưu (`formatMarkdown`).
   - Ghi lại checkpoint lịch sử `appendHistory` vào `Y.Array "history"`.
   - Debounced auto-save sau 2000ms khi đã có file handle.
   - Concurrency guard `isSavingRef` chống xung đột gọi lưu song song và bảo vệ dữ liệu gõ trong lúc đang ghi đĩa.

7. **Bộ Kiểm thử E2E Smoke Tests Toàn diện (`editor.spec.ts`):**
   - Kịch bản end-to-end kiểm tra toàn bộ hành trình người dùng: chuyển đổi chế độ xem, bôi đen định dạng bold, gõ nội dung mới cập nhật live preview, lưu Cmd+S, giả lập file ngoài đĩa bị sửa, mở hộp thoại ConflictModal và giải quyết xung đột bằng ghi đè.

## Phase tiếp theo

- **Phase 6 (Chia sẻ & Cộng tác)**:
  - Chia sẻ link xem tài liệu.
  - Cộng tác thời gian thực qua WebRTC / WebSocket provider của Yjs.
  - Awareness / hiển thị con trỏ của người khác và lịch sử sửa đổi (trace ai sửa chỗ nào).
