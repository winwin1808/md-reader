# Intent: Phase 5 — Chỉnh sửa (Editor & Lưu đĩa)
Author: Antigravity & User. Status: draft. Phase: 5
Brainstorm: docs/superpowers/intent/2026-09-14-phase-5-editing-brainstorm.md

## Problem
Hiện tại, md-reader là một trình đọc Markdown và công cụ trình chiếu/mindmap mạnh mẽ, nhưng người dùng chỉ có thể xem nội dung ở chế độ đọc (read-only) hoặc mở file kéo thả tạm thời. Khi muốn chỉnh sửa trực tiếp nội dung văn bản, chèn tiêu đề, tạo bảng, sửa công thức hoặc lưu những thay đổi đó trực tiếp vào file `.md` trên đĩa cục bộ, người dùng phải chuyển sang một editor bên ngoài (như VS Code hay Obsidian) rồi reload lại trang. Thiếu tính năng soạn thảo trực tiếp, thiếu cơ chế lưu file an toàn với phát hiện xung đột ngoài đĩa, và thiếu chế độ xem chia đôi (Split View) đồng bộ cuộn khiến quy trình làm việc bị gián đoạn.

## Proposed outcome
Người dùng có trải nghiệm soạn thảo Markdown hiện đại, mượt mà và an toàn tuyệt đối:
1. **3 Chế độ xem linh hoạt**: Chuyển đổi dễ dàng giữa **Chỉ đọc (Reading Mode)**, **Chỉ sửa (Editor Mode)** và **Chia đôi màn hình (Split View)** với thanh cuộn đồng bộ 2 chiều chính xác giữa CodeMirror 6 và Live Preview (dựa trên Block/Heading mapping).
2. **CodeMirror 6 & Yjs CRDT**: Gắn kết hai chiều giữa CodeMirror 6 với `Y.Text "source"` và `Y.UndoManager` qua `y-codemirror.next`, bảo toàn mô hình tài liệu Yjs của toàn bộ ứng dụng và sẵn sàng cho cộng tác nhiều người (Phase 6).
3. **Thanh công cụ Formatting Toolbar & Phím tắt**: Hỗ trợ đầy đủ các thao tác định dạng văn bản (Bold, Italic, Headings, Lists, Code, Math, Link, Table), phím tắt `Cmd+B`, `Cmd+I`, `Cmd+K`, `Cmd+S`, thụt lề `Tab`/`Shift+Tab`, và tự động nối dòng danh sách khi nhấn `Enter`.
4. **File System Access API & IndexedDB**: Mở file trực tiếp từ đĩa cục bộ, lưu trữ handle vào IndexedDB để tái sử dụng, lưu đè an toàn với phím tắt `Cmd+S`, tùy chọn Auto-save, và chỉ báo trạng thái chưa lưu (Unsaved dot indicator `•`).
5. **Phát hiện xung đột & 3-Way Diff**: Kiểm tra mã băm `originHash` trước khi ghi đĩa. Khi phát hiện file ngoài đĩa bị phần mềm khác thay đổi, mở hộp thoại Diff 3 chiều (Base / Disk / Local) để người dùng chủ động lựa chọn, tuyệt đối không bao giờ tự ý ghi đè làm mất dữ liệu.
6. **Format-and-save & History Checkpoints**: Tùy chọn tự động định dạng chuẩn qua `core/format` trước khi lưu và ghi nhận các mốc lịch sử chỉnh sửa vào `Y.Array "history"`.

## Affected packages
- `packages/core`: Các tiện ích tính toán diff ba chiều, hàm kiểm tra `originHash`, checkpoint lịch sử trong `core/doc`.
- `packages/ui`: Component `Editor` bọc CodeMirror 6, `FormattingToolbar`, `SplitViewContainer`, `ConflictModal` (3-way diff), styles cho editor và split layout.
- `apps/extension`: Tích hợp File System Access API (`fs.ts`, IndexedDB handle storage), phím tắt toàn cục `Cmd+S`, quản lý dirty state và auto-save trong `App.tsx`, kết nối toolbar và các chế độ xem.

## Constraints
- Tiếp tục duy trì các ràng buộc khoá cứng từ `docs/DESIGN.md`:
  - `Y.Doc (Yjs)` là nguồn chân lý tối cao của state tài liệu. CodeMirror 6 bind vào `Y.Text "source"`.
  - `packages/core` là thuần TS (không React, không `chrome.*`, không DOM).
  - `packages/ui` là React & CSS (không `chrome.*`).
  - `apps/extension` là lớp duy nhất tương tác với `chrome.*` và `window.showOpenFilePicker` / `window.showSaveFilePicker`.
  - Content script KHÔNG dùng CodeMirror hay Yjs, duy trì nghiêm ngặt ngân sách ≤ 60KB gz.
  - Ngăn chặn triệt để vòng lặp cuộn vô tận (infinite scroll loop) trong Split View.

## Open questions
- Cài đặt những package `@codemirror/*` cụ thể nào (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/commands`, `y-codemirror.next`) để tương thích tối đa với React 19 và Vite?
- Cơ chế đồng bộ cuộn Split View: Sử dụng Block Mapping (dựa trên các heading ID và paragraph offsets) kết hợp con trỏ chuột `:hover` để đạt độ chính xác cao nhất.
- Hộp thoại 3-Way Diff: Thiết kế trực quan với 3 cột hoặc tab so sánh trực quan và 3 nút hành động (Keep My Changes, Use Disk Version, Merge/Copy).

## Sub-phases
Theo thiết kế chuẩn và chia nhỏ sizing từ `docs/DESIGN.md` §4:

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 5a | Editor Core & Yjs Binding | Component `Editor` với CodeMirror 6, cú pháp GFM, bind `y-codemirror.next` vào `Y.Text "source"` và `Y.UndoManager` |
| 5b | File System Access API & Persistence | Mở file/thư mục qua `showOpenFilePicker`, lưu trữ `FileSystemFileHandle` vào IndexedDB, xin lại quyền truy cập |
| 5c | Conflict Detection & 3-Way Diff Modal | Kiểm tra `originHash` trước khi ghi, hộp thoại `ConflictModal` so sánh 3 chiều trực quan và giải quyết xung đột an toàn |
| 5d | Formatting Toolbar & Phím tắt Markdown | Thanh công cụ định dạng (Bold, Italic, Heading, List, Table, Math), phím tắt thông minh, smart list continuation |
| 5e | Điều khiển 3 Chế độ xem & Split View Synchronized Scrolling | Tùy chọn Reading / Editor / Split View, cơ chế cuộn đồng bộ 2 chiều mượt mà giữa CodeMirror và Preview |
| 5f | Auto-save, Format-and-save & History Checkpoint | Tự động format qua `core/format`, debounced auto-save, chỉ báo chưa lưu `•`, checkpoint vào `Y.Array "history"` |
| 5g | E2E Smoke Tests cho Phase 5 | Kiểm thử tích hợp toàn diện quy trình soạn thảo, định dạng, split view, cuộn đồng bộ, lưu đĩa và xử lý xung đột |
