# Nền tảng hỗ trợ & phát hành

## Chrome
`pnpm --filter extension package` → `docs/store/md-reader-<version>.zip` (MV3). Tải lên Chrome Web Store, hoặc giải nén và nạp ở `chrome://extensions` (Developer mode → Load unpacked).

## Edge
Dùng **nguyên zip Chrome**, không cần build riêng. Tải lên Microsoft Edge Add-ons, hoặc nạp thủ công ở `edge://extensions`.

## Brave / Opera / Arc / Vivaldi
Cùng nhân Chromium: dùng zip Chrome (nạp unpacked hoặc cài từ Chrome Web Store).

## Firefox (MV3, >= 128)
`pnpm --filter extension package:firefox` → `apps/extension/dist-firefox` + `docs/store/md-reader-<version>-firefox.zip`.
Script đổi manifest: `background.service_worker` → `background.scripts` (event page), thêm `browser_specific_settings.gecko` (id `md-reader@winwin1808`, min 128.0, khai `data_collection_permissions`). Kiểm: `pnpm dlx web-ext lint -s apps/extension/dist-firefox` (0 lỗi; còn cảnh báo `innerHTML`/`eval` từ thư viện đóng gói và cảnh báo key `data_collection_permissions` với Firefox < 140 — vô hại).
Thử: `about:debugging` → This Firefox → Load Temporary Add-on → chọn `manifest.json`.

Hạn chế đã biết (chưa sửa code sản phẩm):
- **File System Access API** (`showOpenFilePicker`, `showSaveFilePicker`, handle thư mục) không có trong Firefox: Mở file…/Lưu thẳng về đĩa/ảnh vào thư mục `assets/` không dùng được; chỉ còn nhúng `data:` và chia sẻ qua máy chủ.
- Firefox chặn content script đọc `file://` mặc định; người dùng phải bật quyền truy cập file/site ở `about:addons`.
- `host_permissions` là quyền tuỳ chọn trong Firefox MV3: cần cấp thủ công.
- Chưa chạy e2e Playwright trên Firefox (suite chỉ nạp extension Chromium).

## Phát hành
1. Nâng `version` trong `apps/extension/package.json` và `public/manifest.json` (phải khớp).
2. Merge vào `main` khi CI xanh (`.github/workflows/ci.yml`: typecheck, test, build, e2e).
3. `git tag vX.Y.Z && git push origin vX.Y.Z` → `release.yml` kiểm tag = version, build zip Chrome/Edge + Firefox, tạo **draft** GitHub Release.
4. Xem lại draft, tải zip lên Chrome Web Store / Edge Add-ons / AMO, rồi publish release.
