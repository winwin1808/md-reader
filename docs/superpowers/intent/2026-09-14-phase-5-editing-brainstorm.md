# Brainstorm: Phase 5 — Chỉnh sửa (Editor & Lưu đĩa)
Author: Antigravity & User. Status: proposed. Phase: 5

## Ý tưởng thô ban đầu
Người dùng muốn biến md-reader từ một trình đọc Markdown cao cấp thành một không gian làm việc hoàn chỉnh:
- Soạn thảo Markdown linh hoạt với 3 chế độ chuyển đổi mượt mà: **Chỉ đọc (Reading)**, **Chỉ sửa (Editor)**, và **Chia đôi (Split View)** với thanh cuộn đồng bộ 2 chiều giữa mã nguồn và bản xem trước trực tiếp (Live Preview).
- Sử dụng **CodeMirror 6** gắn kết đồng bộ trực tiếp với **Y.Text (Yjs)** và `Y.UndoManager`, bảo đảm tính toàn vẹn của CRDT document model đã xây dựng từ Phase 1.
- Tích hợp **File System Access API** (`showOpenFilePicker`, `showSaveFilePicker`, `FileSystemFileHandle`) lưu trữ an toàn trong IndexedDB, cho phép mở và lưu đè trực tiếp lên đĩa cục bộ.
- Cơ chế bảo vệ dữ liệu mạnh mẽ: kiểm tra xung đột `originHash`, phát hiện file bị thay đổi từ bên ngoài (external modifications) và hỗ trợ **Diff ba chiều (3-Way Diff)** để người dùng tự quyết định giữ bản nào, không bao giờ tự ý ghi đè làm mất dữ liệu.
- Bộ công cụ soạn thảo tiện dụng: Thanh công cụ Formatting Toolbar (Bold, Italic, Headings H1–H6, List, Table, Math, Code block), phím tắt nhanh (`Cmd+B`, `Cmd+I`, `Cmd+K`, `Cmd+S`, `Tab`/`Shift+Tab`), tự động tiếp tục danh sách (smart list continuation), và tùy chọn Tự động lưu (Auto-save) kèm chấm trạng thái chưa lưu (Unsaved dot indicator `•`).

---

## Nghiên cứu thị trường

### 1. VS Code Web & StackEdit (Split View & Synchronized Scroll)
- **Cơ chế**: StackEdit và VS Code chia đôi màn hình 50:50 (hoặc có thể kéo thanh chia tỷ lệ). 
- **Đồng bộ cuộn**: Thay vì tính toán theo phần trăm chiều cao (vốn bị lệch nghiêm trọng khi có bảng, ảnh, hoặc khối math/mermaid), các giải pháp hàng đầu sử dụng phương pháp **Source Mapping** hoặc **Anchor Block Mapping**:
  - CodeMirror 6 cung cấp `view.lineBlockAtHeight` và `view.heightAtLine`.
  - DOM Preview có các thẻ heading / paragraph tương ứng mang thuộc tính dòng hoặc heading slug.
  - Ngăn chặn vòng lặp cuộn vô tận (infinite scroll loop) bằng cờ `:hover` / active scroll container.
- **Tham khảo**: [CodeMirror 6 Split View Example](https://codemirror.net/6/examples/split/), StackEdit sync engine.

### 2. Typora & Obsidian (Soạn thảo văn bản & File System Handling)
- **Quản lý file đĩa**: Obsidian đọc/ghi trực tiếp vào vault trên đĩa cục bộ. Khi file bên ngoài bị đổi (ví dụ git checkout hoặc editor khác sửa), Obsidian phát hiện qua mtime/hash và cảnh báo người dùng thay vì ghi đè thầm lặng.
- **Thanh công cụ & Phím tắt**: Typora cung cấp phím tắt cực nhanh cho Markdown: `Cmd+B` (đậm), `Cmd+I` (nghiêng), `Cmd+K` (chèn link), `Cmd+1..6` (đổi cấp heading), `Enter` trong danh sách tự sinh bullet tiếp theo, `Enter` trên dòng bullet trống tự thoát danh sách.
- **Auto-save & Unsaved Indicator**: Hiển thị chấm tròn `•` cạnh tiêu đề tài liệu khi có thay đổi chưa lưu vào đĩa, tự động debounce lưu sau khi người dùng ngừng gõ (300ms–1000ms).

### 3. Yjs Ecosystem (`y-codemirror.next`)
- **Binding**: Thư viện chính thức `y-codemirror.next` liên kết trực tiếp giữa CodeMirror 6 `EditorView` / `EditorState` và `Y.Text`.
- **Lợi ích**: Mọi thao tác gõ phím trên editor biến thành Yjs delta updates. Undo/Redo được quản lý qua `Y.UndoManager`, đồng thời tạo bước đệm hoàn hảo cho Phase 6 (cộng tác thời gian thực nhiều người cùng sửa).

---

## Nhu cầu người dùng

1. **Chế độ xem linh hoạt (3 View Modes)**:
   - **Reading Mode**: Toàn màn hình chỉ đọc tài liệu đẹp đẽ với bố cục A4, ToC bên cạnh, reading progress.
   - **Editor Mode**: Toàn màn hình chỉ tập trung vào soạn thảo mã nguồn Markdown với font monospace, line numbers, cú pháp nổi bật.
   - **Split View Mode**: Chia đôi màn hình — editor bên trái và live preview bên phải, cuộn đến đâu ở editor thì preview tự động cuộn đồng bộ mượt mà đến đó.
2. **Thanh công cụ trực quan (Formatting Toolbar) & Phím tắt**:
   - Dành cho cả người dùng thích bấm nút trực quan và người dùng thích gõ phím tắt Markdown nhanh: Bold, Italic, Strikethrough, Headings (H1–H3), Bullet list, Numbered list, Task list `[ ]`, Blockquote, Code block, Table, Math LaTeX, Link.
   - Hỗ trợ thông minh: Gõ Enter tự động nối dòng danh sách bullet/numbered; nhấn Tab/Shift+Tab thụt lề; gõ phím tắt `Cmd+B`, `Cmd+I`, `Cmd+K`.
3. **Mở & Lưu file an toàn về đĩa (File System Access API)**:
   - Mở file `.md` từ máy bằng File Picker chuẩn Chrome, lưu `FileSystemFileHandle` vào IndexedDB để lần sau mở lại vẫn giữ liên kết file.
   - Lưu đè trực tiếp với phím tắt `Cmd+S` và nút Save trên Toolbar.
   - Chế độ Auto-save tùy chọn trong Cài đặt (bật/tắt, interval).
   - Đánh dấu trạng thái file: biểu tượng chấm tròn `•` khi có thay đổi chưa lưu ra file đĩa.
4. **Bảo vệ toàn vẹn dữ liệu & Xử lý xung đột (3-Way Diff Conflict Resolution)**:
   - Trước khi ghi đè về đĩa, kiểm tra `originHash` của file trên đĩa xem có bị phần mềm khác sửa đổi không.
   - Nếu file trên đĩa đã thay đổi từ bên ngoài: **tuyệt đối không tự ý ghi đè**. Hiển thị hộp thoại Diff 3 chiều trực quan:
     - Bản gốc (Base / Common Ancestor)
     - Bản cục bộ đang sửa (Your Changes / Y.Doc)
     - Bản mới trên đĩa (Disk Version)
     - Người dùng chọn giữ bản nào (Overwrite disk, Revert to disk, hoặc Copy diff).
5. **Format-and-save & Lịch sử phiên bản (History Checkpoints)**:
   - Tùy chọn tự động định dạng chuẩn qua `core/format` trước khi lưu.
   - Tạo checkpoint lịch sử trong `Y.Array "history"` tại mỗi lần bấm lưu hoặc sau 30 giây không hoạt động.

---

## Các hướng đã cân nhắc

### Hướng 1: Chỉ cung cấp Toggle View (Xem / Sửa riêng biệt)
- **Mô tả**: Người dùng bấm nút "Sửa" thì toàn màn hình biến thành CodeMirror 6; bấm "Xong" thì quay lại màn hình đọc.
- **Ưu điểm**: Đơn giản nhất, không phải xử lý đồng bộ cuộn giữa 2 khung nhìn.
- **Nhược điểm**: Không trực quan; người viết tài liệu Markdown hiện đại cần nhìn thấy bảng biểu, sơ đồ mermaid, công thức toán hiển thị trực tiếp khi đang gõ.
- **Đánh giá**: Loại bỏ làm giải pháp duy nhất (nhưng vẫn hỗ trợ như một trong 3 chế độ xem).

### Hướng 2: In-place WYSIWYG / Hybrid Markdown (như Typora / Milkdown)
- **Mô tả**: Gõ markdown đến đâu thì biến thành rich text ngay tại chỗ trong 1 khung nhìn duy nhất.
- **Ưu điểm**: Gọn gàng, chỉ có 1 khung soạn thảo.
- **Nhược điểm**: Kiến trúc phức tạp, khó tương thích sâu với AST remark và các custom block (Mermaid, PlantUML, Excalidraw, Slides divider `---`), dễ sinh lỗi nhảy con trỏ chuột và khó gắn `y-codemirror.next` vào `Y.Text` thuần túy.
- **Đánh giá**: Rủi ro cao, không phù hợp với kiến trúc khoá cứng Yjs schema và remark parser của dự án.

### Hướng 3 (Đề xuất): Bộ ba chế độ xem hoàn chỉnh với Split View + CodeMirror 6 + Y.Text + File System Access API
- **Mô tả**:
  - Hỗ trợ cả 3 chế độ: **Chỉ xem**, **Chỉ sửa**, và **Chia đôi (Split View)**.
  - Sử dụng CodeMirror 6 với cú pháp Markdown GFM và bind `y-codemirror.next` vào `Y.Text`.
  - Thanh Formatting Toolbar trực quan + phím tắt Markdown chuẩn.
  - Đồng bộ cuộn 2 chiều dựa trên Block Element Mapping và `:hover` detection.
  - Lưu file an toàn qua File System Access API với kiểm tra xung đột `originHash`, cảnh báo 3-Way Diff nếu file ngoài đĩa bị sửa, và history checkpointing.
- **Ưu điểm**: Cân bằng hoàn hảo giữa sức mạnh kỹ thuật (Yjs CRDT, an toàn đĩa), hiệu năng (nhẹ, nhanh), và trải nghiệm người dùng tuyệt hảo.

---

## Hướng đề xuất

Chọn **Hướng 3**. 

Chia Phase 5 thành các phase con theo đúng tinh thần của `docs/DESIGN.md` §4, kiểm soát chặt chẽ kích thước (≤ 5 file, ≤ 300 dòng diff, ≤ 1 file test mới mỗi phase con):

1. **5a — Editor Core & Yjs Binding**:
   - Tích hợp `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `y-codemirror.next`.
   - Tạo component `Editor` trong `packages/ui`, liên kết 2 chiều với `Y.Text` và `Y.UndoManager`.
2. **5b — File System Access API & Handle Persistence**:
   - Module `apps/extension/src/app/fs` quản lý `FileSystemFileHandle` qua IndexedDB.
   - Thao tác Open File, Save, Save As. Xin lại quyền truy cập (`queryPermission`, `requestPermission`).
3. **5c — Conflict Detection & 3-Way Diff Modal**:
   - Kiểm tra `originHash` trước khi ghi.
   - Hộp thoại so sánh và xử lý xung đột 3 chiều trực quan: Bản hiện tại, Bản ngoài đĩa, Bản gốc.
4. **5d — Formatting Toolbar & Phím tắt thông minh**:
   - Toolbar định dạng trên đỉnh Editor: Bold, Italic, Heading 1–3, Bullet/Number/Task list, Code, Math, Link, Table.
   - Phím tắt `Cmd+B`, `Cmd+I`, `Cmd+K`, `Cmd+S`, `Tab`/`Shift+Tab`, auto-bullet continuation khi nhấn Enter.
5. **5e — Chế độ xem & Split View Synchronized Scrolling**:
   - Bộ điều khiển 3 chế độ: Reading (Chỉ đọc), Editor (Chỉ sửa), Split (Chia đôi 50:50).
   - Cơ chế cuộn đồng bộ mượt mà 2 chiều giữa CodeMirror và Preview container.
6. **5f — Auto-save, Format-and-save & History Checkpoint**:
   - Tùy chọn tự động format qua `core/format` trước khi lưu.
   - Debounced Auto-save (người dùng bật/tắt trong Settings).
   - Biểu tượng chấm tròn `•` đánh dấu thay đổi chưa lưu trên TopToolbar.
   - Lưu checkpoint vào `Y.Array "history"` tại mỗi mốc lưu hoặc 30s không hoạt động.
7. **5g — E2E Smoke Tests cho Phase 5**:
   - Bộ test Playwright/Vitest kiểm thử toàn bộ luồng: Soạn thảo văn bản -> Bấm formatting toolbar -> Chuyển đổi split view -> Cuộn đồng bộ -> Kiểm tra phím tắt lưu và xử lý xung đột.

---

## Câu hỏi mở cho intent & spec
1. Thư viện CodeMirror 6: Cần cài đặt những package `@codemirror/*` cụ thể nào vào `packages/ui` để đảm bảo bundle nhẹ và không vi phạm CSP?
2. Có cần thanh trượt thay đổi tỷ lệ chia cột trong Split View (resizable split pane) hay cố định 50:50 là tối ưu?
3. Khi ở chế độ Split View, cây Thư mục mục lục (ToC) có nên mặc định thu gọn lại thành icon để nhường tối đa không gian cho 2 cột soạn thảo và xem trước không?
