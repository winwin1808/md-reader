# Tự dựng máy chủ đồng bộ (Chia sẻ & cộng tác)

Đọc, sửa, lưu file, xuất, trình chiếu, mindmap **không cần máy chủ**. Chỉ **Chia sẻ** (link xem/sửa, cùng sửa, ảnh trong
tài liệu đã chia sẻ) cần một máy chủ đồng bộ. Máy chủ là một Cloudflare Worker chạy được trong **gói miễn phí**. Bản extension trên cửa hàng đã gắn sẵn một máy chủ mặc định do tác giả vận hành; tự dựng máy chủ riêng là tuỳ chọn (đổi ở Cài đặt → Cộng tác).

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

Migration gồm `0001_init`, `0002_assets`, `0003_tenancy`, `0004_last_seen`. Triển khai đã có từ trước **phải chạy lại** `wrangler d1 migrations apply md-reader --remote` (lệnh chỉ áp migration còn thiếu).

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

## Cron dọn dẹp tự động

`apps/api/wrangler.jsonc` khai `"triggers": { "crons": ["17 3 * * *"] }`, nên cron được deploy cùng `pnpm deploy:api`, không cần cấu hình thêm. Mỗi ngày lúc 03:17 UTC nó xoá phòng không ai mở trong 90 ngày (cùng link và ảnh; tối đa 100 phòng mỗi lượt, theo lô 25) và xoá các dòng `usage_daily` cũ hơn 2 ngày.

## Gỡ nội dung vi phạm (`ADMIN_SECRET`)

Gỡ nội dung bằng `apps/api/scripts/takedown.mjs` cần một secret quản trị trên Worker:

```bash
pnpm --filter @md-reader/api exec wrangler secret put ADMIN_SECRET   # nhập giá trị khi được hỏi, không ghi vào repo
MDR_API_URL=https://md-reader-api.<tên-của-bạn>.workers.dev MDR_ADMIN_SECRET=<secret> node apps/api/scripts/takedown.mjs <roomId>
```

Chưa đặt `ADMIN_SECRET` thì endpoint gỡ nội dung trả 404 (coi như không tồn tại).

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

100 000 request/ngày · D1 500 MB · Durable Objects SQLite 5 GB. Chi tiết: `docs/DESIGN.md` §5.6.

## Giới hạn của máy chủ

- Ảnh: ≤ 2 MiB/ảnh, ≤ 50 MB ảnh/phòng; trần toàn máy chủ 3 GiB ảnh lưu trữ và 1 GiB tải lên mỗi ngày.
- Đồng bộ: ≤ 16 MiB/message, ≤ 64 MiB/phòng.
- Theo ngày: giới hạn theo khoá bản cài và theo IP (IPv6 tính /64) cho tạo phòng, tải ảnh, báo cáo; vượt thì trả **429** kèm thời gian chờ.
- Phòng đầy (64 MiB): chủ tài liệu bấm **"Làm gọn tài liệu"** trong hộp Chia sẻ — phòng cũ bị xoá, lịch sử sửa và blame bị bỏ, link cũ ngừng hoạt động, sau đó chia sẻ lại để có link mới.

## Cập nhật máy chủ

```bash
git pull && pnpm install
pnpm --filter @md-reader/api exec wrangler d1 migrations apply md-reader --remote
pnpm deploy:api
```
