# Session Handover — md-reader

Cập nhật: 2026-10-26. Branch: `main` — **phase 10 đã merge** (PR https://github.com/winwin1808/md-reader/pull/7, commit `28c06c5`).

## Phase 10 — MCP cục bộ + gia cố multi-tenant (v1.3.0)

Spec `docs/superpowers/specs/2026-10-26-phase-10-design.md` (shipped), intent `docs/superpowers/intent/2026-10-26-phase-10-mcp-cuc-bo.md`,
plan `docs/superpowers/plans/2026-10-26-phase-10-10{a..o}-plan.md`. Hướng dẫn người dùng: `docs/MCP.md` / `docs/MCP.en.md`.

Trạng thái xanh lúc ship (đo thật trên `phase-10`):

```
packages/core test        249 passed
packages/ui test          468 passed
apps/extension test       400 passed (15/15 lượt dưới tải CPU sau 10o.5)
apps/web test              57 passed
apps/api test             129 passed
packages/mcp test          34 passed
extension e2e               8 passed (có mcp.spec.ts: CLI MCP thật ↔ extension)
api smoke:tenancy          OK (wrangler dev + D1 --local; 429 ở phòng thứ 21)
pnpm -r typecheck / build  exit 0
dist/content.js gz         13 615 B (ngân sách 61 440)
dist/worker.js gz          ~101 KB (tăng từ ~72 KB: worker kéo yjs/y-indexeddb cho publish_doc)
version                    1.3.0 (extension + le-sach-mcp)
```

### Việc người làm trước khi phát hành 1.3.0
1. ~~Duyệt + merge MR #7~~ — đã merge 2026-10-26 (`28c06c5`), CI check + e2e xanh.
2. Máy chủ: `set -a; . ~/.config/md-reader/cloudflare.env` rồi `wrangler d1 migrations apply <DB> --remote` (migration `0003_tenancy`),
   `wrangler secret put ADMIN_SECRET`, `pnpm deploy:api`; chạy `scripts/smoke.mjs` với URL thật. Gỡ nội dung: `apps/api/scripts/takedown.mjs`.
3. `npm publish` `le-sach-mcp@1.3.0` (cần `pnpm --filter le-sach-mcp build` trước).
4. Chrome Web Store: `node apps/extension/scripts/package.mjs` (zip đã bỏ `key`), nộp 1.3.0; khi có ID store → thêm vào
   `KNOWN_EXTENSION_IDS` (`packages/core/src/bridge/protocol.ts`) và phát hành mcp bản vá.
5. Điền liên hệ trong `docs/store/privacy-policy.md`; form Data usage khớp `listing.md`.
6. Khuyến nghị: chạy skill `security-audit` (đã thêm ở `.claude/skills/security-audit`, MIT, Cloudflare) ở chế độ audit đầy đủ trước khi nộp store.
7. Site `le-sach.github.io`: tạo org GitHub `le-sach` (web UI), rồi repo `le-sach/le-sach.github.io` từ `site/`, đổi URL tuyệt đối `md-reader-winwin.pages.dev` → `le-sach.github.io`, bật Pages.

### Khoá / bí mật (ngoài repo, không commit)
- Khoá riêng extension: `~/.config/md-reader/extension-key.pem` (0600) — sinh ra `key` trong manifest để ID cố định `ojcemoafaibjfghljkbagnkbgljakbji`.
- Credential Cloudflare: `~/.config/md-reader/cloudflare.env` — chỉ `source`, không in.
- File ghép cặp MCP: `~/.config/md-reader/mcp.json` (pairKey — không log/in).

### Nợ mở từ phase 10
- Remote MCP + OAuth — hoãn (ghi ở ROADMAP), làm bản tự host trước khi có nhu cầu.
- `bindRoom` chưa xử lý close 4410 (phòng bị xoá từ máy khác → provider nối lại mãi); `getInstallKey` lỗi storage hiện là "lỗi mạng"; hai tab lần đầu có thể sinh hai khoá.
- useShare: cửa sổ render→effect khi đổi docId (binding cũ còn trong ref); đổi tài liệu giữa `enable()` để lại phòng mồ côi (không tạo link).
- `usage_daily` không bao giờ được dọn (privacy đã nói "chưa tự xoá") — nên có cron/dọn.
- originKind `mcp` + actor checkpoint theo tên client (đang là "AI"); `meta.actors` thêm một mục mỗi lần `update_doc`.
- `addTakedown` không atomic; `revokedUntil` không dọn; client bị thu hồi nối lại trong 60 s không được hỏi lại (docs đã ghi).
- Flake `src/flows/ux-reading.flow.test.tsx` thấy 1 lần dưới tải CPU; `namesBefore` trong useDocSession.test chưa reset ở mọi beforeEach.
- ConfirmAgentDialog: bẫy Tab chỉ ở hàng nút.

## Trước phase 10 (lịch sử)

- **Phase 9 (Sửa thẳng trên trang) đã ship** trên branch `phase-9`, MR vào `main` (xem CLAUDE.md Status 2026-10-25). Token Cloudflare để deploy nằm ở `~/.config/md-reader/cloudflare.env` (ngoài repo): `set -a; . ~/.config/md-reader/cloudflare.env; pnpm deploy:api`.

- Phase 6 và 7 đã merge vào `main` (PR #1, #2, #3).
- **Phase 8 (Chia sẻ & cộng tác) đã ship và đã merge** vào `main` ngày 2026-10-25: MR https://github.com/winwin1808/md-reader/pull/4 (commit `e0b9a75`).
  Spec `docs/superpowers/specs/2026-10-24-phase-8-design.md`,
  intent `docs/superpowers/intent/2026-10-24-phase-8-chia-se-cong-tac.md`. Hàng đợi 8a0..8k (thêm 8j2 gia cố) tất cả done.
- **Worker đã deploy** lên tài khoản Cloudflare của người dùng: `https://md-reader-api.<subdomain>.workers.dev`
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

- ~~Không có endpoint xoá dữ liệu phòng / không rate limit~~ — đã làm ở phase 10 (`DELETE /api/rooms/:id`, giới hạn/ngày D1). Vẫn chưa có revoke-all phía server.
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
