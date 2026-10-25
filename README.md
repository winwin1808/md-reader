<p align="center">
  <img src="apps/extension/public/icons/logo.svg" alt="MD Reader" width="112" height="112">
</p>

<h1 align="center">MD Reader</h1>

<p align="center">
  <b>Đọc đẹp. Sửa thẳng trên trang. Cùng sửa qua link. Trình chiếu ngay.</b><br>
  Tiện ích trình duyệt biến mọi file Markdown thành một trang đọc dễ chịu, rồi cho bạn sửa, chia sẻ và trình bày nó. Chạy trên máy; chia sẻ là tuỳ chọn.
</p>

<p align="center">
  <a href="https://github.com/winwin1808/md-reader/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/winwin1808/md-reader/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
  <img alt="Version 1.2.0" src="https://img.shields.io/badge/version-1.2.0-blue">
  <img alt="Chrome MV3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white">
  <img alt="Edge, Brave, Firefox" src="https://img.shields.io/badge/Edge%20%7C%20Brave%20%7C%20Firefox-xem%20b%E1%BA%A3ng%20n%E1%BB%81n%20t%E1%BA%A3ng-lightgrey">
</p>

<p align="center">
  <a href="https://md-reader-winwin.pages.dev/">Trang giới thiệu</a> ·
  <a href="https://gist.github.com/winwin1808/89e2f4a64e07b59ad6518c7b9d947fca">Giới thiệu nhanh (Gist)</a> ·
  <a href="docs/ROADMAP.md">Lộ trình</a> ·
  <a href="docs/SELF_HOST.md">Tự host chia sẻ</a> ·
  <a href="https://github.com/winwin1808/md-reader/issues">Góp ý</a>
</p>

<p align="center">
  <img src="docs/store/screenshots/01-doc.png" alt="Trang đọc Markdown, bảng màu Giấy" width="100%">
</p>

> **TL;DR (English)** — MD Reader is a browser extension (Chrome MV3; Edge/Brave/Opera/Arc/Vivaldi via the same build; Firefox with limits) that turns any `.md` file into a calm reading page. You can edit in place with a live preview (hidden Markdown marks, grid tables, paste images), save back to disk with a conflict diff, share view/edit links with realtime co-editing, blame and history, present slides with a speaker view, draw a mind map, and export to HTML / PDF / Word. No account, no tracking, no default server: documents stay in your browser unless you turn on optional sharing on a Cloudflare Worker you host yourself (free tier). UI in Vietnamese and English. MIT licensed. Next up: an MCP server so AI agents can publish Markdown and hand you a share link (see [roadmap](docs/ROADMAP.md)).

## Vì sao MD Reader

Có nhiều trình xem Markdown. MD Reader cố làm tốt ba việc mà một trang đọc thường không làm:

1. **Sửa thẳng trên trang đọc.** Không có cửa sổ soạn riêng. Trang trông như lúc đọc; dấu Markdown chỉ hiện ở chỗ con trỏ. Bảng là lưới gõ được, ảnh dán vào là xong, lưu thẳng về file và cảnh báo khi file bị sửa ở nơi khác.
2. **Cùng sửa qua link.** Tạo link xem hoặc link sửa, nhiều người sửa cùng lúc, thấy ai đang mở, xem dòng nào do ai viết, khôi phục phiên bản cũ. Máy chủ là Cloudflare Worker của chính bạn (gói miễn phí), nên dữ liệu không đi qua bên thứ ba.
3. **Trình chiếu có speaker view.** Một file Markdown thành bộ slide: đồng hồ, slide kế tiếp và ghi chú diễn giả ở cửa sổ riêng, đồng bộ với màn chiếu. Xuất được PDF slide khổ ngang.

Nền tảng chung: không tài khoản, không theo dõi, font đóng gói sẵn, mã nguồn mở MIT.

## Tính năng

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/store/screenshots/01-doc.png" alt="Đọc">
      <h4>Đọc dễ chịu</h4>
      Chữ Literata, cột chữ vừa mắt, mục lục bám mục đang đọc, ghi chú <code>[!NOTE]</code> nằm bên lề. Bảng, KaTeX, mermaid, excalidraw, code tô màu có nút sao chép. Tìm trong tài liệu bằng ⌘F.
    </td>
    <td width="50%" valign="top">
      <img src="docs/store/screenshots/02-edit.png" alt="Sửa trên trang">
      <h4>Sửa thẳng trên trang</h4>
      Hai chế độ Đọc / Sửa với live preview. Ảnh, checkbox, code, ghi chú, công thức, mermaid hiện ngay khi sửa. Chuyển chế độ vẫn giữ vị trí. Lưu về đĩa bằng ⌘S, có so sánh khi file bị đổi bên ngoài.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/store/screenshots/03-table.png" alt="Bảng dạng lưới">
      <h4>Bảng dạng lưới</h4>
      Gõ thẳng vào ô, Tab / Enter / ↑↓ để đi, thêm hoặc xoá dòng và cột; cần thì bấm "Sửa mã bảng". Dán hoặc kéo ảnh: ảnh nhỏ nhúng vào file, ảnh lớn vào thư mục <code>assets/</code> cạnh file, tài liệu đã chia sẻ thì lên máy chủ.
    </td>
    <td width="50%" valign="top">
      <img src="docs/store/screenshots/04-share.png" alt="Chia sẻ">
      <h4>Chia sẻ và cùng sửa</h4>
      Link xem hoặc link sửa, cộng tác thời gian thực, presence, blame theo dòng, lịch sử và khôi phục. Thu hồi link là chặn truy cập ngay. Cần máy chủ tự host (xem bên dưới).
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/store/screenshots/05-present.png" alt="Trình chiếu">
      <h4>Trình chiếu</h4>
      Tách slide theo <code>---</code> hoặc đề mục, tự co giãn theo màn hình. Speaker view có đồng hồ, slide kế tiếp, ghi chú; xuất PDF slide khổ ngang.
    </td>
    <td width="50%" valign="top">
      <img src="docs/store/screenshots/06-dark.png" alt="Than chì">
      <h4>Ba bảng màu</h4>
      Giấy, Than chì (tối), Tương phản cao. Giao diện theo ngôn ngữ trình duyệt (Việt / Anh), đổi được trong Cài đặt → Ngôn ngữ.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/store/screenshots/07-mindmap.png" alt="Sơ đồ tư duy">
      <h4>Sơ đồ tư duy</h4>
      Dựng từ các đề mục, màu theo nhánh, đi bằng bàn phím, zoom và pan, bấm node để cuộn tới đoạn đó. Xuất SVG / PNG (⌘M để mở).
    </td>
    <td width="50%" valign="top">
      <h4>Xuất bản</h4>
      HTML một file, PDF (in từ trình duyệt với CSS in riêng), Word <code>.docx</code>, PDF slide. Tất cả theo giao diện Lề sách.
      <h4>Riêng tư</h4>
      Không tài khoản, không theo dõi, không máy chủ mặc định. Chỉ khi bạn bật chia sẻ trên máy chủ của chính bạn thì tài liệu đó mới rời máy. Xem <a href="docs/store/privacy-policy.md">chính sách riêng tư</a>.
    </td>
  </tr>
</table>

## Nền tảng hỗ trợ

| Nền tảng | Trạng thái | Ghi chú |
|---|---|---|
| Chrome | **Có** | Cài từ mã nguồn hoặc zip phát hành; Chrome Web Store đang chuẩn bị. |
| Edge | **Có** | Dùng nguyên zip Chrome. Trang Edge Add-ons: dự kiến. |
| Brave / Opera / Arc / Vivaldi | **Có** | Cùng nhân Chromium, dùng zip Chrome. |
| Firefox (MV3, từ 128) | **Có giới hạn** | Có bản build. Không có File System Access API nên không Mở file / Lưu thẳng về đĩa / ảnh vào `assets/`; một số quyền phải cấp thủ công. Chi tiết: [`docs/PLATFORMS.md`](docs/PLATFORMS.md). |
| Chrome Web Store / Edge Add-ons / Firefox AMO | **Đang làm** | Hồ sơ listing và ảnh đã có; chờ publish. |
| VS Code, Obsidian | **Dự kiến** | Xem [lộ trình](docs/ROADMAP.md). |
| Web app (kéo file, không cài) | **Dự kiến** | Xem [lộ trình](docs/ROADMAP.md). |
| Di động | **Dự kiến** | Sau cùng. |

## Lộ trình tóm tắt

Phase 1 đến 9 đã xong (đọc, xuất, trình chiếu, mindmap, sửa và lưu đĩa an toàn, gia cố, giao diện Lề sách, chia sẻ và cộng tác, sửa thẳng trên trang). Kế tiếp:

- **v1.3, Chia sẻ cho AI (MCP):** máy chủ MCP để Claude, ChatGPT, Cursor... đăng một tài liệu Markdown và nhận về link xem/sửa.
- **v1.4:** thêm loại sơ đồ (PlantUML, Graphviz, Vega, ECharts, draw.io), OpenAPI, xuất EPUB / XLSX, thêm giao diện tài liệu.
- **v1.5:** bình luận, endpoint xoá dữ liệu phòng, rate limit, deploy một chạm lên Cloudflare, lên các cửa hàng.
- **v2.0:** VS Code, Obsidian, web app không cần cài, CLI.

Đây là kế hoạch, không phải cam kết ngày giao. Toàn bộ ở [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Chia sẻ & cộng tác (tuỳ chọn, tự host)

- **MD Reader không kèm máy chủ nào.** Chia sẻ cần một máy chủ đồng bộ của riêng bạn: một Cloudflare Worker chạy trong gói miễn phí (Durable Objects + D1). Lần đầu bấm Chia sẻ mà chưa có máy chủ, hộp thoại hiện các bước dựng và ô dán địa chỉ.
- Hướng dẫn từng bước: [`docs/SELF_HOST.md`](docs/SELF_HOST.md). Tóm tắt: `wrangler login`, tạo D1, `wrangler d1 migrations apply … --remote`, `pnpm deploy:api`, rồi dán địa chỉ Worker của bạn vào MD Reader.
- Tắt chia sẻ hoặc thu hồi link chỉ chặn truy cập, chưa xoá dữ liệu đã lưu trên máy chủ của bạn (endpoint xoá nằm trong lộ trình).

## Cài đặt

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

Sau đó mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và trỏ tới thư mục `apps/extension/dist`. Dùng một mình thì vậy là đủ, không cần deploy gì. Khi có code mới: `git pull && pnpm install && pnpm --filter extension build`, rồi bấm **Reload** trên MD Reader.

Muốn bản build tự biết địa chỉ máy chủ chia sẻ của bạn: tạo `apps/extension/.env.local` (đã gitignore) với dòng `VITE_MDR_SERVER_URL=<địa chỉ Worker của bạn>`.

> **Mẹo:** muốn đọc file trên máy (`file://`), vào `chrome://extensions` → MD Reader → bật **"Cho phép truy cập URL tệp"** (*Allow access to file URLs*).

Edge, Brave và các trình duyệt Chromium khác: nạp cùng thư mục `dist`. Firefox: `pnpm --filter extension package:firefox`, xem [`docs/PLATFORMS.md`](docs/PLATFORMS.md).

## Phím tắt

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

## Kiến trúc

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
- Content script **không dùng Yjs** và giữ ngân sách **≤ 60 KB gzip** (hiện khoảng 13 KB).
- Chế độ Sửa là live preview CodeMirror 6 ngay trên `Y.Text`, nên file `.md` giữ nguyên từng ký tự; cộng tác, undo và lịch sử không đổi.
- Stack: Vite, React, TypeScript, vitest, Playwright, CodeMirror 6, Cloudflare Workers.

## Phát triển

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
pnpm deploy:site                   # deploy website (Cloudflare Pages)
pnpm deploy:api                    # deploy máy chủ của bạn (xem docs/SELF_HOST.md)
```

Quy trình đưa lên cửa hàng ở [`docs/store/README.md`](docs/store/README.md); thiết kế chi tiết ở [`docs/DESIGN.md`](docs/DESIGN.md).

## Giấy phép và liên hệ

Giấy phép [MIT](LICENSE). Góp ý và báo lỗi: [GitHub Issues](https://github.com/winwin1808/md-reader/issues).
