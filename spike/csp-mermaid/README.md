# spike/csp-mermaid — CSP probe harness (spike 1a.1)

Câu hỏi thật: `<style>` inline (kể cả trong shadow DOM / adoptedStyleSheets),
web font, và `<foreignObject>` do mermaid bơm vào trang chủ có bị chặn bởi
CSP của trang không — dù script chạy trong isolated world của content script.

Đây là harness dùng để trả lời câu hỏi đó, KHÔNG phải code sản phẩm. Bị xoá
ở phase con 1b1 sau khi có kết luận.

## Chạy

1. Vendor mermaid thật (cần network một lần):
   ```
   npm run vendor
   ```
   Kết quả: `mermaid.min.js` (~3.4MB) trong thư mục này, KHÔNG có stub —
   network hôm chạy spike này có sẵn, `npm pack mermaid@11` thành công.
   Nếu lần sau chạy lại mà offline, xem "Error handling — stub" ở cuối file.

2. Chạy fixture server (5 route CSP khác nhau trên cổng 8787):
   ```
   node server.mjs
   ```
   Tự kiểm 5 route mà không mở cổng:
   ```
   node server.mjs --selftest
   ```

3. Sinh fixture cho nhánh `file:///`:
   ```
   node server.mjs --write-fixture
   ```
   Ghi ra `fixture.html` cạnh file này (không có CSP header — file:// không
   có response header, đây là điểm khác biệt cố ý với 4 route http qua CSP
   header thật).

## Nạp extension và đọc kết quả (thủ công, 3 bước)

1. `chrome://extensions` → bật Developer mode → Load unpacked → chọn thư mục
   `spike/csp-mermaid/` này. Bật **"Allow access to file URLs"** cho extension
   "spike-csp-mermaid" (bắt buộc để content script chạy trên `file:///`).
2. Mở lần lượt từng URL và đọc kết quả:
   - `http://localhost:8787/none`
   - `http://localhost:8787/style-self`
   - `http://localhost:8787/locked`
   - `http://localhost:8787/style-nonce`
   - `http://localhost:8787/style-inline`
   - `file:///<abs-path-to-repo>/spike/csp-mermaid/fixture.html`
3. Mở DevTools trên mỗi trang → tab Elements → chọn thẻ `<html>` → đọc
   attribute `data-spike-result` (JSON: shadowStyleHeight, adoptedStyleHeight,
   mermaidSvgWidth/Height, foreignObjectHeight, violations, mermaidError…).
   Ghi lại bảng route → giá trị vào báo cáo spike.

## Ghi chú cho probe.mjs (1a.2)

- `content.js` ghi kết quả vào `document.documentElement.setAttribute('data-spike-result', ...)`
  — đây là kênh đọc được từ page context (không phải isolated world).
- manifest nạp `mermaid.min.js` (mermaid thật, không phải stub) rồi `content.js`.
- Nếu 1a.2 cần tự động hoá (Puppeteer/CDP) thay vì đọc tay, load unpacked
  extension với `--load-extension` và đọc attribute qua CDP/DOM API.

## Error handling — vendor thất bại (offline/proxy)

Nếu `npm run vendor` fail vì không có network, KHÔNG được bỏ qua im lặng.
Tạo `mermaid-stub.js` làm đúng 3 việc mermaid làm mà CSP quan tâm: chèn
`<style>` vào `document.head`, dựng `<svg>` có `<foreignObject>` chứa text
đã style, và request một web font remote qua `@font-face` — expose thành
`globalThis.mermaid = { initialize(){}, async render(){...} }`. Đổi
`manifest.json` để nạp `mermaid-stub.js` thay vì `mermaid.min.js`, và ghi rõ
trong báo cáo spike rằng kết quả mermaid-liên-quan đến từ stub, không phải
mermaid thật. **Lần chạy này không cần bước đó** — vendor mermaid thật đã
thành công (xem `ls -l mermaid.min.js`).
