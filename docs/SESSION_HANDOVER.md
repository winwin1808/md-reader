# Session Handover — md-reader

Cập nhật: 2026-10-25. Branch: `main` — phase 8 đã merge vào `main` (PR #4, commit `e0b9a75`). Bước kế: publish 1.1.0 lên Chrome Web Store.

## Đang ở đâu

- Phase 6 và 7 đã merge vào `main` (PR #1, #2, #3).
  **đã merge** vào `main` ngày 2026-10-25. Spec `docs/superpowers/specs/2026-10-24-phase-8-design.md`,
  **chưa merge** — chờ người duyệt. Spec `docs/superpowers/specs/2026-10-24-phase-8-design.md`,
  intent `docs/superpowers/intent/2026-10-24-phase-8-chia-se-cong-tac.md`. Hàng đợi 8a0..8k (thêm 8j2 gia cố) tất cả done.
- **Worker đã deploy** lên tài khoản Cloudflare của người dùng: `https://md-reader-api.qhao-work.workers.dev`
  (Workers Free: Durable Objects SQLite + D1, không R2/KV). D1 remote: "No migrations to apply".
  Đây là máy chủ mặc định (`DEFAULT_SERVER_URL` trong `apps/extension/src/shared/collab.ts`).
- Không còn phase nào trong bảng; phase tiếp theo cần intent mới (`brainstorm-intent`/`capture-intent`).

Model: subagent sonnet (builder, reviewer, spiker) / haiku (guard, git); opus chỉ ở main loop cho spec/plan. Luôn pin `model`.

## Trạng thái xanh lúc ship phase 8 (đo thật)

```
packages/core test             226 passed
packages/ui test               401 passed
apps/extension test            283 passed (2 lượt liên tiếp)
apps/web test                   45 passed (2 lượt)
apps/api test                   77 passed
pnpm -r typecheck / build       exit 0
pnpm --filter extension e2e     5 passed
pnpm --filter extension e2e:collab   1 passed (wrangler dev cục bộ, cổng 8787)
dist/content.js                 gz ~13.35 KB (giới hạn 61 440 B)
dist/worker.js                  gz ~72 KB (service worker, không có ngân sách)
manifest                        1.1.0
```

## Phase 8 đã làm gì (tóm tắt)

`apps/api` Worker (y-partyserver trên DO SQLite, token D1 chỉ lưu SHA-256 + prefix, 410 khi hết
hạn/thu hồi, view link không ghi được) · `apps/web` trang xem/sửa qua link · `ShareModal` +
quản lý link · provider WebSocket trong extension, Settings "Cộng tác" (URL máy chủ cấu hình
được) · presence (tên tự khai, màu, con trỏ) · blame theo dòng · lịch sử checkpoint + khôi phục ·
core inject plugin (`@md-reader/core/plugins`) · đọc tại chỗ trong content script (render ở
service worker — 7o xong) · khoá Web Lock khi import cùng URL · e2e cộng tác · 8j2 gia cố
(race map actors, giới hạn cursor awareness, lineAuthors tuyến tính, anchor content, timeout test) ·
8k store kit: privacy policy + listing nói đúng về máy chủ mặc định, phiên bản 1.1.0.

## Trước khi nộp Chrome Web Store

- `docs/store/privacy-policy.md` còn dòng liên hệ placeholder — điền email hỗ trợ công khai.
- Form "Data usage" trên dashboard phải khớp `docs/store/listing.md` (nội dung + tên hiển thị
  gửi lên máy chủ khi bật chia sẻ).
- Máy chủ mặc định là Worker của tác giả → tác giả là bên vận hành dữ liệu người dùng store.

## Bảo mật / tài khoản

- Credential Cloudflare chỉ ở `~/.config/md-reader/cloudflare.env` (chmod 600, ngoài repo); chỉ `source`, không in.
- **Nên làm**: thu hồi token cũ `rough-lab-2b98` và xoay (rotate) token hiện tại sau phase 8.

## Món nợ đang mở

- **Không có endpoint xoá dữ liệu phòng**: tắt chia sẻ/thu hồi chỉ đặt `revoked_at`; nội dung DO và
  dòng D1 vẫn còn. Cần `DELETE /api/rooms/:id` (owner) xoá DO storage + D1 trước khi nhiều người dùng.
- Không có rate limit cho `POST /api/rooms`; không có revoke-all phía server.
- `registerActor` ở doc chưa khởi tạo chờ map `actors` vô hạn (phòng luôn seed từ doc chủ nên không xảy ra thực tế).
- Giới hạn cursor awareness đếm ký tự, không phải byte (đã chặn tổng 16 KB/message); 413 đếm theo UTF-16.
- History drawer: đè nội dung, không trả focus khi đóng, chưa phân trang.
- Test yếu: revokeAll đổi doc, test khoá 8i (a)/(b), tên presence trong e2e collab, `__pwned`.
- Cổng 8787 cứng trong e2e:collab; `initials()` với ZWJ/NFD.
- Trạng thái nháy khi rebind; KaTeX/mermaid chưa lazy ở app page; bundle web lớn.
- Flake IDB `TransactionInactiveError` (cũ, không tái hiện); flake "window is not defined" đã sửa ở 8i.
- Tên file hoa-thường lẫn lộn (`Readme.Md`) không khớp pattern Chrome; Word xuất công thức dạng TeX thô.

## Công cụ cục bộ (không commit)

- `.git/mdr-gate.sh <pkg...>` — test các package + typecheck + build, in tóm tắt.
- `.git/mdr-merge.sh <sub> <branch> "<tóm tắt>"` — đặt `PHASE=8` cho phase 8.

## Đã cũ

- Mọi chỗ nói "không máy chủ / chạy hoàn toàn trên máy" không còn đúng từ phase 8 (store kit đã sửa).
