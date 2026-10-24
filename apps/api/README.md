# @md-reader/api

Cloudflare Worker duy nhất của md-reader. Phục vụ:

- `/api/*` — API chia sẻ (D1).
- `/parties/doc-room` — phòng cộng tác Yjs (Durable Object, SQLite).
- Static `/s/:token` và mọi đường dẫn khác — build của `apps/web` (binding `ASSETS`, chế độ SPA).

## Chạy local

```
pnpm --filter @md-reader/api dev     # wrangler dev, cổng 8787
```

Web dev server proxy `/api` và `/parties` sang cổng 8787.

## Deploy

```
source ~/.config/md-reader/cloudflare.env
pnpm deploy:api
```

Script build `apps/web` rồi chạy `wrangler deploy`. Không ghi token hay account id vào repo.

## Migration D1

```
pnpm --filter @md-reader/api exec wrangler d1 migrations apply md-reader --remote
```

(dùng `--local` khi chạy thử trên máy).

## Gói Free

Chỉ dùng sản phẩm của Workers Free: Workers, Durable Objects (SQLite), D1, static assets. Không R2, không KV, không tính năng trả phí.
