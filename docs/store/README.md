# Bộ hồ sơ Chrome Web Store — MD Reader

| File | Dùng ở đâu |
|---|---|
| `listing.md` | Tên, mô tả ngắn/dài (VI + EN), danh mục, single purpose, giải trình quyền, data usage |
| `privacy-policy.md` | Privacy policy URL — trỏ link GitHub tới file này (điền email liên hệ trước) |
| `screenshots/01..05-*.png` | 5 ảnh 1280×800 |
| `promo-small-440x280.png` | Small promo tile |
| `../../apps/extension/public/icons/icon-128.png` | Store icon 128×128 |
| `md-reader-<version>.zip` | Gói upload — tạo bằng `pnpm --filter extension package` (không commit) |

## Các bước

1. Merge MR #1 (phase 6) rồi MR #2 (phase 7) vào `main`; checkout `main`.
2. `pnpm install && pnpm --filter extension package` → `docs/store/md-reader-1.0.0.zip`.
3. Điền dòng `Contact:` trong `privacy-policy.md`, push; lấy link GitHub của file.
4. https://chrome.google.com/webstore/devconsole → đăng ký (5 USD, bật 2FA) → **New item** → upload zip.
5. Tab **Store listing**: dán từ `listing.md`, upload icon, 5 screenshot, promo tile.
6. Tab **Privacy practices**: single purpose, giải trình từng quyền, data usage = không thu thập, privacy policy URL.
7. Tab **Distribution**: Public (hoặc Unlisted để thử trước), chọn quốc gia.
8. **Submit for review** — thường vài ngày.

## Cập nhật bản sau

Tăng `version` trong `apps/extension/public/manifest.json` (và `apps/extension/package.json`), chạy lại bước 2, upload ở tab **Package**.
