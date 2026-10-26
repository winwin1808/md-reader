# Design: Phase 10 — MCP cục bộ + gia cố multi-tenant cho chia sẻ
Author: haonq (coordinator: Claude Opus). Status: designed. Phase: 10
Intent: docs/superpowers/intent/2026-10-26-phase-10-mcp-cuc-bo.md

## Approach chosen

**Cầu nối = WebSocket localhost, extension chủ động nối ra.** Gói `@md-reader/mcp` (Node, stdio) mở một WebSocket server
trên `127.0.0.1`, cổng đầu tiên còn trống trong `47821..47830`. Service worker của extension, khi người dùng bật
**Cài đặt → Kết nối AI**, quét 10 cổng đó (lúc khởi động + mỗi 30 s bằng `chrome.alarms`) và giữ một kết nối cho mỗi server
tìm thấy. Mọi thao tác tài liệu được **thực thi trong app page** của tài liệu đó (tab có `?doc=<id>`, mở nền nếu chưa có),
nên Y.Doc, `y-indexeddb`, provider phòng chia sẻ và luồng chia sẻ là đúng code hiện có — không có bản sao Y.Doc thứ hai.

Rejected:
- *Native messaging*: Chrome sinh tiến trình host, không phải tiến trình MCP mà Claude/Cursor sinh, nên vẫn cần thêm một
  kênh IPC host ↔ MCP; phải cài host manifest theo từng OS/trình duyệt; quyền `nativeMessaging` có cảnh báo khi cài.
  Giữ làm **phương án dự phòng** nếu spike 10a bác WS (luật quyết định ở 10a).
- *Remote MCP trên Worker*: cần tài khoản + OAuth, biến máy chủ chung thành API công khai cho agent — non-goal của phase.
- *Service worker giữ Y.Doc riêng*: hai instance `y-indexeddb` cùng một doc không đồng bộ trực tiếp với nhau và doc đang
  chia sẻ sẽ không có provider → lệch dữ liệu. Thực thi trong app page tránh được cả hai.

**Gia cố máy chủ = khoá bản cài ẩn danh + bộ đếm D1 theo ngày**, không tài khoản. D1 chỉ bị ghi thêm ở các thao tác hiếm
(tạo phòng, upload ảnh, báo cáo), không đụng đường WebSocket nóng. Rejected: rate-limit binding của Cloudflare (chưa xác
minh trên gói Free, và không đếm được quota tích luỹ); đếm trong bộ nhớ isolate (mất khi isolate đổi).

## Mô hình đe doạ (chốt phạm vi bảo vệ)

- Trang web bất kỳ **không** điều khiển được extension qua cầu nối: extension là bên nối ra; trang web không mở được kết
  nối vào service worker.
- **Extension lạ** trên cùng trình duyệt không nối được vào MCP: server chỉ nhận Origin `chrome-extension://<id>` với id thuộc
  `KNOWN_EXTENSION_IDS` (manifest có `key` cố định → ID `ojcemoafaibjfghljkbagnkbgljakbji`; ID store thêm khi phát hành;
  `MDR_EXTENSION_ID` ghi đè). Origin do trình duyệt đặt nên không giả được (quyết định sau review 10i, người dùng duyệt 2026-10-26).
- Tiến trình lạ chiếm cổng trước MCP thật: không có tác dụng nếu chưa được người dùng duyệt ghép cặp (khoá chưa biết).
- Phần mềm độc hại đã chạy với quyền người dùng (đọc được file `~/.config/md-reader/mcp.json`) **nằm ngoài phạm vi** — nó
  vốn đọc được IndexedDB của Chrome.
- Agent không tự tạo/thu hồi link: `share_doc` và `revoke_link` luôn qua hộp xác nhận trong extension.
- Một bản cài lạm dụng máy chủ mặc định bị chặn bởi rate limit + quota theo khoá bản cài **và** theo IP (băm), để việc tự
  sinh khoá mới không lách được.

## Decisions on the intent's open questions

- **Cầu nối:** WS localhost như trên; spike 10a đã xác nhận (DESIGN §5.7: không cần host permission, ping 20 s, alarm nối lại ≤30 s). Không thêm host permission; thêm quyền `alarms` (không có cảnh báo
  khi cài). Nếu 10a cho thấy cần host permission cho `127.0.0.1` thì khai báo nó ở `optional_host_permissions` và xin lúc
  người dùng bật Kết nối AI.
- **Chrome đóng / chưa bật Kết nối AI:** tool trả lỗi ngay sau 35 s chờ kết nối, mã `NOT_CONNECTED`, thông điệp
  "Mở Chrome có MD Reader và bật Cài đặt → Kết nối AI". Không xếp hàng lệnh.
- **Khoá bản cài:** extension sinh 32 byte ngẫu nhiên (base64url) lần đầu cần gọi API ghi, lưu `chrome.storage.local`
  khoá `mdr.installKey`; gửi header `x-mdr-install`. Cài lại = khoá mới (quota mới, nhưng giới hạn IP vẫn áp). Phòng tạo
  trước phase 10 không có khoá: vẫn quản lý được bằng `ownerToken` như cũ; không tính vào quota bản cài nào.
- **Số giới hạn mặc định** (hằng số trong `apps/api/src/limits.ts`, chỉnh được qua biến môi trường Worker không cần):
  - tạo phòng: 20/ngày/khoá bản cài · 50/ngày/IP · 500/ngày toàn máy chủ (giữ ≪ 100k request/ngày của Free, §5.6)
  - phòng còn sống mỗi khoá bản cài: 200
  - upload ảnh: 100 ảnh/ngày/khoá bản cài · 200 MB tổng mỗi khoá bản cài (giữ 2 MiB/ảnh, 50 MB/phòng hiện có);
    phòng không khoá (client ≤ 1.2.0): 100 ảnh và 200 MB mỗi ngày theo IP người upload (vá ở 10c.3)
  - báo cáo: 10/ngày/IP
  - request thiếu header `x-mdr-install` (client ≤ 1.2.0): chỉ áp giới hạn IP + toàn máy chủ.
  - "Ngày" = ngày UTC (`Math.floor(now / 86_400_000)`).
- **Gỡ nội dung:** endpoint admin `POST /api/admin/rooms/:roomId/takedown`, `Authorization: Bearer <ADMIN_SECRET>`
  (wrangler secret, so sánh hằng thời gian). Không dashboard.
- **`publish_doc`** mở tab app page và focus nó; `open: false` tạo doc trong tab nền rồi đóng tab đó.
- **`update_doc` chống đè:** bắt buộc `baseHash` lấy từ `get_doc`; lệch → lỗi `CONFLICT` kèm nội dung + hash hiện tại.
  Khớp → ghi bằng `applyTextChange` (delta nhỏ nhất, ràng buộc 6b).
- **Tập tool cuối:** `publish_doc`, `list_docs`, `get_doc`, `update_doc`, `share_doc`, `list_links`, `revoke_link`
  (`create_link` của ROADMAP gộp vào `share_doc`: bật chia sẻ nếu chưa bật rồi tạo link).

## Shared interfaces

### `@md-reader/core` — `src/bridge/` (thuần TS, chạy cả Node lẫn extension; export qua `@md-reader/core`)

```ts
export const BRIDGE_PROTOCOL = 1
export const BRIDGE_PORTS: readonly number[]            // [47821..47830]
export const BRIDGE_MAX_MARKDOWN = 2_000_000             // ký tự
export const BRIDGE_MAX_TITLE = 200

export type BridgeTool =
  | 'publish_doc' | 'list_docs' | 'get_doc' | 'update_doc'
  | 'share_doc' | 'list_links' | 'revoke_link'

export type BridgeErrorCode =
  | 'NOT_CONNECTED' | 'NOT_PAIRED' | 'DENIED' | 'TIMEOUT' | 'NOT_FOUND'
  | 'CONFLICT' | 'INVALID_ARGS' | 'SHARE_FAILED' | 'INTERNAL'

export interface PublishDocArgs { title: string; markdown: string; open?: boolean }
export interface PublishDocResult { docId: string }
export interface ListDocsResult { docs: Array<{ docId: string; title: string; lastOpenedAt: number; shared: boolean }> }
export interface GetDocArgs { docId: string }
export interface GetDocResult { docId: string; title: string; markdown: string; hash: string; shared: boolean }
export interface UpdateDocArgs { docId: string; markdown: string; baseHash: string }
export interface UpdateDocResult { hash: string }
export interface ShareDocArgs { docId: string; role: 'view' | 'edit'; expiresInDays: 7 | 30 | null }
export interface ShareDocResult { url: string; tokenPrefix: string; expiresAt: number | null }
export interface ListLinksArgs { docId: string }
export interface ListLinksResult {
  links: Array<{ tokenPrefix: string; role: 'view' | 'edit'; label: string; expiresAt: number | null; revokedAt: number | null }>
}
export interface RevokeLinkArgs { docId: string; tokenPrefix: string }
export interface RevokeLinkResult { revoked: boolean }

export interface BridgeArgsMap {
  publish_doc: PublishDocArgs; list_docs: Record<string, never>; get_doc: GetDocArgs; update_doc: UpdateDocArgs
  share_doc: ShareDocArgs; list_links: ListLinksArgs; revoke_link: RevokeLinkArgs
}
export interface BridgeResultMap {
  publish_doc: PublishDocResult; list_docs: ListDocsResult; get_doc: GetDocResult; update_doc: UpdateDocResult
  share_doc: ShareDocResult; list_links: ListLinksResult; revoke_link: RevokeLinkResult
}

// server (MCP) → extension
export interface BridgeHello { type: 'hello'; protocol: 1; client: string; pairKey: string }
export interface BridgeRequest { type: 'req'; id: string; tool: BridgeTool; args: unknown }
// extension → server
export interface BridgeWelcome { type: 'welcome'; paired: boolean }      // paired=false: chờ người dùng duyệt
export interface BridgeReject { type: 'reject'; code: 'DENIED' | 'PROTOCOL' }
export type BridgeResponse =
  | { type: 'res'; id: string; ok: true; result: unknown }
  | { type: 'res'; id: string; ok: false; error: { code: BridgeErrorCode; message: string } }

export interface BridgePing { type: 'ping' }                              // extension → server mỗi 20 s (§5.7)
export type BridgeMessage = BridgeHello | BridgeRequest | BridgeWelcome | BridgeReject | BridgeResponse | BridgePing

export function parseBridgeMessage(raw: string): BridgeMessage | null      // JSON + kiểm hình dạng; sai → null
export function validateToolArgs<T extends BridgeTool>(tool: T, args: unknown):
  { ok: true; args: BridgeArgsMap[T] } | { ok: false; message: string }
export function textHash(text: string): Promise<string>                   // SHA-256 hex, cùng thuật toán originHash
```

### `@md-reader/core` — `src/share/` (bổ sung)

```ts
export const INSTALL_HEADER = 'x-mdr-install'
export const API_PATHS: { ...hiện có; deleteRoom: (roomId: string) => string; report: string }
//   deleteRoom(id) = `/api/rooms/${id}`  (DELETE) ; report = '/api/report' (POST)
export interface ReportRequest { token: string; reason: string }          // reason 1..500 ký tự
export type LimitErrorCode = 'RATE_LIMITED' | 'QUOTA_EXCEEDED'
// Body lỗi giới hạn: HTTP 429 { error: LimitErrorCode, retryAfter?: number /* giây */ }
```

### `apps/api` — `src/limits.ts`

```ts
export const LIMITS = {
  roomsPerInstallPerDay: 20, roomsPerIpPerDay: 50, roomsGlobalPerDay: 500, liveRoomsPerInstall: 200,
  assetsPerInstallPerDay: 100, assetBytesPerInstall: 200 * 1024 * 1024, reportsPerIpPerDay: 10,
} as const
export type LimitKind = 'room' | 'asset' | 'report'
export interface LimitSubject { installHash: string | null; ipHash: string }
export interface LimitStore {
  check(kind: LimitKind, s: LimitSubject, info?: { roomId?: string; bytes?: number }):
    Promise<null | { error: LimitErrorCode; retryAfter?: number }>   // asset: quota theo khoá bản cài của CHỦ phòng (room_installs)
  record(kind: LimitKind, s: LimitSubject, info: { roomId: string; bytes?: number }): Promise<void>
  forgetRoom(roomId: string): Promise<void>                // xoá room_installs, trả lại quota phòng sống + bytes
}
export class MemoryLimitStore implements LimitStore
export class D1LimitStore implements LimitStore
export function subjectFrom(req: Request): Promise<LimitSubject>   // hash SHA-256 của x-mdr-install và CF-Connecting-IP
```

D1 migration `apps/api/migrations/0003_tenancy.sql`:

```sql
CREATE TABLE usage_daily (scope TEXT NOT NULL, subject TEXT NOT NULL, day INTEGER NOT NULL, kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (scope, subject, day, kind));      -- scope: 'install'|'ip'|'global'
CREATE TABLE room_installs (room_id TEXT PRIMARY KEY, install_hash TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0);
CREATE INDEX room_installs_install ON room_installs (install_hash);
CREATE TABLE reports (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, reason TEXT NOT NULL,
  ip_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE takedowns (room_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
```

### `apps/api` — xoá phòng

```ts
// tokens.ts
interface TokenStore { ...hiện có; deleteRoom(roomId: string): Promise<boolean> }   // xoá links + rooms; false nếu không có
// assets.ts
interface AssetStore { ...hiện có; deleteRoom(roomId: string): Promise<number> }    // xoá assets + asset_chunks; trả số ảnh
// room.ts
class DocRoom { ...; purge(): Promise<void> }   // đóng mọi kết nối (4410), ctx.storage.deleteAll(), rồi put('tombstone', 1):
                                                // DO có tombstone từ chối mọi kết nối/ghi (chặn client cũ dựng lại phòng)
// api.ts
export async function deleteRoomEverywhere(roomId: string, d: { store: TokenStore; assets?: AssetStore;
  limits?: LimitStore; purge: (roomId: string) => Promise<void> }): Promise<boolean>
```

Routes: `DELETE /api/rooms/:roomId` (owner) → 204 / 404; `POST /api/report` → 202; `POST /api/admin/rooms/:roomId/takedown`
(admin) → 204, ghi `takedowns`. Sau xoá/gỡ: mọi token của phòng → 410 (đã đúng do `resolve` trả null).

### `@md-reader/mcp` (mới, `packages/mcp`)

Node ≥ 20, ESM, `bin: { "md-reader-mcp": "dist/cli.js" }`. Import core qua subpath `@md-reader/core/bridge` (core là gói private
xuất TS) và Vite build `dist/cli.js` nhúng sẵn phần bridge; pin `@modelcontextprotocol/sdk` 1.32.1, `zod` 4.6.5, `ws` 8.22.0. Phụ thuộc: `@modelcontextprotocol/sdk`, `ws`, `@md-reader/core`.
KHÔNG react, KHÔNG `chrome.*`, KHÔNG giữ Y.Doc.

```ts
// src/pairing.ts
export interface PairFile { pairKey: string }                           // ~/.config/md-reader/mcp.json, mode 0600
export function loadOrCreatePairKey(path?: string): Promise<string>
// src/bridge-server.ts
export interface BridgeServer {
  readonly port: number
  setClient(name: string): void                                          // tên client MCP biết sau initialize
  call<T extends BridgeTool>(tool: T, args: BridgeArgsMap[T], timeoutMs?: number): Promise<BridgeResultMap[T]>
  close(): Promise<void>
}
export class BridgeCallError extends Error { constructor(public code: BridgeErrorCode, message: string) }
export function startBridgeServer(opts: { pairKey: string; client: string; ports?: readonly number[];
  connectWaitMs?: number /* 35_000 */ }): Promise<BridgeServer>
// src/tools.ts
export function registerTools(server: McpServer, bridge: BridgeServer): void
// src/cli.ts — stdio transport; log ra stderr, không bao giờ ra stdout
```

Timeout mặc định của `call`: 30 s; `share_doc`/`revoke_link`: 120 s (chờ người dùng bấm).

### `apps/extension`

```ts
// src/worker/bridge.ts
export interface BridgeConn { port: number; client: string; paired: boolean }
export function startBridge(deps: { isEnabled: () => Promise<boolean>; approved: () => Promise<string[] /* sha256 pairKey */>;
  requestPairing: (c: { port: number; client: string; keyHash: string }) => Promise<boolean>;
  execute: (req: BridgeRequest) => Promise<BridgeResponse> }): { stop(): void; conns(): BridgeConn[] }
// src/worker/bridge-route.ts
export function executeInApp(req: BridgeRequest): Promise<BridgeResponse>  // tìm/mở tab ?doc=, chrome.runtime gửi req, chờ res
// src/app/bridge-executor.ts
export function createBridgeExecutor(deps: { getDoc: (docId: string) => Y.Doc | null; createDoc: (title: string,
  markdown: string) => Promise<string>; share: ShareDeps; confirm: (c: ConfirmRequest) => Promise<boolean> }):
  (req: BridgeRequest) => Promise<BridgeResponse>
```

Storage: `chrome.storage.local` `mdr.bridge = { enabled: boolean; approved: string[] }` (`approved` = SHA-256 hex của
pairKey), `mdr.installKey: string`.

### `@md-reader/ui`

```ts
export function PairDialog(p: { client: string; onAllow(): void; onDeny(): void }): JSX.Element
export interface ConfirmRequest { kind: 'share' | 'revoke'; docTitle: string; role?: 'view' | 'edit';
  expiresInDays?: 7 | 30 | null; tokenPrefix?: string }
export function ConfirmAgentDialog(p: { req: ConfirmRequest; client: string; onAllow(): void; onDeny(): void }): JSX.Element
// ShareModal: prop mới onDeleteRemote?: () => Promise<void>  (nút "Xoá dữ liệu trên máy chủ", có bước xác nhận trong modal)
// web: Notice (toast/banner trong UI) thay window.alert — nằm ở apps/web, không phải ui
```

## Sub-phases

### 10a — Spike cầu nối (spiker, harness vứt đi ở `spike/mcp-bridge/`, ngoài workspace)
Câu hỏi, đo trên Chromium load-unpacked (như 1a), ghi bảng vào DESIGN.md §5.7:
1. Service worker MV3 mở được `ws://127.0.0.1:<port>` **không** cần host permission? (có/không, lỗi gì)
2. Kết nối mở, không message, service worker còn sống sau 6 phút? Nếu không: ping 20 s có giữ được không?
3. `chrome.alarms` 30 s đánh thức SW và nối lại được sau khi SW bị dừng (chrome://serviceworker-internals → Stop)?
4. Quét 10 cổng đóng mất bao lâu, có log lỗi đỏ trên trang extension không?
Luật quyết định: (1) có và [(2) có hoặc ping giữ được] → WS, spec giữ nguyên. (1) cần host permission → giữ WS, dùng
`optional_host_permissions: ["http://127.0.0.1/*"]` xin lúc bật. (2) và ping đều không → đổi sang native messaging: dừng
vòng, sửa spec các phần 10h–10m trước khi plan tiếp. Không ship code sản phẩm.

### 10b — `core/bridge` protocol
`packages/core/src/bridge/protocol.ts` + test + export trong `src/index.ts`. Mọi kiểu ở "Shared interfaces → core/bridge".
Test: parse chấp nhận đúng từng loại message, trả null cho JSON hỏng / thiếu trường / `type` lạ; `validateToolArgs` từ chối
title > 200, markdown > 2 000 000, role lạ, `expiresInDays` ngoài {7,30,null}, docId rỗng; `textHash` khớp hash của helper
originHash trên cùng chuỗi. ~4 file.

### 10c — Giới hạn theo bản cài (api)
`migrations/0003_tenancy.sql`, `src/limits.ts` (+ `limits.test.ts`), `src/api.ts` (gọi `check` trước, `record` sau khi
thành công cho `POST /api/rooms` và upload asset), `core/share` (`INSTALL_HEADER`, `LimitErrorCode`). Lỗi giới hạn → 429
`{error, retryAfter}` (retryAfter = giây tới 00:00 UTC kế tiếp cho giới hạn ngày; không có cho QUOTA). Test (Memory store):
đủ từng ngưỡng thì 429, sang ngày mới mở lại; thiếu header chỉ áp IP/global; quota phòng sống và bytes. D1 store dùng UPSERT
`INSERT … ON CONFLICT DO UPDATE SET n = n + 1`.

### 10d — Xoá phòng: tầng store (api)
`TokenStore.deleteRoom` (Memory + D1: `DELETE FROM links WHERE room_id`, `DELETE FROM rooms WHERE id`), `AssetStore.deleteRoom`
(chunks rồi assets, một `batch`), `LimitStore.forgetRoom`. Test trong file test hiện có: sau xoá `resolve` mọi token → null,
`roomUsage` → 0, xoá phòng không tồn tại → false/0.

### 10e — Xoá phòng: route + DO purge (api)
`DocRoom.purge()`; `deleteRoomEverywhere`; route `DELETE /api/rooms/:roomId` (owner bearer, 401/404/204); index.ts nối
`purge` qua stub DO. Thứ tự: D1 trước (chặn truy cập mới ngay), rồi purge DO; purge lỗi → vẫn 204 và log (dữ liệu DO không
còn đường truy cập vì token đã mất). Test: owner xoá được, link sửa/xem không xoá được (401), kết nối WS đang mở bị đóng 4410.

### 10f — Báo cáo & gỡ nội dung (api)
`POST /api/report` (token phải resolve được, kể cả link xem; reason 1..500; giới hạn IP) → 202, ghi `reports`.
`POST /api/admin/rooms/:roomId/takedown` (`ADMIN_SECRET` trong `Env`, thiếu secret → 404 cho mọi request admin) →
`deleteRoomEverywhere` + ghi `takedowns`. Script `apps/api/scripts/takedown.mjs` (đọc secret từ env, không in). Test: báo cáo
với token hỏng → 404, quá 10/ngày → 429, admin sai secret → 401, gỡ xong token → 410.

### 10g — Web: nút báo cáo + Notice (apps/web)
Chân trang SharePage/EditPage có "Báo cáo nội dung" → form nhỏ (lý do) gửi `API_PATHS.report`; `Notice` (banner trong UI,
`role="status"`, tự ẩn 5 s, lỗi giữ tới khi đóng) thay mọi `window.alert`; trang 410 hiện "Tài liệu này đã bị gỡ hoặc link
hết hiệu lực". Test: không còn `window.alert` trong `apps/web/src` (grep trong test), gửi báo cáo hiện Notice thành công/lỗi.

### 10h — Extension gửi khoá bản cài + nút xoá dữ liệu
Extension sinh/đọc `mdr.installKey`, thêm `INSTALL_HEADER` cho tạo phòng và upload ảnh; 429 hiện thông báo tiếng Việt
("Đã đạt giới hạn tạo link hôm nay, thử lại sau N giờ" / "Đã hết dung lượng chia sẻ"). `ShareModal` thêm "Xoá dữ liệu trên
máy chủ" (xác nhận hai bước trong modal) → `DELETE` → gỡ binding `room` khỏi registry, xoá cache token link, tài liệu cục bộ
giữ nguyên. Test: header có mặt, 429 map ra đúng chuỗi, xoá xong registry không còn `room`.

### 10i — `@md-reader/mcp`: bridge server + pairing
Scaffold `packages/mcp` (package.json, tsconfig, vitest), `src/pairing.ts`, `src/bridge-server.ts` + test. Server thử lần lượt
`BRIDGE_PORTS`, bind `127.0.0.1` duy nhất, kiểm header `Origin` của upgrade bắt đầu bằng `chrome-extension://` (hoặc
`moz-extension://`), chỉ một kết nối extension mỗi server (kết nối mới thay kết nối cũ). Gửi `hello` ngay khi nối; chỉ gửi
`req` sau `welcome{paired:true}`. `call` khi chưa có kết nối paired → chờ `connectWaitMs` rồi `NOT_CONNECTED`; kết nối rơi
giữa chừng → mọi call đang chờ lỗi `NOT_CONNECTED`. Test bằng client `ws` giả lập extension: pairing, Origin sai bị từ chối,
timeout, cổng bận chuyển cổng kế.

### 10j — `@md-reader/mcp`: tools + CLI
`src/tools.ts` đăng ký 7 tool với `McpServer` (schema zod suy từ giới hạn core), `src/cli.ts` (stdio, `client` = tên client
MCP từ `initialize` nếu có, mặc định "MCP"). Mô tả tool nói rõ: tài liệu nằm trên máy người dùng; `share_doc` cần người dùng
bấm đồng ý. `BridgeCallError` → kết quả tool `isError: true` với thông điệp tiếng Anh + mã. Test: gọi tool qua `InMemoryTransport`
của SDK với bridge giả, đúng mapping lỗi và kết quả.

### 10k — Extension: cầu nối trong service worker + bật/tắt + ghép cặp
`worker/bridge.ts` (quét cổng, `chrome.alarms` 30 s khi bật — sau 10 lượt quét trắng liên tiếp chỉ quét mỗi 5 phút, quét
ngay khi app page mở hoặc bật lại; ping `{type:'ping'}` mỗi 20 s trên mỗi kết nối để SW không bị dừng (§5.7); mỗi cổng ≤1 kết nối, nhận `hello` → so `sha256(pairKey)` với
`approved` → `welcome{paired:true}` hoặc mở app page `?pair=<port>` hiện `PairDialog` → duyệt thì thêm vào `approved`,
từ chối thì `reject{DENIED}`), manifest thêm `alarms` (không host permission — §5.7), Settings tab "Kết nối AI":
bật/tắt, danh sách client đã duyệt + "Thu hồi" (xoá khỏi `approved`, đóng kết nối). Mặc định **tắt**. Test logic thuần:
quyết định paired/pending/denied từ (hello, approved), danh sách cổng quét.

### 10l — Extension: thực thi `publish_doc` / `list_docs` / `get_doc`
`worker/bridge-route.ts` (`executeInApp`: `list_docs` đọc registry ngay trong SW; còn lại tìm tab `app.html?doc=<id>`,
không có thì `chrome.tabs.create({active:false})`, chờ message `bridge-ready` ≤10 s), `app/bridge-executor.ts`. `publish_doc`:
tạo doc mới qua đường import hiện có (registry `docId`, `meta.title`, `originPath` rỗng, không file handle), mở tab active
(hoặc đóng tab nền khi `open:false`). `get_doc` trả `textHash(source)`. `docId` không có → `NOT_FOUND`. Test: executor với
Y.Doc thật trong bộ nhớ.

### 10m — `update_doc`
Executor: so `baseHash` với `textHash` hiện tại → `CONFLICT` (message chứa hash hiện tại; agent gọi lại `get_doc`); khớp →
`applyTextChange(ytext, markdown)` trong một transaction origin `'mcp'`, thêm checkpoint `history` label `"AI: cập nhật"`.
Test: delta nhỏ nhất (đổi 1 từ → chỉ 1 delete + 1 insert), hội tụ với một replica sửa đồng thời ở đoạn khác, CONFLICT khi lệch.

### 10n — `share_doc` / `list_links` / `revoke_link` qua xác nhận
Executor gọi `confirm` → app focus tab (`chrome.tabs.update({active:true})` + `windows.update focused`) và hiện
`ConfirmAgentDialog` ("<client> muốn tạo link Xem, hết hạn sau 7 ngày cho «<tiêu đề>»"). Đồng ý → luồng chia sẻ hiện có (bật
chia sẻ nếu chưa, tạo link, cache token như 9a1) → `ShareDocResult`. Từ chối → `DENIED`; 110 s không bấm → đóng hộp,
`TIMEOUT`. Lỗi máy chủ (kể cả 429) → `SHARE_FAILED` kèm thông điệp. `list_links` không cần xác nhận. Test: dialog render/đi
bằng phím; executor với `confirm` giả (allow/deny/timeout) và share giả.

### 10o — Docs, E2E, phát hành
`docs/MCP.md` (+ `docs/MCP.en.md`): cài `npx -y @md-reader/mcp`, cấu hình Claude Desktop / Claude Code / Cursor, bật Kết nối
AI, ghép cặp, prompt mẫu, giới hạn. ROADMAP (vi + en): v1.3 thành "MCP cục bộ" đã xong, thêm mục hoãn "Remote MCP + OAuth"
(bản tự host trước, chỉ khi có nhu cầu). `docs/store/privacy-policy.md` + `listing.md`: khoá bản cài ẩn danh, báo cáo nội
dung, xoá dữ liệu máy chủ, cầu nối chỉ localhost và mặc định tắt. Playwright: extension load-unpacked + bridge server thật
từ `packages/mcp` → bật Kết nối AI, duyệt ghép cặp, `publish_doc` → tab hiện nội dung, `update_doc` → nội dung đổi. Smoke qua `wrangler dev` chạm D1LimitStore thật (tạo phòng/upload ảnh có và không `x-mdr-install`, kiểm 429). Version
1.3.0 (extension + mcp). Migration `0003` chạy remote + `ADMIN_SECRET` đặt bằng wrangler là bước người làm, ghi trong
SESSION_HANDOVER.

## Sizing check (§4: ≤5 file, ≤300 dòng, ≤1 file test mới)

| # | File dự kiến | Dòng | Test mới |
|---|---|---|---|
| 10a | spike ngoài workspace + DESIGN §5.7 | — | 0 |
| 10b | core bridge/protocol.ts, protocol.test.ts, index.ts | ~260 | 1 |
| 10c | 0003_tenancy.sql, limits.ts, limits.test.ts, api.ts, core share | ~290 | 1 |
| 10d | tokens.ts, tokens-d1.ts, assets.ts, limits.ts, (tests hiện có) | ~140 | 0 |
| 10e | room.ts, api.ts, index.ts, api.test.ts | ~150 | 0 |
| 10f | api.ts, env.ts, scripts/takedown.mjs, api.test.ts | ~200 | 0 |
| 10g | web Notice.tsx, SharePage/EditPage, report form, 1 test | ~220 | 1 |
| 10h | extension share client, storage, ui ShareModal, tests | ~200 | 0–1 |
| 10i | mcp package.json, tsconfig, pairing.ts, bridge-server.ts, test | ~290 | 1 |
| 10j | mcp tools.ts, cli.ts, tools.test.ts | ~250 | 1 |
| 10k | worker/bridge.ts, manifest, worker index, ui PairDialog + Settings tab | ~290 | 1 |
| 10l | worker/bridge-route.ts, app/bridge-executor.ts, app entry, test | ~260 | 1 |
| 10m | app/bridge-executor.ts, test | ~120 | 0 |
| 10n | ui ConfirmAgentDialog, executor, app entry, tests | ~250 | 1 |
| 10o | docs ×4, ROADMAP ×2, store ×2, e2e spec, manifest/package versions | docs | 1 (e2e) |

10o chạm >5 file nhưng gần hết là tài liệu; plan được phép tách 10o1 (docs/store/ROADMAP) · 10o2 (e2e + version).

## Constraints (chép vào INVARIANTS khi plan)

- 8 ràng buộc khoá cứng giữ nguyên; không đổi schema Y.Doc (`origin 'mcp'` và label history không phải đổi schema).
- `packages/mcp`: KHÔNG react / `chrome.*` / `document`; import core bằng `@md-reader/core`.
- `packages/core/src/bridge`: thuần TS, KHÔNG `ws`, KHÔNG Node API (`crypto.subtle` có trên cả Node ≥ 20 và trình duyệt).
- Chỉ `apps/extension` dùng `chrome.*`; content script không đổi (≤ 60 KB gz).
- Ghi `Y.Text` chỉ bằng `applyTextChange`.
- Máy chủ chỉ lưu hash của khoá bản cài và IP; không log khoá thô.
- Cầu nối mặc định tắt; tạo/thu hồi link từ agent luôn qua xác nhận.

## Deferred

- Remote MCP + OAuth / tài khoản (ROADMAP, sau v1.5, bản tự host trước).
- `append_comment` (chờ bình luận v1.5).
- Dashboard admin, xem danh sách báo cáo qua UI (dùng `wrangler d1 execute`).
- Firefox cho cầu nối (Firefox MV3 background khác vòng đời — chưa test).

## Sub-phase queue
- 10a: done      (WS localhost, không host permission, ping 20 s, alarm 0.5 phút — DESIGN §5.7)
- 10b: done
- 10c: done      (LimitStore + 429; phòng không khoá giới hạn ảnh theo IP — 10c.3)
- 10d: done
- 10e: done      (purge + tombstone; mọi bước sau D1 không chặn purge — 10e.3)
- 10f: done
- 10g: done
- 10h: done
- 10i: done      (pin ID extension `ojcemoafaibjfghljkbagnkbgljakbji`, maxPayload 16 MiB, ≤4 kết nối, pair file nguyên tử)
- 10j: pending
- 10k: pending
- 10l: pending
- 10m: pending
- 10n: pending
- 10o: pending
