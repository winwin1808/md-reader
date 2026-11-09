# Session Handover — md-reader

Cập nhật: 2026-11-09. **Phase 20 HOÀN TẤT**, MR phase 20 đã mở, chưa merge. Phase 18 đã merge (MR #20). MR #19 (phase 19) đã merge vào `main`.

## Phase 20 — Trang chào mới + hướng dẫn từng bước (2026-11-09)

Spec `docs/superpowers/specs/2026-11-09-phase-20-design.md` (shipped) · plan `docs/superpowers/plans/2026-11-09-phase-20-<sub>-plan.md`. Branch `phase-20`, MR → `main` đã mở, **chưa merge**. Phase 18 đã merge (MR #20).
- `GuidedTour` (`packages/ui/src/components/GuidedTour.tsx`, CSS `theme/tour.css` import ở đầu `viewer.css` — `@import` phải đứng trước mọi luật, có test kiểm).
- Mốc `data-tour` trên TopToolbar; bước tour ở `apps/extension/src/app/tour.ts`; tự chạy một lần khi trang chào mở mẫu (`&tour=1`, khoá `mdr:tour-done`); Cài đặt → Trợ giúp → "Xem hướng dẫn từng bước".
- Trang chào mới (`WelcomePage.tsx`, `welcome.css`): tờ giấy có ghi chú lề + checklist có thanh tiến độ.
- CI: `compact.flow.test.tsx` dùng `vi.stubEnv` → không còn cần `apps/extension/.env.local`.
- Test: core 334 · ui 614 · extension 645 · api 244 · web 64 · mcp 47 · e2e 12.
- Nợ: memo `help` trong App không có tác dụng (vô hại); thiếu test App cho tự mở tour/ẩn ReviewPrompt/speaker; index bước khi `steps` đổi độ dài lúc đang mở; menu hẹp không có mốc riêng.
- Người làm: merge MR phase 20 → `pnpm --filter extension package` lại → nộp 1.5.0 theo thứ tự phát hành ở mục Phase 18.

## Phase 18 — Vòng đời người dùng, v1.5.0 (2026-11-09)

Spec `docs/superpowers/specs/2026-11-09-phase-18-design.md` (`Status: shipped`) · plan `docs/superpowers/plans/2026-11-09-phase-18-<sub>-plan.md` (15 phase con, mỗi plan có Handoff + Deferred).

**Bây giờ đúng (trên `phase-18`):**
- Worker: `onInstalled`/`onStartup` tuần tự, trạng thái `mdr:lifecycle` (`decideLifecycle` thuần); cài mới mở `app.html?welcome=1` đúng một lần — sự kiện `install` lặp lại khi đã có `startedAt` (Chromium bắn lại lúc khởi động profile có bản unpacked) không mở lại, không đặt lại bộ đếm; cập nhật lớn mở "Có gì mới" một lần (cờ `showOnUpdate`); `setUninstallURL` → `site/uninstall.html?v&lang`.
- Trang chào + tài liệu mẫu song ngữ + checklist trạng thái thật; "Có gì mới" + chấm báo + công tắc trong Cài đặt → "Cập nhật".
- Máy chủ: bảng `feedback` (migration `0005`, không cột IP/định danh), `POST /api/feedback` (bẫy `website`, 5/IP/ngày, 500/ngày, không đọc `x-mdr-install`), `GET /api/admin/feedback`, cron xoá > 180 ngày.
- `site/uninstall.html`: góp ý lý do gỡ tự nguyện, ô bẫy `mdr_hp`, lỗi → mailto.
- Cài đặt → "Trợ giúp & góp ý" (`FeedbackForm`, `feedback-client.ts`); lời mời đánh giá một lần (≥ 10 lần mở, ≥ 7 ngày; quyết định ở khoá riêng `mdr:review-decision`, cửa sổ speaker không đếm, dải nổi, ẩn khi in).
- Cài đặt → "Trước khi gỡ": sao lưu mọi tài liệu ra `.zip` (`backup.ts` đọc store `updates` của IndexedDB thô — không ghi, không tạo DB; `fflate` 0.8.2 nạp lười, chunk `browser.js` 4.4 KB gz), danh sách tài liệu đã chia sẻ (mở từng cái để xoá dữ liệu máy chủ).
- E2E `e2e-pw/lifecycle.spec.ts`: cài mới → chào một lần → mở mẫu → khởi động lại không mở thêm tab, `startedAt` giữ nguyên. Chạy riêng: `cd apps/extension && npx playwright test e2e-pw/lifecycle.spec.ts` (`pnpm --filter extension e2e -- <file>` không lọc).
- Quyền riêng tư (`docs/store/privacy-policy.md`, `site/privacy.html`) nêu góp ý tự nguyện, trang sau gỡ, trạng thái trên máy; ROADMAP có P18; version 1.5.0 (manifest + package.json; `release-notes.ts` đã có 1.5.0).
- Test: core 334 · ui 602 · extension 622 · api 244 · web 64 · mcp 47 · e2e 12; typecheck/build 0; content.js gz 13 660; app.js gz ~451 KB.

**Thứ tự phát hành (người làm, bắt buộc):** (1) migration D1 `0005_feedback.sql` remote + deploy Worker → (2) merge MR #20 để `site/` lên GitHub Pages → (3) mới nộp 1.5.0 lên store, kiểm lại form Data usage (góp ý tự nguyện) → (4) gỡ bản thử để kiểm tay `setUninstallURL`. Làm ngược thì URL gỡ trỏ vào trang chưa có.

**Nợ phase 18 (chi tiết ở Deferred từng plan):** các writer khác của `mdr:lifecycle` đọc-sửa-ghi cả object (`docOpens` có thể lệch một lần); `startup` có thể xoá pending "Có gì mới" khi cờ tắt; `hasUnseenNotes(null)` bỏ qua pending; route góp ý đọc hết body trước khi kiểm 8192, hạn mức không nguyên tử; host máy chủ ghi cứng trong `site/uninstall.js`; test App góp ý chỉ đi nhánh mailto khi CI không có `VITE_MDR_SERVER_URL`; sao lưu chưa xử lý tên dành riêng Windows, đóng/mở lại Cài đặt khi đang sao lưu có thể bấm lần hai.

**Phase tiếp theo:** chưa định — cần intent mới. File chưa commit của người dùng KHÔNG đụng: `docs/store/listing.md`, `docs/store/src/`, `docs/store/promo-marquee-*.png`, `apps/extension/promo/`.

## Phase 19 — PDF trình chiếu không cắt chữ (2026-11-09)

Intent `docs/superpowers/intent/2026-11-09-phase-19-pdf-trinh-chieu.md` · spec `docs/superpowers/specs/2026-11-09-phase-19-design.md` · plan `docs/superpowers/plans/2026-11-09-phase-19-<sub>-plan.md` (19a..19h2, 14 phase con).
Bây giờ đúng: dấu ngắt thủ công `<!-- slide-break -->` (`SLIDE_BREAK_MARKER`, `isSlideBreakLine`, Word bỏ dấu); `paginateBlocks` (core) chia theo chiều cao thật;
`useSlidePagination` (ui) đo trên sân khấu ẩn 1280×720, tách danh sách/bảng theo mục/hàng (bảng lặp `thead`, `ol` nối số), khối không tách được thu nhỏ (`zoom` ≥ 0.6) + cảnh báo
(`Deck` `fitWarnings`, `ExportModal` `smallSlides`); đo khối cuối gồm margin, chừa `FIT_SAFETY_PX = 2`. Present, Speaker view và khối in dùng cùng dãy slide đã chia; xuất PDF chờ chia xong
(`waitSlidesReady(signal)`, hết 7 s vẫn in, lượt hết hạn bị huỷ). Trang PDF 1280×720, `.app-container` ẩn khi in (trước đó thừa một trang Letter). Cài đặt "Tự chia slide khi nội dung dài"
(`slideAutoSplit`, mặc định bật). Nút "Ngắt slide tại đây" khi Sửa (`slideBreakInsertion` trong core, chỉ chèn khi bộ chia thật sự tách thêm slide; `splitSections` dùng chung).
Docs: ROADMAP vi/en (P19, mục yêu cầu người dùng đã xong), README vi/en, `docs/MCP*.md` có cú pháp dấu ngắt cho AI.
Test: core 334 · ui 564 · extension 481 · web 64 · e2e Playwright 11 (có `e2e-pw/slides.spec.ts`: 17 slide = 17 trang PDF, không tràn); typecheck/build 0; content.js gz 13.66 KB. api/mcp không đổi.

**MR có thêm 2 commit phase 17 chưa vào `main`:** `25c1aee` (extension 1.4.0) và `5fcf8c7` (roadmap). Phiên bản không đổi trong phase 19.

**Nợ phase 19:**
- Cửa sổ Present và Speaker tự đo riêng; nếu chia khác nhau, chỉ số `NAVIGATE` có thể lệch (chưa đồng bộ theo `slide.id`).
- Màu slide tuỳ biến chưa vào PDF vì `print.css` ép `.md-viewer *` thành đen (có từ trước).
- Lượt xuất cũ treo Mermaid kết thúc muộn có thể tắt lớp phủ của lượt sau (không hỏng PDF).
- Nút ngắt slide không phản hồi khi không chèn được (khối đầu, ngay sau dấu sẵn có, frontmatter).
- `slideBreakInsertion`: CRLF chưa fuzz; code thụt 4 cách có dòng trống bị coi là hai khối (lưới đếm vẫn chặn chèn vô hiệu).
- Chuỗi heading `h1,h2,p` có thể để `h1` lẻ cuối slide.
- Test: phím tắt `p` nới thành `toBeGreaterThanOrEqual`, test kẹp chỉ số Speaker yếu; `slides.spec.ts` còn `console.log`.

**Tiếp theo:** Phase 18 (vòng đời người dùng: onboarding, lý do gỡ, What's new theo cờ, sao lưu .zip) — spec `docs/superpowers/specs/2026-11-09-phase-18-design.md`, 15 phase con pending; chạy `plan-from-design` với 18a.

### Stale
Mục Phase 17 "Việc người làm sau merge" vẫn đúng nếu chưa publish `le-sach-mcp@1.3.2` và nộp bản store mới.

## Phase 17 — Hướng dẫn dùng AI + bản Chrome Web Store (2026-11-03)

Extension đã lên store: ID `eolclccibhickmpbpbdodbhopnddcdog` (https://chromewebstore.google.com/detail/md-reader/eolclccibhickmpbpbdodbhopnddcdog).
Plan `docs/superpowers/plans/2026-11-03-phase-17-plan.md`. Bây giờ đúng: `KNOWN_EXTENSION_IDS` = store + dev (hằng `STORE_EXTENSION_ID`/`DEV_EXTENSION_ID`),
`MCP_PACKAGE_SPEC = 'le-sach-mcp@1.3.2'` ở `@md-reader/core`, `VERSION` mcp khớp `package.json` (có test); `AiSetupGuide` trong Cài đặt → Kết nối AI
(tab Claude Code / Claude Desktop / Cursor, Sao chép, câu lệnh mẫu, mở khi chưa có client); README/site/docs trỏ store; email liên hệ privacy `qhao.work@gmail.com`;
tên extension `extName` = "LeSach – Markdown Reader & AI Editor" (chữ "MD Reader" trong UI/docs giữ nguyên). Git email repo-local đã đổi `qhao.work@gmail.com`.
Test: core 279 · ui 494 · extension 464 · mcp 47; typecheck/build 0; content.js gz 13.66 KB.

**Việc người làm sau merge — đúng thứ tự:**
1. `cd packages/mcp && pnpm build && pnpm publish --access public --no-git-checks --otp=<mã>` → `le-sach-mcp@1.3.2` (bản 1.3.1 trên npm chưa nhận ID store).
2. Sau bước 1 mới build zip extension (`node apps/extension/scripts/package.mjs`, nhớ `VITE_MDR_SERVER_URL`) và nộp bản cập nhật lên store — snippet trong app trỏ `@1.3.2`. Tăng `version` manifest trước khi nộp.
3. Cập nhật tên + email liên hệ trong Developer Dashboard nếu cần; thêm + xác minh `qhao.work@gmail.com` trên GitHub.

**Nợ phase 17:** copyFailed không tự tắt; số phiên bản trong docs/MCP*.md chưa có test; `.btn.soon` thừa ở `site/style.css`; tabpanel chưa tabIndex, tab chưa Home/End;
suite core/ui có thể đỏ khi chạy song song với build (flake dưới tải, chạy lại xanh); Firefox origin `moz-extension://<uuid>` chưa được cầu nối nhận; ID Edge chưa có.

### Stale (đã xong ở phase 17)
Mục "Trước khi nộp store" bên dưới: bước 2 (publish 1.3.1) thay bằng 1.3.2 ở trên; bước 3 (thêm ID store) đã làm.

## Trước khi nộp store (cập nhật 2026-10-29)

1. Zip 1.3.0 build **kèm máy chủ mặc định** (đặt `VITE_MDR_SERVER_URL=<địa chỉ Worker>` khi build): `node apps/extension/scripts/package.mjs` → `docs/store/md-reader-1.3.0.zip` (+ `-firefox.zip`); đã bỏ `key`.
2. Publish `le-sach-mcp@1.3.1` (khoá file khi ghim khoá): `cd packages/mcp && pnpm publish --access public --no-git-checks --otp=<mã>` (build trước).
3. Sau khi có ID extension trên store → thêm vào `KNOWN_EXTENSION_IDS` (`packages/core/src/bridge/protocol.ts`) và phát hành bản vá `le-sach-mcp`.
4. Máy chủ: ĐÃ XONG — migration remote tới `0004_last_seen` (2026-10-28), `ADMIN_SECRET` đã đặt, Worker deploy bản `2411d8e4` (cron `17 3 * * *`).
5. Form Data usage + privacy policy khớp `docs/store/listing.md` / `privacy-policy.md` (máy chủ mặc định do tác giả vận hành).

## Phase 16 — Trả nợ test, bổ sung test case (2026-10-28)

Plan `docs/superpowers/plans/2026-10-28-phase-16-plan.md` (16a..16g). Sửa thật: Worker entry export hằng số làm `wrangler dev` chết (chuyển sang limits.ts + test chặn export không phải hàm/class).
e2e cộng tác: cổng `MDR_E2E_PORT` hoặc tự chọn cổng trống; spec cập nhật theo ShareModal mới (trước đó đã đỏ), khách `locale vi-VN`; kịch bản presence tên, link xem chỉ đọc, link sửa gõ được, Thu hồi tất cả → banner.
Test làm chặt: revokeAll đổi tài liệu, khoá import 8i, 6 vector XSS tại chỗ; kiểm đỏ mọi test phase 15 (tất cả đỏ trên mã cũ); test worker `revokedUntil`;
7 test tích hợp App (làm gọn 4 nhánh, xuất khi lỗi công thức, banner). Flake IDB: 18 lượt không tái hiện → `test-setup.ts` in tên test + stack nếu xuất hiện.
Test độc lập thứ tự: extension (timer/spy/DOM/location) và ui (barrel import, cache Mermaid, spy createElement) — 6/6 lượt `--sequence.shuffle` xanh mỗi gói.
Test: core 278 · ui 484 · extension 464 · web 64 · api 217 · mcp 46 · e2e 9 · e2e:collab 2. **Nợ test còn:** e2e chưa kiểm blame theo dòng (chưa có selector ổn định).

## Phase 15 — Trả nợ phía người dùng và máy chủ (2026-10-28)

Plan `docs/superpowers/plans/2026-10-28-phase-15-plan.md` (15a..15o). Đã làm: máy chủ `POST /api/rooms/:id/links/revoke-all` (extension dùng, fallback từng link),
takedown qua D1 batch, giới hạn 413/awareness theo byte, thu hồi link dọn `owner:*`; useShare không để phòng mồ côi khi đổi tài liệu, khoá bản cài một cho mọi tab
(Web Lock) và lỗi storage riêng; KaTeX tải lười (app.js gz 511→436 KB, web 393→315 KB); Word xuất công thức OMML; ngăn lịch sử trả focus + phân trang 50;
ConfirmAgentDialog bẫy Tab đủ; manifest nhận `.Md/.Markdown/...`; `revokedUntil` tự dọn; `initials()` theo grapheme; `registerActor` chờ ≤10 s;
trạng thái đồng bộ không nháy (connecting trễ 300 ms); MCP ghi tên client, tái dùng clientID lưu cục bộ theo máy (`chrome.storage.local`, KHÔNG trong Y.Doc);
CLI MCP khoá file khi ghim; "Làm gọn tài liệu" khi phòng đầy (xoá phòng → dừng IDB → `compactStoredDoc` → reload, chặn nhập suốt luồng; mất lịch sử/blame, link cũ hết hiệu lực).
Test: core 278 · ui 484 · extension 452 · web 64 · api 216 · mcp 46 · e2e 8; typecheck/build 0; content.js gz 13.66 KB.
**Nợ còn:** làm gọn không tạm dừng autosave đĩa đã xếp hàng (ghi đúng nội dung, vô hại).

## Phase 14 — Đóng nợ rủi ro trước khi nộp store (2026-10-28)

Plan `docs/superpowers/plans/2026-10-28-phase-14-plan.md`. Đã làm: máy chủ kiểm update của link sửa TRƯỚC khi áp (`peerUpdateViolation` trong
`DocRoom.handleMessage`) — vi phạm không được phát/lưu, đóng 4403; clientID gắn theo link (`owner:<clientID>` trong DO storage, ≤4 clientID mới/kết nối);
delete set bỏ qua mục đã xoá sẵn (nối lại không bị đá); lớp hoàn tác sau áp vẫn giữ. `touchRoom` qua `ctx.waitUntil`; cron dọn theo lô tới 100 phòng/lượt;
tổng dung lượng ảnh cache 5 phút. Web: phòng đầy → chỉ đọc. Flake IDB: nghi vấn `destroy()` bị bác bỏ (y-indexeddb không mở transaction khi destroy) — thêm test hồi quy đổi tài liệu nhanh.
Test: api 209 · web 64 · extension 426; typecheck 0. **Nợ thấp:** tab web mở xuyên qua lần deploy này có thể bị 4403 một lần (phòng cũ chưa có bản ghi `owner:`);
client B gửi lại struct của link A mà máy chủ mất trước khi lưu → B bị từ chối; bản ghi `owner:` chỉ xoá khi purge phòng.

## Phase 12 — Gia cố máy chủ (2026-10-28)

Branch `phase-12` (12a..12e), spec `docs/superpowers/specs/2026-10-28-phase-12-design.md` (shipped). Đã làm: link sửa chỉ được ghi `source`
+ `meta.actors[clientID của mình]` — ghi sai chỗ (meta/history/root lạ) bị hoàn tác và đóng 4403 (`apps/api/src/peer-guard.ts`); `rooms.last_seen`
(migration `0004_last_seen`, cập nhật ≤1 lần/ngày khi nối WS); trần toàn cục ảnh 3 GiB lưu / 1 GiB mỗi ngày; cron `17 3 * * *` xoá phòng
không ai mở 90 ngày qua `deleteRoomEverywhere` (≤25 phòng/lượt) và dọn `usage_daily` cũ hơn 2 ngày. Privacy cập nhật.
Test: api 195; typecheck 0. **Nợ:** đã đóng ở phase 14.

## Phase 13 — Hoàn thiện trải nghiệm (2026-10-28)

Branch `phase-13` (13a1..13f), spec `docs/superpowers/specs/2026-10-28-phase-13-design.md` (shipped). Đã làm: toolbar extension + web báo rõ
"link bị thu hồi" (đóng 4410) / "tài liệu quá lớn" (4413, 1009) và không nối lại; banner khi tài liệu có `formatVersion` mới hơn (đóng được);
ghép cặp MCP bấm Cho phép hai lần không còn hỏng (`Entry.deciding`); nhãn alert khi đọc tại chỗ theo cài đặt ngôn ngữ (mặc định en);
web không còn `window.alert`; export HTML nhúng ảnh đường dẫn tương đối qua image resolver; flake `ux-reading.flow` (cold start worker) sửa bằng warm-up.
Test (máy rảnh): core 263 · ui 474 · extension 424 · web 63 · mcp 42; typecheck/build 0; content.js gz 13.66 KB.
**Nợ:** flake IDB `TransactionInactiveError` không tái hiện được (nghi `persistence.destroy()` không await trong cleanup `useDocSession`);
link sửa khi phòng đầy vẫn cho gõ (chỉ banner báo); logic trạng thái cuối lặp ở extension `bindRoom` và web `collab`.

## Phase 11 — Vá bảo mật trước 1.3.0 (2026-10-27)

Branch `phase-11` (11a..11k), MR `phase-11` → `main` mở, **chưa merge**. Spec `docs/superpowers/specs/2026-10-27-phase-11-design.md`;
kết quả audit + trạng thái từng mục ở `docs/research/security-audit-2026-10-27.md`.

**Sau khi merge (theo thứ tự):**
1. Deploy Worker: `source ~/.config/md-reader/cloudflare.env && pnpm --filter api deploy` (không migration mới). Smoke: mở link chia sẻ, thu hồi → tab đang mở bị ngắt ngay.
2. Build lại gói store 1.3.0 (`docs/store/md-reader-1.3.0.zip`, bỏ `key`).
3. Publish npm: `cd packages/mcp && pnpm publish --access public --no-git-checks --otp=<mã>` — giao thức cầu nối **v2**, không tương thích bản trước (chưa ai dùng).
4. Sinh lại `site/privacy.html` từ `docs/store/privacy-policy.md` (đã sửa câu thu hồi tức thì + IPv6 /64).

**Nợ mới:** máy chủ chưa lọc peer ghi `meta` (formatVersion/aiUnsaved); chưa có trần toàn cục bytes ảnh / TTL phòng; ghim khoá giữa hai tiến trình CLI cùng lúc có thể đua;
`decide(allow)` bấm hai lần → phải ghép lại; phòng đầy 64 MiB chỉ thu nhỏ được bằng xoá phòng; client hiển thị đóng 4413 như mất kết nối; banner "doc phiên bản mới hơn" chưa có;
flake `ux-reading.flow` / một test extension dưới tải vẫn thấy thỉnh thoảng.

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
3. `npm publish` `le-sach-mcp@1.3.0`: tài khoản npm `winwin1808` bật 2FA → `cd packages/mcp && pnpm publish --access public --no-git-checks --otp=<mã>` (build trước).
4. Chrome Web Store: `node apps/extension/scripts/package.mjs` (zip đã bỏ `key`), nộp 1.3.0; khi có ID store → thêm vào
   `KNOWN_EXTENSION_IDS` (`packages/core/src/bridge/protocol.ts`) và phát hành mcp bản vá.
5. Điền liên hệ trong `docs/store/privacy-policy.md`; form Data usage khớp `listing.md`.
6. Khuyến nghị: chạy skill `security-audit` (đã thêm ở `.claude/skills/security-audit`, MIT, Cloudflare) ở chế độ audit đầy đủ trước khi nộp store.
7. ~~Site~~ — không tạo org; site deploy từ `site/` lên GitHub Pages của repo: https://winwin1808.github.io/md-reader/ (workflow `.github/workflows/pages.yml`, chạy khi `site/**` đổi trên `main`).

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

- ~~`privacy-policy.md` còn dòng liên hệ placeholder~~ — đã điền.
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
