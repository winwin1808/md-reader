# Design: Phase 11 — Vá bảo mật trước khi phát hành 1.3.0
Author: haonq (coordinator: Claude Opus). Status: designed. Phase: 11
Intent: docs/superpowers/intent/2026-10-27-phase-11-va-bao-mat.md
Audit nguồn: `~/security-audit-skill/md-reader/run-1/NEEDS-VALIDATION.md` (8 mục, id ghi trong ngoặc).

## Approach chosen

Vá tại điểm quyết định tin cậy cuối cùng, mỗi lỗ hổng một test hồi quy tái hiện đường tấn công (đỏ trước khi vá):
escape/allowlist thay cho "sanitize thêm lần nữa"; quyền link kiểm ở DO (nơi giữ socket) chứ không chỉ ở cache isolate;
cầu nối MCP đổi sang xác thực chữ ký hai chiều (không bí mật nào qua dây). Bác bỏ: (a) chỉ thêm CSP cho web — không che app page
và nội dung export; (b) HMAC với `pairKey` dùng chung — vẫn phải truyền khoá lần ghép cặp đầu; (c) lọc nội dung Yjs theo kiểu ở
máy chủ — đúng hơn cho mục 5 nhưng phải giải mã update trong DO, để phase sau.

Giả định đã chốt: 1.3.0 chưa phát hành → giao thức cầu nối đổi thẳng sang `BRIDGE_PROTOCOL = 2`, không giữ tương thích v1.
Phiên bản vẫn 1.3.0. Không đổi schema Y.Doc.

## Sub-phase queue
- 11a: done
- 11b: done
- 11c: done
- 11d: done
- 11e: done
- 11f1: done
- 11f2: done
- 11g: planned
- 11h: pending
- 11i: pending
- 11j: pending
- 11k: pending

## Sub-phases

### 11a — XSS qua info string của code fence (audit #1, `ui-viewer-code-lang-class-innerhtml`)
- `packages/core/src/render/render.ts`: allowlist className của `code`/`span` đổi từ `/^language-/` thành
  `/^language-[A-Za-z0-9_+#.-]{1,40}$/` (và giữ các lớp `hljs*` sẵn có).
- `packages/ui/src/Viewer.tsx`: header khối code dựng bằng DOM API (`createElement` + `textContent`), không `innerHTML` với dữ liệu
  tài liệu; nhãn ngôn ngữ chỉ lấy từ lớp khớp `/^language-([A-Za-z0-9_+#.-]{1,40})$/`, không khớp → không hiện badge.
  Nút copy giữ markup tĩnh (không chứa dữ liệu tài liệu).
- Test: render ```` ```<img/src=x/onerror=window.__x=1> ```` qua `renderToHtml` (core) → không còn class chứa `<`; mount Viewer với
  HTML có `class="language-<img …>"` thủ công (giả định sanitize hỏng) → không phát sinh `<img>` trong header, `window.__x` undefined.
- Kiểm thêm: content script không dùng đường header này (guard xác nhận); nếu có `innerHTML` với dữ liệu tài liệu ở content → cùng sửa.

### 11b — CSP web + export HTML (audit #1 phần CSP, #4 `export-html-image-content-type-attribute-injection`)
- `apps/web/public/_headers` (Workers static assets đọc file này): cho `/*`
  `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' wss: https:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. Builder kiểm `apps/web/dist/index.html` không có script inline
  (nếu có → chuyển ra file hoặc thêm hash, ghi trong báo cáo).
- `packages/core/src/export/html.ts`: `defaultFetchImage` chỉ nhận MIME khớp
  `/^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml|x-icon)$/i`, sai → không nhúng (giữ nguyên `src` gốc); giá trị thuộc tính được
  escape (`&`, `"`, `'`, `<`, `>`). File export có `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; font-src data:">`.
- Test: fetcher giả trả `mimeType: 'x" onerror="window.__pwn=1'` → output không chứa `onerror`; MIME hợp lệ vẫn nhúng `data:image/png;base64,`;
  output có meta CSP.

### 11c — Thu hồi/hết hạn link có hiệu lực ngay (audit #2, `ws-revoked-or-expired-link-keeps-access`)
- `store.resolve(token)` trả thêm `expiresAt: number | null` và `tokenPrefix: string` (kiểu nội bộ api, không đổi API công khai).
- `handleRequest /parties/doc-room/:id`: chuyển cho DO thêm header `x-mdr-prefix`, `x-mdr-expires` (ms hoặc rỗng).
- `DocRoom.onConnect`: từ chối (đóng 4410) nếu prefix nằm trong tập thu hồi đã lưu (`kv` key `revoked:<prefix>`) hoặc đã hết hạn;
  `conn.setState({ role, prefix, expiresAt })`. `handleMessage`: kết nối có `expiresAt <= now` → đóng 4410, bỏ message.
- Route nội bộ DO `POST …/revoke` (`x-mdr-internal: 1`, body `{ prefix }`): lưu `revoked:<prefix>`, đóng mọi kết nối có prefix đó (4410).
- `DELETE /api/rooms/:id/links/:prefix`: sau `store.revoke` → xoá mọi entry `authCache` của phòng đó + gọi route nội bộ revoke
  (lỗi gọi DO → log, vẫn trả 2xx vì D1 đã chặn kết nối mới sau TTL; DO lưu tập thu hồi nên isolate khác có cache cũ cũng bị chặn).
- Test (room.test.ts + api.test.ts có sẵn harness): socket edit đang mở bị đóng sau revoke và update gửi sau đó không được áp; kết nối mới
  cùng token bị từ chối dù authCache còn; link hết hạn trong lúc mở → message kế tiếp bị bỏ + đóng.

### 11d — Xoá phòng: purge trước, kiểm kết quả, thử lại được (audit #8, `do-purge-failure-silently-orphans-content`)
- `apps/api/src/index.ts`: dep `purge(roomId)` trả `Promise<boolean>` = response DO `ok`.
- `deleteRoomEverywhere`: thứ tự mới — purge DO → assets.deleteRoom → limits.forgetRoom → `store.deleteRoom` (D1) → xoá authCache.
  Purge trả false/ném → dừng, trả `{ ok: false, retryable: true }`, KHÔNG xoá D1. Route owner trả 502 `{ error: 'PURGE_FAILED' }`;
  takedown admin cũng vậy. `DocRoom.purge()` idempotent (đã có tombstone) nên gọi lại an toàn.
- Test: purge giả trả false → 502, phòng/link D1 còn, gọi lại thành công → 204 và mọi thứ đã xoá.

### 11e — Quota theo IP luôn áp dụng, IPv6 /64 (audit #7 phần quota)
- `limits.ts` `subjectFrom`: IPv6 → hash của 4 nhóm đầu (/64); IPv4 giữ nguyên.
- `decide('asset')` / `record('asset')`: bộ đếm `asset` và `asset_bytes` theo IP LUÔN được kiểm và cộng, kể cả khi phòng có khoá bản cài
  (khoá bản cài vẫn có quota riêng). Ngưỡng giữ `LIMITS` hiện có.
- Test: 10 khoá bản cài khác nhau cùng một IP → bị 429 khi tổng bytes vượt `assetBytesPerIpPerDay`; hai IPv6 khác chỉ ở 64 bit cuối
  dùng chung bộ đếm.

### 11f — Trần kích thước Yjs + awareness (audit #7 phần storage, mục chưa soi về awareness)
> Tách lúc plan: **11f1** trần kích thước (room.ts + persistence.ts), **11f2** awareness (protocol.ts + room.ts). Trần message nâng từ 2 MiB lên **16 MiB**: lần chia sẻ đầu gửi cả doc trong một step2 (spike phase 9: doc 2.4 MB ảnh nhúng) — 2 MiB sẽ làm hỏng; 16 MiB < giới hạn 32 MiB message WebSocket của Cloudflare.
- `room.ts`: message nhị phân > `MAX_MESSAGE_BYTES = 2 MiB` → đóng 1009, không áp. Tổng dung lượng phòng (snapshot + updates theo
  `stats`) > `MAX_ROOM_BYTES = 64 MiB` → bỏ update mới từ mọi kết nối, gửi lỗi (đóng 4413 cho kết nối gửi).
- Awareness: relay chỉ chấp nhận entry có clientID đã gắn với chính kết nối đó (clientID đầu tiên kết nối khai báo được ghi vào
  `conn.state.clientIds`, tối đa 4); entry của clientID khác bị lọc bỏ trước khi chuyển tiếp.
- Test: message 2 MiB + 1 → đóng 1009; phòng vượt trần → update bị bỏ; awareness giả clientID của kết nối khác không tới peer.

### 11g — Sửa của AI không tự ghi xuống đĩa (audit #3, `mcp-update-doc-autosaves-to-disk-without-confirmation`)
- `useDocSession`: thêm state `aiUnsaved: boolean` — bật khi transaction origin `'mcp'` đổi source; tắt khi lưu thành công
  (`markSaved`) hoặc khi người dùng sửa tay (transaction local origin null) — sửa tay = đồng ý bản hiện tại.
- `useFileSave`: auto-save bỏ qua khi `aiUnsaved` (Cmd+S / nút Lưu vẫn lưu và tắt cờ).
- UI: chỉ báo trạng thái lưu hiện "AI đã sửa — bấm Lưu để ghi ra file" / "AI edited — press Save to write to file" (i18n vi + en).
- `docs/MCP.md` + `.en.md`: update_doc chỉ sửa trong MD Reader; ghi ra file cần người dùng lưu.
- Test: update origin 'mcp' với handle granted → không gọi `saveToHandle` sau 2 s; sửa tay sau đó → auto-save chạy; Cmd+S → lưu.

### 11h — `formatVersion` lạ từ peer không làm hỏng phiên chủ (audit #5, `core-doc-peer-formatversion-poison`)
- `packages/core/src/doc/doc.ts`: `ensureDoc(doc, opts?: { tolerateNewer?: boolean })` — khi `formatVersion > FORMAT_VERSION` và
  `tolerateNewer` → không ném, không migrate, không ghi đè field, trả `{ newer: true }` nếu cấu trúc 3 kiểu (`source` Y.Text,
  `meta` Y.Map, `history` Y.Array) hợp lệ; cấu trúc sai vẫn ném.
- `useDocSession` gọi với `tolerateNewer: true`, bắt mọi lỗi của khối khởi tạo (đặt trạng thái lỗi hiển thị thay vì promise treo);
  `doc-registry.writeDocText` cũng `tolerateNewer: true`. Banner nhẹ "Tài liệu có dấu phiên bản mới hơn" khi `newer`.
- Test: peer đặt formatVersion 99 → `ensureDoc(..., {tolerateNewer:true})` không ném, source vẫn ghi được, field giữ 99;
  không tolerate → vẫn ném như cũ.

### 11i — Cầu nối MCP v2: core + máy chủ MCP (audit #6, `mcp-loopback-bridge-…`)
`packages/core/src/bridge/protocol.ts`:
```ts
export const BRIDGE_PROTOCOL = 2
export interface BridgeHello { type: 'hello'; protocol: 2; client: string; serverKey: string /* SPKI base64url, ECDSA P-256 */; nonce: string /* 32B base64url */ }
export interface BridgeAuth { type: 'auth'; extKey: string; nonce: string; sig: string /* ECDSA-SHA256 base64url over authPayload('ext', hello.nonce, keyId(serverKey)) */ }
export interface BridgeAuthOk { type: 'auth-ok'; sig: string /* over authPayload('srv', auth.nonce, keyId(extKey)) */ }
export function keyId(spkiB64: string): Promise<string>       // sha256 hex của SPKI bytes
export function authPayload(role: 'ext' | 'srv', nonce: string, peerKeyId: string): Uint8Array  // `mdr-bridge-v2|${role}|${nonce}|${peerKeyId}`
```
`welcome` bỏ; `reject` giữ. `parseBridgeMessage` validate kiểu mới (độ dài base64url, nonce đúng 43 ký tự).
`packages/mcp`: `pairing.ts` file v2 `{ version: 2, privateKey: JWK, publicKey: SPKI b64, extKey?: string }` (0600, ghi nguyên tử; file v1
→ tạo mới); `bridge-server.ts`: khi có kết nối gửi `hello` (không bí mật); nhận `auth` → verify chữ ký bằng `extKey`; nếu file chưa có
`extKey` → ghim (TOFU) rồi lưu; có rồi mà khác → `reject` + đóng; hợp lệ → gửi `auth-ok` và đánh dấu kết nối paired. Mọi `req` chỉ gửi tới
kết nối paired. Origin check giữ làm lớp phụ. Test: client không chữ ký/chữ ký sai/khoá khác khoá đã ghim → không paired, không nhận req;
hello không chứa `pairKey`.

### 11j — Cầu nối MCP v2: extension
- Khoá ECDSA P-256 của extension sinh một lần, lưu `chrome.storage.local` `mdr.bridgeKey` (JWK).
- `bridge.ts` `onHello`: `kid = keyId(serverKey)`; đã duyệt (`approved` lưu `{ keyId, serverKey, client, at }`) → gửi `auth`; chưa → hộp ghép
  cặp hiện tên client + mã nhận dạng ngắn (8 ký tự đầu `kid`, chia 4-4), duyệt → lưu rồi gửi `auth`. Nhận `auth-ok` → verify bằng
  `serverKey` đã ghim; sai → đóng. Chỉ sau `auth-ok` hợp lệ mới thực thi `req`.
- Bỏ đường `sha256(pairKey)`; mục đã duyệt cũ (v1) bị bỏ qua (chưa phát hành nên không cần migrate).
- `PairDialog` nhận thêm `fingerprint` hiển thị. Settings → Kết nối AI hiện fingerprint từng client đã duyệt.
- Test: listener giả có khoá khác khoá đã ghim → không paired, không thực thi req; `auth-ok` chữ ký sai → đóng; luồng đúng → thực thi.
- e2e `mcp.spec.ts` chạy lại xanh với CLI v2.

### 11k — Docs, kiểm lại, phát hành
- `docs/MCP.md`/`.en.md` (giao thức v2, fingerprint, TOFU và cách đặt lại bằng xoá file ghép cặp, update_doc không ghi đĩa),
  privacy (CSP, thu hồi tức thì), SESSION_HANDOVER, CLAUDE.md Status, DESIGN §4 bảng phase 11.
- Chạy lại `security-audit` ở guidance mode trên 8 mục (một reviewer sonnet đối chiếu từng fix với trace audit).
- Sau merge: deploy Worker, build lại zip 1.3.0.

## Sizing check
| Phase con | Package | File | Test mới |
|---|---|---|---|
| 11a | core, ui | render.ts, Viewer.tsx, 2 test | 0–1 |
| 11b | web, core | _headers, export/html.ts, test | 0 |
| 11c | api | api.ts, room.ts, index.ts, tokens types, test | 0 |
| 11d | api | api.ts, index.ts, test | 0 |
| 11e | api | limits.ts, test | 0 |
| 11f | api | room.ts, persistence.ts, test | 0 |
| 11g | extension, ui i18n | useDocSession, useFileSave, status UI, catalog, docs | 0 |
| 11h | core, extension | doc.ts, useDocSession, doc-registry, test | 0 |
| 11i | core, mcp | protocol.ts, pairing.ts, bridge-server.ts, tests | 0 |
| 11j | extension, ui | bridge.ts, bridge-storage.ts, worker index, PairDialog | 0 |
| 11k | docs | — | — |
Phase con nào vượt 5 file khi plan → tách tiếp ở plan (vd 11i1/11i2).
