# Tự dựng máy chủ đồng bộ (Chia sẻ & cộng tác)

Đọc, sửa, lưu file, xuất, trình chiếu, mindmap **không cần máy chủ**. Chỉ **Chia sẻ** (link xem/sửa, cùng sửa, ảnh trong
tài liệu đã chia sẻ) cần một máy chủ đồng bộ. Máy chủ là một Cloudflare Worker chạy được trong **gói miễn phí**.

## Cần gì

- Tài khoản Cloudflare (miễn phí): https://dash.cloudflare.com/sign-up
- Node 22+, pnpm, repo này đã `pnpm install`.

## Cách 1 — đăng nhập bằng trình duyệt (dễ nhất)

```bash
cd md-reader
pnpm --filter @md-reader/api exec wrangler login        # mở trình duyệt, bấm Allow
pnpm --filter @md-reader/api exec wrangler d1 create md-reader
```

Lệnh `d1 create` in ra một `database_id`. Mở `apps/api/wrangler.jsonc`, thay `database_id` trong mục `d1_databases`
bằng giá trị đó (giữ `database_name: "md-reader"`). Sau đó:

```bash
pnpm --filter @md-reader/api exec wrangler d1 migrations apply md-reader --remote
pnpm deploy:api
```

Cuối lệnh deploy có dòng `https://md-reader-api.<tên-của-bạn>.workers.dev` — đó là **địa chỉ máy chủ**.

## Cách 2 — dùng API token (máy không có trình duyệt / CI)

1. Cloudflare → My Profile → API Tokens → **Create Token** → mẫu "Edit Cloudflare Workers", thêm quyền **D1: Edit**.
2. Lưu ngoài repo:
   ```bash
   mkdir -p ~/.config/md-reader && umask 077
   printf 'CLOUDFLARE_API_TOKEN=%s\nCLOUDFLARE_ACCOUNT_ID=%s\n' '<token>' '<account id>' > ~/.config/md-reader/cloudflare.env
   ```
3. Chạy các lệnh của cách 1 (bỏ `wrangler login`) với token đã nạp:
   ```bash
   set -a; . ~/.config/md-reader/cloudflare.env; set +a
   ```

## Kiểm tra

```bash
curl https://md-reader-api.<tên-của-bạn>.workers.dev/api/health     # {"ok":true}
node apps/api/scripts/smoke.mjs https://md-reader-api.<tên-của-bạn>.workers.dev   # ASSETS OK · SMOKE OK
```

## Gắn vào extension

MD Reader → **Cài đặt → Cộng tác → Máy chủ đồng bộ** → dán địa chỉ ở trên → **Kiểm tra kết nối**. Hoặc bấm **Chia sẻ**:
khi chưa có máy chủ, hộp thoại hiện ô nhập địa chỉ và nút kiểm tra ngay tại đó.

Muốn build sẵn địa chỉ vào extension: `VITE_MDR_SERVER_URL=https://… pnpm --filter extension build`.

## Giới hạn gói miễn phí (đủ cho dùng cá nhân / nhóm nhỏ)

100 000 request/ngày · D1 500 MB (ảnh ≤ 2 MB/ảnh, 50 MB/tài liệu) · Durable Objects SQLite 5 GB. Chi tiết: `docs/DESIGN.md` §5.6.

## Cập nhật máy chủ

```bash
git pull && pnpm install
pnpm --filter @md-reader/api exec wrangler d1 migrations apply md-reader --remote
pnpm deploy:api
```
