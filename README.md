<p align="center">
  <img src="apps/extension/public/icons/logo.svg" alt="MD Reader" width="96" height="96">
</p>

<h1 align="center">MD Reader</h1>

<p align="center">
  Đọc, soạn, trình chiếu và xuất Markdown ngay trong Chrome. Chạy trên máy; chia sẻ là tuỳ chọn.
</p>

<p align="center">
  <img alt="Chrome MV3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
</p>

> **TL;DR (English)** — MD Reader is a Chrome (MV3) extension that turns any `.md` file into a calm reading page, with in-place editing on the reading page (live preview), slides with speaker view, mind maps, and export to HTML / PDF / Word. No account, no tracking: documents and settings stay in your browser unless you turn on optional sharing on a sync server you host yourself (free Cloudflare Workers).

## 📖 Giới thiệu

MD Reader biến file Markdown thành một trang đọc dễ chịu, ngay trong Chrome. Bấm vào link `.md` (GitHub raw, file trên máy) là mở trang đọc với chữ Literata, cột chữ vừa mắt và giao diện "Lề sách".

<p align="center">
  <img src="docs/store/screenshots/01-doc-giay.png" alt="Trang đọc, bảng màu Giấy" width="100%">
</p>

## ✨ Tính năng

### Đọc

- Mở link `.md` là đọc đẹp ngay, tuỳ chỉnh độ rộng trang.
- Mục lục bên trái đánh dấu mục bạn đang đọc; ghi chú `[!NOTE]` nằm gọn bên lề.
- Bảng, công thức toán (KaTeX), sơ đồ mermaid, excalidraw, khối code tô màu và nút sao chép.
- Ba bảng màu: Giấy, Than chì (tối), Tương phản cao. Tìm trong tài liệu (⌘F).

<table>
  <tr>
    <td width="50%"><img src="docs/store/screenshots/01-doc-giay.png" alt="Bảng màu Giấy"></td>
    <td width="50%"><img src="docs/store/screenshots/02-doc-than-chi.png" alt="Bảng màu Than chì"></td>
  </tr>
  <tr>
    <td align="center"><sub>Giấy</sub></td>
    <td align="center"><sub>Than chì (tối)</sub></td>
  </tr>
</table>

### Sửa thẳng trên trang

- Hai chế độ: **Đọc** và **Sửa**. Ở chế độ Sửa, trang trông như lúc đọc; dấu Markdown (`#`, `**`, `[]()`…) chỉ hiện ở chỗ con trỏ.
- Ảnh, checkbox, khối code, ghi chú, công thức, mermaid hiện ngay khi sửa. Bảng giữ dạng lưới: gõ thẳng vào ô, Tab / Enter / ↑↓ để đi, thêm/xoá dòng và cột, nút "Sửa mã bảng" khi cần.
- Thanh định dạng, ⌘B / ⌘I / ⌘K. Chuyển Đọc ↔ Sửa vẫn giữ vị trí; mỗi tài liệu nhớ chế độ dùng lần cuối.
- Dán (⌘V) hoặc kéo ảnh vào: ảnh ≤ 600 KB nhúng thẳng vào file; lớn hơn thì lưu vào thư mục `assets/` cạnh file `.md` (cấp quyền thư mục một lần); tài liệu đã chia sẻ thì ảnh lên máy chủ (≤ 2 MB). Ảnh đường dẫn tương đối (`./img/a.png`) hiển thị đúng.
- Lưu thẳng về file trên đĩa (⌘S), phát hiện khi file bị sửa ở nơi khác và cho so sánh trước khi ghi đè.

### Trình bày

- Bấm Trình chiếu: tách slide theo `---` hoặc đề mục, tự co giãn theo màn hình.
- Speaker view có đồng hồ, slide kế tiếp và ghi chú diễn giả.
- Sơ đồ tư duy từ các đề mục, đi được bằng bàn phím, xuất SVG/PNG.

<table>
  <tr>
    <td width="50%"><img src="docs/store/screenshots/04-present.png" alt="Trình chiếu"></td>
    <td width="50%"><img src="docs/store/screenshots/05-mindmap.png" alt="Sơ đồ tư duy"></td>
  </tr>
  <tr>
    <td align="center"><sub>Trình chiếu</sub></td>
    <td align="center"><sub>Sơ đồ tư duy</sub></td>
  </tr>
</table>

### Xuất

HTML một file, PDF (in từ trình duyệt), Word (`.docx`), PDF slide khổ ngang.

### Chia sẻ & cộng tác (tuỳ chọn, tự host)

- Tạo link xem hoặc link sửa, cùng sửa theo thời gian thực, thấy ai đang mở, xem dòng nào do ai viết, lịch sử phiên bản. Link đã tạo sao chép lại được bất cứ lúc nào trên máy đã tạo.
- **MD Reader không kèm máy chủ nào.** Chia sẻ cần một máy chủ đồng bộ của riêng bạn: một Cloudflare Worker chạy trong gói miễn phí (Durable Objects + D1). Lần đầu bấm Chia sẻ mà chưa có máy chủ, hộp thoại hiện các bước dựng và ô dán địa chỉ.
- Hướng dẫn từng bước: [`docs/SELF_HOST.md`](docs/SELF_HOST.md). Tóm tắt: `wrangler login` → tạo D1 → `wrangler d1 migrations apply … --remote` → `pnpm deploy:api` → dán địa chỉ `…workers.dev` vào MD Reader.
- Tắt chia sẻ hoặc thu hồi link chỉ chặn truy cập, không xoá dữ liệu đã lưu trên máy chủ của bạn.
- Chi tiết dữ liệu nào được gửi đi: [chính sách riêng tư](docs/store/privacy-policy.md).

### Riêng tư

Không tài khoản, không theo dõi, không máy chủ mặc định. Tài liệu và cài đặt chỉ nằm trong trình duyệt của bạn; chỉ khi bạn bật chia sẻ trên máy chủ của chính bạn thì tài liệu đó mới rời máy. Font được đóng gói sẵn, không gọi ra ngoài khi đọc.

## 🚀 Cài đặt

### Từ Chrome Web Store

Sắp có.

### Từ mã nguồn

Yêu cầu Node.js và [pnpm](https://pnpm.io) 10.

```bash
git clone https://github.com/winwin1808/md-reader.git
cd md-reader
pnpm install
pnpm --filter extension build
```

Sau đó mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và trỏ tới thư mục `apps/extension/dist`.

Dùng một mình thì vậy là đủ — không cần deploy gì. Khi có code mới: `git pull && pnpm install && pnpm --filter extension build`, rồi bấm **Reload** trên MD Reader.

Muốn bản build tự biết địa chỉ máy chủ chia sẻ của bạn: tạo `apps/extension/.env.local` (đã gitignore) với dòng `VITE_MDR_SERVER_URL=https://…workers.dev`.

> **Mẹo:** muốn đọc file trên máy (`file://`), vào `chrome://extensions` → MD Reader → bật **"Cho phép truy cập URL tệp"** (*Allow access to file URLs*).

## ⌨️ Phím tắt

Trên Windows/Linux dùng `Ctrl` thay cho `⌘`.

| Phím | Tác dụng |
|---|---|
| ⌘F | Tìm trong tài liệu |
| ⌘S | Lưu về file trên đĩa |
| ⌘M | Mở sơ đồ tư duy |
| ⌘B / ⌘I / ⌘K | In đậm / in nghiêng / chèn liên kết (trong trình soạn) |
| ← → / Space | Slide trước / sau (khi trình chiếu) |
| Esc | Thoát trình chiếu |
| `?speaker=true` | Thêm vào URL để mở speaker view |

## 🧱 Kiến trúc

Monorepo pnpm workspaces:

| Package | Vai trò |
|---|---|
| `packages/core` | TypeScript thuần: parser `unified`/`remark`, mô hình tài liệu Yjs, slide, mindmap, export. Không dùng React hay `chrome.*`. |
| `packages/ui` | Thành phần React (Viewer, Editor, Deck, Mindmap, ...). Không dùng `chrome.*`. |
| `apps/extension` | Vỏ extension MV3 (app page, content script, build). Lớp duy nhất được dùng `chrome.*`. |
| `apps/api` | Máy chủ đồng bộ tự host: Cloudflare Worker, Durable Object (Yjs qua WebSocket) + D1 (link, ảnh). |
| `apps/web` | Trang `/s/<token>` cho người được chia sẻ: xem hoặc sửa thẳng trên trang. |

Nguyên tắc chính:

- **`Y.Doc` (Yjs) là nguồn sự thật**; file `.md` chỉ là cổng import/export. Lưu cục bộ bằng IndexedDB (`y-indexeddb`).
- Content script **không dùng Yjs** và giữ ngân sách **≤ 60 KB gzip** (hiện khoảng 12 KB).
- Chế độ Sửa là live preview CodeMirror 6 ngay trên `Y.Text` — file `.md` giữ nguyên từng ký tự, cộng tác/undo/lịch sử không đổi.
- Stack: Vite, React, TypeScript, vitest, Playwright, CodeMirror 6, Cloudflare Workers.

## 🛠️ Phát triển

```bash
pnpm test                          # chạy test mọi package
pnpm --filter core test            # packages/core
pnpm --filter ui test              # packages/ui
pnpm --filter extension test       # apps/extension (unit)
pnpm typecheck                     # tsc --noEmit mọi package
pnpm --filter extension build      # build vào apps/extension/dist
pnpm --filter extension e2e        # Playwright (build rồi chạy)
pnpm --filter extension package    # đóng gói zip cho Chrome Web Store
pnpm --filter api test             # máy chủ đồng bộ
pnpm deploy:api                    # deploy máy chủ của bạn (xem docs/SELF_HOST.md)
```

Quy trình đưa lên Chrome Web Store (listing, ảnh, giải trình quyền) nằm ở [`docs/store/README.md`](docs/store/README.md). Thiết kế chi tiết ở [`docs/DESIGN.md`](docs/DESIGN.md).

## 🗺️ Roadmap

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 1 | Nền tảng và trình đọc | Xong |
| 2 | Xuất HTML / PDF / Word | Xong |
| 3 | Trình chiếu, speaker view | Xong |
| 4 | Mindmap và Excalidraw | Xong |
| 5 | Chỉnh sửa, lưu đĩa an toàn | Xong |
| 6 | Gia cố (không mất/nhân đôi chữ, quyền tối thiểu, Playwright) | Xong |
| 7 | Giao diện Lề sách và logo | Xong |
| 8 | Chia sẻ và cộng tác (Cloudflare Workers) | Xong |
| 9 | Sửa thẳng trên trang, bảng dạng lưới, ảnh, hộp thoại chia sẻ mới | Xong |

## 📄 Giấy phép và liên hệ

Chưa khai báo giấy phép trong repo; mọi quyền được giữ cho tới khi có file `LICENSE`. Góp ý và báo lỗi: [GitHub Issues](https://github.com/winwin1808/md-reader/issues).
