# Spec: Phase 5 — Chỉnh sửa (Editor & Lưu đĩa)
Author: Antigravity & User. Status: designed. Phase: 5
Intent: docs/superpowers/intent/2026-09-14-phase-5-editing.md

## Sub-phase queue
- [x] 5a — Editor Core & Yjs Binding (`Editor` component, CodeMirror 6, `y-codemirror.next`, `Y.Text "source"`, `Y.UndoManager`) — done
- [x] 5b — File System Access API & Handle Persistence (`fs.ts` module, IndexedDB handle storage, Open/Save/Save As) — done
- [x] 5c — Conflict Detection & 3-Way Diff Modal (`originHash` verification, `ConflictModal` UI, diff calculation) — done
- [ ] 5d — Formatting Toolbar & Phím tắt Markdown (`FormattingToolbar`, smart list continuation, `Cmd+B`/`Cmd+I`/`Cmd+K`/`Tab`) — planned
- [ ] 5e — Điều khiển 3 Chế độ xem & Split View Synchronized Scrolling (Reading / Editor / Split View, 2-way sync scroll) — pending
- [ ] 5f — Auto-save, Format-and-save & History Checkpoint (`core/format` on save, debounced auto-save, unsaved dot `•`, `Y.Array "history"`) — pending
- [ ] 5g — E2E Smoke Tests cho toàn bộ Phase 5 (Quy trình soạn thảo, format, split view, lưu file và xử lý xung đột) — pending

---

## Approach chosen
- **Đã chọn**: 
  - Sử dụng hệ sinh thái **CodeMirror 6** chính thức (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/commands`) kết hợp thư viện chính thức **`y-codemirror.next`** để liên kết trực tiếp giữa editor và `Y.Text "source"`.
  - Quản lý trạng thái lưu và tương tác đĩa bằng **File System Access API** (`showOpenFilePicker`, `showSaveFilePicker`, `FileSystemFileHandle`), lưu trữ handle an toàn trong IndexedDB (`idb-keyval` hoặc native IndexedDB API).
  - Ngăn ngừa xung đột và mất dữ liệu bằng kiểm tra mã băm `originHash` trước khi ghi đĩa. Khi có sai lệch dữ liệu ngoài đĩa, kích hoạt hộp thoại **3-Way Diff** trực quan để người dùng chủ động lựa chọn.
  - Hỗ trợ linh hoạt **3 chế độ xem** (Reading / Editor / Split View) với cơ chế cuộn đồng bộ 2 chiều (Synchronized Scrolling) dựa trên block element mapping kết hợp cờ `:hover` để chống vòng lặp cuộn vô tận.
- **Phương án bị loại bỏ**:
  - Dùng Monaco Editor hoặc Ace Editor: Quá nặng (>3MB), vi phạm nghiêm ngặt ngân sách bộ nhớ và rủi ro CSP trong extension MV3.
  - In-place WYSIWYG editor (như TipTap / ProseMirror): Không liên kết tự nhiên 1-1 với markdown thô, xung đột với remark AST parser hiện tại và làm phức tạp hóa Y.Text CRDT.
  - Tự động merge khi xung đột đĩa (silent auto-merge): Cực kỳ nguy hiểm, có thể làm mất dữ liệu của người dùng khi làm việc nhóm hoặc dùng git bên ngoài.

---

## Chi tiết thiết kế từng phase con

### 5a — Editor Core & Yjs Binding
* **Mục tiêu**: Xây dựng component `Editor` trong `packages/ui` dựa trên CodeMirror 6, hỗ trợ cú pháp Markdown GFM, bind hai chiều vào `Y.Text "source"` và `Y.UndoManager` qua `y-codemirror.next`.
* **Gói**: `packages/ui` (phụ thuộc nội bộ `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/commands`, `y-codemirror.next`).
* **Interfaces**:
  ```tsx
  // packages/ui/src/components/Editor.tsx
  import type * as Y from 'yjs'

  export interface EditorProps {
    yText: Y.Text
    undoManager?: Y.UndoManager
    className?: string
    placeholder?: string
    readOnly?: boolean
    onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void
    onEditorReady?: (view: any) => void
  }

  export function Editor(props: EditorProps): React.JSX.Element
  ```
* **Cơ chế hoạt động**:
  - Khởi tạo CodeMirror 6 `EditorView` trong `useEffect` gắn vào một `div` container ref.
  - Cấu hình extensions: `markdown({ base: markdownLanguage, codeLanguages: languages })`, `history()` (hoặc `yCollab` undo), `lineNumbers()`, `highlightActiveLine()`, `bracketMatching()`, `syntaxHighlighting(defaultHighlightStyle)`.
  - Tích hợp `yCollab(props.yText, null, { undoManager: props.undoManager })`.
  - Cleanup: Gọi `view.destroy()` khi unmount.
* **Tests**: Kiểm tra render container editor, gõ text cập nhật vào `Y.Text`, thay đổi `Y.Text` từ bên ngoài tự cập nhật lên editor, undo/redo hoạt động.
* **Sizing check**: 4 files (`packages/ui/src/components/Editor.tsx`, `packages/ui/src/components/Editor.test.tsx`, `packages/ui/src/theme/editor.css`, `packages/ui/src/index.ts`), ~220 dòng diff, 1 test file mới. Đạt chuẩn.

---

### 5b — File System Access API & Handle Persistence
* **Mục tiêu**: Xây dựng module quản lý tệp tin cục bộ trong `apps/extension` sử dụng File System Access API, lưu trữ và khôi phục `FileSystemFileHandle` qua IndexedDB, hỗ trợ Open File, Save, và Save As.
* **Gói**: `apps/extension` (lớp duy nhất được phép truy cập browser file APIs).
* **Interfaces**:
  ```ts
  // apps/extension/src/app/fs/file-system.ts
  export interface StoredFileEntry {
    id: string
    name: string
    handle: FileSystemFileHandle
    lastModified: number
  }

  export function isFileSystemAccessSupported(): boolean
  export async function openLocalFile(): Promise<{ handle: FileSystemFileHandle; file: File; content: string } | null>
  export async function saveToHandle(handle: FileSystemFileHandle, content: string): Promise<number> // returns new lastModified
  export async function saveFileAs(suggestedName: string, content: string): Promise<{ handle: FileSystemFileHandle; file: File } | null>
  export async function storeFileHandle(handle: FileSystemFileHandle): Promise<void>
  export async function getStoredFileHandle(): Promise<FileSystemFileHandle | null>
  export async function verifyHandlePermission(handle: FileSystemFileHandle, readWrite?: boolean): Promise<boolean>
  ```
* **Cơ chế hoạt động**:
  - Dùng native IndexedDB database `md_reader_fs` để lưu trữ đối tượng `FileSystemFileHandle`.
  - Khi mở file qua `window.showOpenFilePicker({ types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md', '.markdown', '.txt'] } }] })`: đọc content, tính `hashContent`, lưu handle.
  - `saveToHandle`: Mở `createWritable()`, ghi nội dung, đóng stream, trả về `file.lastModified`.
* **Tests**: Mock IndexedDB và FileSystemFileHandle trong vitest jsdom, kiểm tra lưu trữ handle, đọc nội dung, ghi nội dung thành công và xử lý khi người dùng huỷ picker.
* **Sizing check**: 3 files (`apps/extension/src/app/fs/file-system.ts`, `apps/extension/src/app/fs/file-system.test.ts`, `apps/extension/src/app/fs/idb-handle.ts`), ~250 dòng diff, 1 test file mới. Đạt chuẩn.

---

### 5c — Conflict Detection & 3-Way Diff Modal
* **Mục tiêu**: Phát hiện xung đột dữ liệu ngoài đĩa trước khi lưu dựa trên `originHash`, cung cấp thuật toán so sánh 3 chiều trong `packages/core`, và component `ConflictModal` hiển thị diff trực quan.
* **Gói**: `packages/core` (thuần TS, tính diff và hash) & `packages/ui` (`ConflictModal` hiển thị).
* **Interfaces**:
  ```ts
  // packages/core/src/diff/diff.ts
  export interface DiffResult {
    hasConflict: boolean
    baseContent: string
    localContent: string
    diskContent: string
  }

  export function detectConflict(baseHash: string, currentDiskContent: string): boolean
  ```
  ```tsx
  // packages/ui/src/components/ConflictModal.tsx
  export interface ConflictModalProps {
    isOpen: boolean
    fileName: string
    localContent: string
    diskContent: string
    onKeepLocal: () => void
    onRevertToDisk: () => void
    onClose: () => void
  }

  export function ConflictModal(props: ConflictModalProps): React.JSX.Element | null
  ```
* **Cơ chế hoạt động**:
  - Trước khi ghi vào handle: đọc nội dung hiện tại trên đĩa, tính SHA-256 hash. So sánh với `originHash` đã lưu trong `Y.Map "meta"`.
  - Nếu hash trùng khớp: cho phép ghi tiếp.
  - Nếu hash lệch (file ngoài đĩa đã bị sửa đổi): chặn ghi, mở `ConflictModal` hiển thị so sánh 2 bên (Bản cục bộ vs Bản ngoài đĩa). Người dùng có 2 nút hành động an toàn: "Giữ bản sửa của tôi (Ghi đè đĩa)" hoặc "Tải lại bản từ đĩa (Huỷ thay đổi cục bộ)".
* **Tests**: Test `detectConflict` với các hash khác nhau trong `core`; test `ConflictModal` mở ra, hiển thị nội dung 2 bản và kích hoạt đúng callbacks khi click các nút.
* **Sizing check**: 4 files (`packages/core/src/diff/diff.ts`, `packages/core/src/diff/diff.test.ts`, `packages/ui/src/components/ConflictModal.tsx`, `packages/ui/src/components/ConflictModal.test.tsx`), ~260 dòng diff, 1 test file mới. Đạt chuẩn.

---

### 5d — Formatting Toolbar & Phím tắt Markdown
* **Mục tiêu**: Xây dựng thanh công cụ `FormattingToolbar` trên đỉnh Editor và hệ thống phím tắt Markdown thông minh, tự động tiếp tục bullet/numbered list khi nhấn Enter.
* **Gói**: `packages/ui` (React & CSS).
* **Interfaces**:
  ```tsx
  // packages/ui/src/components/FormattingToolbar.tsx
  export type FormatAction = 
    | 'bold' | 'italic' | 'strike' | 'h1' | 'h2' | 'h3' 
    | 'bullet' | 'number' | 'task' | 'quote' | 'code' | 'codeblock' 
    | 'math' | 'link' | 'table'

  export interface FormattingToolbarProps {
    onAction: (action: FormatAction) => void
    canUndo?: boolean
    canRedo?: boolean
    onUndo?: () => void
    onRedo?: () => void
    className?: string
  }

  export function FormattingToolbar(props: FormattingToolbarProps): React.JSX.Element
  ```
* **Cơ chế hoạt động**:
  - Tiện ích chèn Markdown syntax vào vị trí con trỏ / bao bọc vùng chọn:
    - Bold: `**selected**`
    - Italic: `*selected*`
    - Heading: chèn `# `, `## `, `### ` ở đầu dòng
    - List: chèn `- `, `1. `, `- [ ] `
    - Table: chèn bảng mẫu 3x3
  - Phím tắt: Lắng nghe `keydown` trên Editor: `Cmd+B` (bold), `Cmd+I` (italic), `Cmd+K` (chèn link), `Tab` (thụt 2 spaces), `Shift+Tab` (bỏ thụt 2 spaces).
  - Smart list continuation: Nhấn `Enter` khi đang ở dòng danh sách (`- `, `* `, `1. `): tự động chèn prefix danh sách cho dòng mới; nếu dòng hiện tại là prefix rỗng thì xoá prefix và xuống dòng trắng (thoát danh sách).
* **Tests**: Test click các nút formatting kích hoạt `onAction`; test hàm biến đổi text chèn đúng Markdown syntax; test phím tắt bàn phím.
* **Sizing check**: 4 files (`packages/ui/src/components/FormattingToolbar.tsx`, `packages/ui/src/components/FormattingToolbar.test.tsx`, `packages/ui/src/components/markdown-commands.ts`, `packages/ui/src/theme/editor.css`), ~270 dòng diff, 1 test file mới. Đạt chuẩn.

---

### 5e — Điều khiển 3 Chế độ xem & Split View Synchronized Scrolling
* **Mục tiêu**: Hỗ trợ 3 chế độ xem (Reading, Editor, Split View), layout chia đôi 2 cột và cơ chế cuộn đồng bộ 2 chiều mượt mà giữa CodeMirror và Viewer.
* **Gói**: `packages/ui` & `apps/extension`.
* **Interfaces**:
  ```tsx
  // packages/ui/src/components/SplitViewContainer.tsx
  export type ViewMode = 'reading' | 'editor' | 'split'

  export interface SplitViewContainerProps {
    mode: ViewMode
    editor: React.ReactNode
    preview: React.ReactNode
    onSyncScroll?: (source: 'editor' | 'preview', ratio: number) => void
  }

  export function SplitViewContainer(props: SplitViewContainerProps): React.JSX.Element
  ```
* **Cơ chế hoạt động**:
  - Nút chuyển đổi 3 chế độ trên `TopToolbar` (biểu tượng: Đọc 📖, Sửa ✍️, Chia đôi ◫).
  - Khi `mode === 'reading'`: chỉ hiển thị Preview (A4 container).
  - Khi `mode === 'editor'`: chỉ hiển thị Editor (CodeMirror full-width).
  - Khi `mode === 'split'`: hiển thị 2 cột song song 50:50, ToC thu gọn thành icon nếu màn hình nhỏ.
  - Đồng bộ cuộn 2 chiều:
    - Bắt sự kiện `scroll` trên container đang được hover con trỏ chuột (`:hover`).
    - Tính tỷ lệ cuộn hoặc mapping theo heading block.
    - Cập nhật `scrollTop` của container đối diện qua `requestAnimationFrame`.
* **Tests**: Test render 3 chế độ xem; test chia cột tỉ lệ 50:50; test dispatch scroll không tạo vòng lặp vô tận.
* **Sizing check**: 4 files (`packages/ui/src/components/SplitViewContainer.tsx`, `packages/ui/src/components/SplitViewContainer.test.tsx`, `packages/ui/src/components/TopToolbar.tsx`, `packages/ui/src/theme/split-view.css`), ~260 dòng diff, 1 test file mới. Đạt chuẩn.

---

### 5f — Auto-save, Format-and-save & History Checkpoint
* **Mục tiêu**: Tích hợp luồng lưu hoàn chỉnh vào `App.tsx`: phím tắt `Cmd+S`, định dạng trước khi lưu qua `core/format`, debounced auto-save, chỉ báo chưa lưu `•`, và tạo checkpoint lịch sử trong `Y.Array "history"`.
* **Gói**: `apps/extension` & `packages/ui`.
* **Cơ chế hoạt động**:
  - Quản lý `isDirty: boolean`: chuyển thành `true` khi `Y.Text` thay đổi; chuyển thành `false` sau khi lưu đĩa thành công.
  - Hiển thị chấm tròn `•` cạnh tiêu đề file trên Toolbar khi `isDirty === true`.
  - Phím tắt `Cmd+S` / `Ctrl+S`: ngăn hành vi mặc định của browser, kích hoạt hàm `handleSave()`.
  - Hàm `handleSave()`:
    - Nếu cài đặt bật "Format on save": gọi `formatMarkdown(source)` trước khi lưu.
    - Ghi vào file handle, cập nhật `originHash` mới.
    - Gọi `appendHistory(doc, { source, timestamp: Date.now() })`.
    - Đặt `isDirty = false`.
  - Debounced Auto-save: Sau 2000ms người dùng ngừng gõ, nếu đã có file handle và bật auto-save thì tự động lưu ngầm.
* **Tests**: Test phím tắt Cmd+S kích hoạt save; test isDirty dot hiển thị và biến mất sau save; test auto-save kích hoạt sau debounce timer.
* **Sizing check**: 3 files (`apps/extension/src/app/App.tsx`, `apps/extension/src/app/App.test.tsx`, `packages/ui/src/components/TopToolbar.tsx`), ~240 dòng diff, 0 test file mới. Đạt chuẩn.

---

### 5g — E2E Smoke Tests cho toàn bộ Phase 5
* **Mục tiêu**: Bộ kiểm thử tích hợp toàn diện quy trình soạn thảo Markdown, bấm formatting toolbar, chuyển đổi chế độ xem, cuộn đồng bộ split view, lưu file và hiển thị hộp thoại xử lý xung đột.
* **Gói**: `apps/extension/e2e`.
* **Kịch bản kiểm thử**:
  - `apps/extension/e2e/editor.spec.ts`:
    - Khởi tạo App với tài liệu Markdown mẫu.
    - Chuyển sang chế độ Split View: xác minh cả Editor và Preview cùng xuất hiện.
    - Gõ thêm văn bản và tiêu đề H2 vào Editor -> xác minh Live Preview tự động cập nhật và hiển thị tiêu đề mới.
    - Bấm nút "In đậm" trên FormattingToolbar -> xác minh text được bọc `**...**`.
    - Kiểm tra phím tắt `Cmd+S` và chỉ báo dirty `•`.
    - Giả lập xung đột file ngoài đĩa -> xác minh hộp thoại `ConflictModal` hiển thị cảnh báo an toàn.
* **Sizing check**: 2 files (`apps/extension/e2e/editor.spec.ts`, `docs/SESSION_HANDOVER.md`), ~220 dòng diff, 1 test file mới. Đạt chuẩn.
