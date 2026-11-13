# Design: Phase 21 — Ghép cặp MCP: một profile, không hỏi lặp
Author: haonq. Status: designed. Phase: 21
Intent: docs/superpowers/intent/2026-11-13-phase-21-ghep-cap-mot-profile.md

## Sub-phase queue
- 21a — Giao thức `hello.pinnedExt` (core): done
- 21b1 — Máy chủ gửi `pinnedExt` (mcp): done
- 21b2 — Lệnh `le-sach-mcp unpair` (mcp): done
- 21c1 — Bridge: `onUnpaired`, đóng im lặng (extension worker): done
- 21c2 — Bridge: `decide` trả kết quả, tự nối lại (extension worker): done
- 21c3 — Chính sách hỏi + kho `asked`/`seen` (extension worker): done
- 21c4 — Nối worker (extension worker): done
- 21d1 — Trang ghép cặp báo kết quả (ui + extension): done
- 21d2 — Cài đặt: ứng dụng AI phát hiện được (ui): done
- 21d3 — Nối Cài đặt (extension app): planned
- 21e1 — E2E máy chủ đã ghim khoá khác: pending
- 21e2 — Tài liệu + phiên bản: planned

## Approach chosen
**Extension không bao giờ tự mở tab hỏi quá một lần cho một khoá máy chủ; máy chủ nói cho extension biết nó đã ghim ai.**

- Máy chủ mới thêm `pinnedExt` vào `hello` (mã khoá extension đã ghim, hoặc `null`). Extension so với mã khoá của chính mình → biết ngay "máy chủ này thuộc profile khác" và im lặng.
- Với máy chủ cũ (`1.3.2`, không có trường): extension tự hỏi **đúng một lần** cho mỗi khoá máy chủ (ghi `asked` trước khi mở tab), sau đó chỉ kết nối khi người dùng bấm trong Cài đặt. Nếu máy chủ từ chối sau khi người dùng Cho phép thì gỡ phê duyệt vừa thêm và đánh dấu `rejected`.
- Hạn 10 giây của máy chủ giữ nguyên; extension tự nối lại lúc người dùng bấm Cho phép — nhờ vậy chạy được với cả máy chủ cũ.

Loại bỏ:
- *Chỉ sửa extension (nhớ từ chối), không đổi giao thức* — không phân biệt được "đã ghép với profile khác" với "chưa ghép", nên profile thứ hai vẫn hỏi một lần với mọi máy chủ và không có thông báo đúng.
- *Không bao giờ tự hỏi, luôn bấm trong Cài đặt* — làm lần ghép đầu của người dùng mới khó hơn hiện nay (intent cấm).
- *Nới hạn 10 giây ở máy chủ* — không giúp gì khi máy chủ là `1.3.2`; nối lại phía extension giải quyết cả hai.

## Assumptions (open questions đã chốt)
1. Máy chủ chưa ghim ai / máy chủ cũ: tự hỏi một lần cho mỗi khoá máy chủ, mỗi profile. Hai profile cùng bật + máy chủ mới tinh → mỗi profile hỏi một lần; profile bấm sau nhận thông báo "đã ghép với profile khác".
2. `asked` lưu ở `chrome.storage.local` khoá `mdr.bridgeAsked`, không hết hạn, giữ 20 mục mới nhất. `seen` (ứng dụng AI phát hiện được) lưu ở `chrome.storage.session` khoá `mdr.bridgeSeen`, TTL 11 phút.
3. Tiếp quản: lệnh `le-sach-mcp unpair` xoá `extKey` khỏi file ghép cặp; phải khởi động lại ứng dụng AI. Không có nút "cướp" từ extension (giữ nguyên mô hình ghim).
4. Trường mới mang mã khoá (`keyId`, 64 hex) của khoá extension đã ghim — không phải bí mật, chỉ là gợi ý hiển thị; máy chủ vẫn quyết định ở bước `auth`.
5. Phiên bản: `le-sach-mcp@1.3.3`, extension `1.5.1`. Publish npm trước, rồi nộp extension.
6. Client đã duyệt mà máy chủ báo `pinnedExt` khác mình: không `auth`, coi như `other` (không hỏi).

## Bất biến chung cho mọi phase con
- `chrome.*` chỉ trong `apps/extension`. `packages/core` không `chrome.*`/`document`. `packages/ui` không `chrome.*`.
- Import chéo package bằng tên workspace (`@md-reader/core/bridge`, `@md-reader/core/bridge-auth`, `@md-reader/ui`).
- Không đổi luồng xác thực v2 (`auth` / `auth-ok`, chữ ký, ghim khoá, cửa sổ ghép 10 phút). Không thêm dependency, không thêm quyền manifest. Content script không bị chạm.

---

## 21a — Giao thức `hello.pinnedExt` (`packages/core`)
File: `packages/core/src/bridge/protocol.ts`, test hiện có của protocol.

```ts
export interface BridgeHello {
  type: 'hello'; protocol: 2; client: string; serverKey: string; nonce: string
  /** undefined = máy chủ cũ (không biết) · null = chưa ghim · 64-hex = keyId khoá extension đã ghim */
  pinnedExt?: string | null
}
export type BridgePinState = 'unknown' | 'none' | 'self' | 'other'
export function bridgePinState(pinnedExt: string | null | undefined, myKeyId: string): BridgePinState
```

- `parseBridgeMessage`: `pinnedExt` vắng → không có thuộc tính; `null` → `null`; chuỗi khớp `/^[0-9a-f]{64}$/` → giữ; giá trị khác → bỏ qua như vắng (không làm hỏng `hello`).
- `bridgePinState`: `undefined`→`'unknown'`, `null`→`'none'`, bằng `myKeyId`→`'self'`, còn lại `'other'`.
- Test: `hello` cũ vẫn parse; ba dạng `pinnedExt`; giá trị rác bị bỏ; bảng `bridgePinState`.

## 21b1 — Máy chủ gửi `pinnedExt` (`packages/mcp`)
File: `packages/mcp/src/bridge-server.ts`, `bridge-server.test.ts`.

- Mỗi kết nối: `hello` thêm `pinnedExt: identity.extKey ? await keyId(identity.extKey) : null`, tính tại thời điểm gửi (sau khi ghim, kết nối mới thấy giá trị mới). Thứ tự message không đổi: `hello` vẫn là message đầu tiên.
- Không đổi `AUTH_DEADLINE_MS`, `PAIR_WINDOW_MS`, logic `authenticate`.
- Test: chưa ghim → `null`; đã ghim → đúng `keyId`; sau một lần ghép thành công, kết nối thứ hai nhận `keyId` đó.

## 21b2 — Lệnh `unpair` (`packages/mcp`)
File: `packages/mcp/src/pairing.ts`, `pairing.test.ts`, `cli.ts`, `cli.test.ts`.

```ts
// pairing.ts
export async function unpairIdentity(path?: string): Promise<'unpaired' | 'not-paired' | 'missing'>
// cli.ts
export async function runCli(argv: readonly string[], deps?: { stderr?: NodeJS.WritableStream; pairPath?: string }): Promise<'serve' | 'done'>
```

- `unpairIdentity`: dưới `withLock`, đọc file; không có file → `'missing'`; không có `extKey` → `'not-paired'`; có → `writeAtomic` bản không `extKey` (giữ nguyên khoá máy chủ) → `'unpaired'`. File hỏng → ném lỗi.
- `runCli`: `argv[0] === 'unpair'` → gọi `unpairIdentity`, in một dòng ra stderr (đã bỏ ghép; cần khởi động lại ứng dụng AI rồi kết nối từ MD Reader), trả `'done'`, không mở máy chủ. Còn lại trả `'serve'` và khối direct-run gọi `main()` như cũ.
- Test: ba kết quả của `unpairIdentity`, khoá máy chủ không đổi; `runCli(['unpair'])` không lắng nghe cổng.

## 21c1 — Bridge: `onUnpaired`, đóng im lặng (`apps/extension/src/worker`)
File: `bridge.ts`, `bridge.test.ts`, `index.ts` (chỉ đổi tên dep cho biên dịch được).

```ts
export interface BridgeConn { port: number; client: string; keyHash: string; state: 'pending' | 'authing' | 'paired'; pinned: BridgePinState }
export interface UnpairedServer { port: number; client: string; keyHash: string; pinned: BridgePinState }
export interface BridgeDeps {
  // thay cho requestPairing
  onUnpaired(s: UnpairedServer): Promise<boolean>   // true = đã mở hộp hỏi, giữ kết nối chờ quyết định
  /* các dep khác giữ nguyên */
}
```

`onHello` mới:
1. `pinned = bridgePinState(h.pinnedExt, await keyId(extKey.publicKey))`, ghi vào `e.conn.pinned`.
2. Đã duyệt (khớp `keyHash` + `serverKey`) **và** `pinned !== 'other'` → `authenticate` như cũ.
3. Còn lại → `state = 'pending'`, `keep = await deps.onUnpaired(...)`; `keep === false` (hoặc ném lỗi) → đóng socket và `drop` ngay, không gửi `reject`.

Ở 21c1 `index.ts` cài `onUnpaired` bằng hành vi cũ (mở tab, trả `true`) — hành vi mới đến ở 21c4.
Test: máy chủ `other` + đã duyệt không gửi `auth`; `onUnpaired` trả `false` → socket đóng, `conns()` rỗng; trả `true` → giữ `pending`; `hello` cũ → `pinned: 'unknown'`.

## 21c2 — Bridge: `decide` trả kết quả, tự nối lại
File: `bridge.ts`, `bridge.test.ts`.

```ts
export type PairOutcome = 'paired' | 'denied' | 'rejected' | 'gone'
export const DECIDE_HELLO_WAIT_MS = 3000
export const DECIDE_AUTH_WAIT_MS = 5000
decide(port: number, allow: boolean, add?: (c: ApprovedClient) => Promise<void>, keyHash?: string): Promise<PairOutcome>
```

- `allow === false` → như cũ (gửi `reject` nếu còn kết nối) → `'denied'`.
- `allow === true`:
  - Không có entry `pending` còn sống cho `port` (máy chủ đã đóng sau 10 giây) → nối lại cổng đó và chờ `hello` tối đa `DECIDE_HELLO_WAIT_MS`. Trong lần nối lại này `onUnpaired` **không** được gọi (entry được giữ `pending` cho quyết định đang chờ). Không nối được, hoặc `keyHash` của `hello` mới khác `keyHash` truyền vào → `'gone'`.
  - `add` → `authenticate` → chờ tối đa `DECIDE_AUTH_WAIT_MS`: `auth-ok` hợp lệ → `'paired'`; nhận `reject`, socket đóng, chữ ký sai, hoặc hết giờ → `'rejected'` (và entry bị gỡ).
- Hai lần `decide` chồng nhau cho cùng entry: lần sau trả cùng kết quả với lần đầu (giữ cờ `deciding`, không `auth` hai lần).
- Bridge không tự gỡ phê duyệt; đó là việc của 21c4.
- Test: Cho phép trong hạn → `'paired'`; Cho phép sau khi socket đã đóng → nối lại → `'paired'`; máy chủ `reject` → `'rejected'`; cổng chết → `'gone'`; từ chối → `'denied'`; bấm hai lần → một `auth`.

## 21c3 — Chính sách hỏi + kho `asked`/`seen`
File: `apps/extension/src/worker/bridge-storage.ts`, `bridge-storage.test.ts`.

```ts
export const BRIDGE_ASKED_KEY = 'mdr.bridgeAsked'      // chrome.storage.local
export const BRIDGE_SEEN_KEY = 'mdr.bridgeSeen'        // chrome.storage.session
export const BRIDGE_CONNECT_MSG = 'mdr-bridge-connect'
export const ASKED_MAX = 20
export const SEEN_TTL_MS = 11 * 60_000

export type AskedMap = Record<string, { at: number; rejected?: boolean }>
export interface SeenServer { keyHash: string; client: string; port: number; pinned: BridgePinState; rejected: boolean; at: number }

export function pairPolicy(i: { pinned: BridgePinState; asked: boolean; manual: boolean; recentlyRevoked: boolean }): 'ask' | 'silent'
export async function readAsked(store: StoreLike): Promise<AskedMap>
export async function markAsked(store: StoreLike, keyHash: string, now: number, rejected?: boolean): Promise<void>
export async function readSeen(store: StoreLike): Promise<SeenServer[]>
export async function upsertSeen(store: StoreLike, s: SeenServer): Promise<void>
export async function removeSeen(store: StoreLike, keyHash: string): Promise<void>
export async function pruneSeen(store: StoreLike, now: number): Promise<void>
export function parseSeen(v: unknown): SeenServer[]
export interface ConnectMsg { type: typeof BRIDGE_CONNECT_MSG; keyHash: string }
export function parseConnectMsg(v: unknown): ConnectMsg | null
export interface PairDecisionReply { ok: true; outcome: PairOutcome; pinned: BridgePinState }
```

`pairPolicy`, theo thứ tự: `pinned === 'other'` → `'silent'` · `manual` → `'ask'` · `recentlyRevoked` → `'silent'` · `asked` → `'silent'` · còn lại `'ask'`.
- `markAsked` giữ `rejected` cũ nếu không truyền; cắt còn `ASKED_MAX` mục mới nhất theo `at`.
- `upsertSeen` thay mục cùng `keyHash`; `pruneSeen` bỏ mục `at < now - SEEN_TTL_MS`. `parseSeen` bỏ mục sai kiểu.
- Test: bảng `pairPolicy` đủ nhánh; `markAsked` cắt 20 và giữ `rejected`; vòng đời `seen`; `parseConnectMsg` chặn `keyHash` sai.

## 21c4 — Nối worker
File: `apps/extension/src/worker/index.ts` (+ file test logic thuần hiện có của worker nếu có; không mock sâu `chrome.*`).

- `onUnpaired(s)`:
  1. `asked = await readAsked(local)`; `rejected = asked[s.keyHash]?.rejected === true`.
  2. `upsertSeen(session, { ...s, rejected, at: now })`.
  3. `pairPolicy({ pinned: s.pinned, asked: s.keyHash in asked, manual: manual.delete(s.keyHash), recentlyRevoked: isExpiryActive(revokedUntil, s.keyHash) })`.
  4. `'ask'` → `await markAsked(local, s.keyHash, now)` **trước**, rồi `chrome.tabs.create(app.html?pair=…)`, trả `true`. `'silent'` → trả `false`.
- `manual: Set<string>` trong bộ nhớ worker.
- Message `BRIDGE_CONNECT_MSG` (cùng kiểm `sender` như hai message hiện có): `manual.add(keyHash)`; `setIdle(0)`; `await tick()`; trả `{ ok: true }`. Nếu sau 3 giây `manual` vẫn còn `keyHash` (không gặp máy chủ) → `manual.delete`, `removeSeen`, trả `{ ok: false }`.
- Message `PAIR_DECISION_MSG`: `outcome = await bridge.decide(...)`;
  - `'paired'` → `removeSeen`; đóng tab.
  - `'denied'` → đóng tab.
  - `'rejected'` → `removeApproved(local, keyHash)`, `markAsked(local, keyHash, now, true)`, cập nhật `seen.rejected = true`; **không** đóng tab.
  - `'gone'` → `removeSeen`; không đóng tab.
  - Trả `PairDecisionReply` (`pinned` lấy từ `seen` của `keyHash`, mặc định `'unknown'`).
- `removeApproved` ở nhánh `'rejected'` kích `storage.onChanged` → `bridge.revoke` + `revokedUntil` 60 giây: chấp nhận được (kết nối đã chết).
- `tick()`: sau `bridge.scan()` gọi `pruneSeen(session, now)`.
- Số kết nối sống (`n`) chỉ đếm entry còn giữ → máy chủ bị bỏ qua im lặng không ngăn lùi nhịp quét về 5 phút.

## 21d1 — Trang ghép cặp báo kết quả
File: `packages/ui/src/components/PairDialog.tsx`, test của nó, file i18n vi + en, `apps/extension/src/app/main.tsx`.

```ts
export type PairResult = 'rejected-other' | 'rejected' | 'gone'
export function PairDialog(p: {
  client: string; fingerprint: string
  onAllow(): void; onDeny(): void
  busy?: boolean            // đang chờ kết quả: khoá hai nút
  result?: PairResult       // có giá trị: thay nội dung bằng thông báo + nút Đóng
  onClose?(): void
}): React.JSX.Element
```

- `main.tsx` `PairPage`: bấm Cho phép → `busy`, `await chrome.runtime.sendMessage(...)` → `PairDecisionReply`; `outcome === 'rejected'` → `result = reply.pinned === 'other' ? 'rejected-other' : 'rejected'`; `'gone'` → `'gone'`; `'paired'`/`'denied'` → worker đóng tab. `onClose` → `window.close()`.
- i18n mới (vi + en): `pair.result.other` (ứng dụng AI này đã ghép với trình duyệt hoặc profile Chrome khác; muốn chuyển sang đây: chạy `npx le-sach-mcp unpair`, khởi động lại ứng dụng AI, rồi bấm Kết nối trong Cài đặt), `pair.result.rejected` (ứng dụng AI từ chối: có thể đã ghép với nơi khác hoặc đã quá 10 phút từ lúc nó khởi động — khởi động lại rồi thử lại), `pair.result.gone` (không còn thấy ứng dụng AI), `pair.close`, `pair.busy`.
- Test: mỗi `result` hiện đúng chữ và nút Đóng, không còn nút Cho phép; `busy` khoá nút; Esc khi có `result` gọi `onClose`.

## 21d2 — Cài đặt: ứng dụng AI phát hiện được (`packages/ui`)
File: `packages/ui/src/components/SettingsModal.tsx`, test hiện có của nó, file i18n vi + en.

```ts
aiBridge?: {
  enabled: boolean
  clients: Array<{ keyHash: string; client: string; at: number }>
  onToggle(enabled: boolean): void
  onRevoke(keyHash: string): void
  discovered?: Array<{ keyHash: string; client: string; status: 'waiting' | 'other' }>
  onConnect?(keyHash: string): void
}
```

- Dưới danh sách client đã duyệt, khi `enabled` và `discovered` không rỗng: tiêu đề nhỏ `settings.ai.discovered`; mỗi mục hiện tên, mã `ABCD-1234`, và:
  - `waiting` → mô tả `settings.ai.waiting` + nút `settings.ai.connect` gọi `onConnect`.
  - `other` → mô tả `settings.ai.other` (đã ghép với trình duyệt/profile khác; kèm lệnh `npx le-sach-mcp unpair`), không có nút.
- Mục có `keyHash` trùng một client đã duyệt không hiện ở `discovered`.
- Test: hai trạng thái; nút gọi `onConnect` đúng `keyHash`; ẩn khi tắt; không trùng với client đã duyệt.

## 21d3 — Nối Cài đặt (`apps/extension/src/app`)
File: hook đang cấp `bridge` cho `App.tsx` (nơi có `bridge.clients`, `bridge.setEnabled`, `bridge.revoke`), test của hook, `App.tsx`.

- Hook đọc `chrome.storage.session[BRIDGE_SEEN_KEY]` bằng `parseSeen`, nghe `chrome.storage.onChanged` vùng `session`, trả thêm:
  - `discovered: Array<{ keyHash; client; status }>` với `status = (s.pinned === 'other' || s.rejected) ? 'other' : 'waiting'`, bỏ mục đã có trong `clients`, bỏ mục quá `SEEN_TTL_MS`.
  - `connect(keyHash): Promise<void>` gửi `{ type: BRIDGE_CONNECT_MSG, keyHash }`.
- `App.tsx` truyền `discovered`, `onConnect` vào `aiBridge`.
- Test: ánh xạ trạng thái; lọc trùng; `connect` gửi đúng message.

## 21e1 — E2E máy chủ đã ghim khoá khác
File: `apps/extension/e2e-pw/mcp.spec.ts` (thêm một kịch bản, dùng lại fixture MCP thật hiện có).

- Tạo file ghép cặp có sẵn `extKey` là một khoá P-256 **khác** khoá của extension đang test (giả lập profile thứ hai), chạy `le-sach-mcp` thật với `MDR_PAIR_FILE` đó, bật Kết nối AI.
- Khẳng định: sau 2 lượt quét không có tab `app.html?pair=` nào mở; Cài đặt → Kết nối AI hiện ứng dụng AI ở trạng thái "đã ghép với trình duyệt/profile khác", không có nút Kết nối.
- Kịch bản ghép cặp thường hiện có vẫn xanh (hỏi một lần, Cho phép, gọi tool được).

## 21e2 — Tài liệu + phiên bản
File: `docs/MCP.md`, `packages/mcp/package.json` + `cli.ts` (`VERSION = '1.3.3'`), `packages/core/src/bridge/protocol.ts` (`MCP_PACKAGE_SPEC = 'le-sach-mcp@1.3.3'`), `apps/extension/package.json`/manifest (`1.5.1`), ghi chú phát hành (`RELEASE_NOTES`, không bật `showOnUpdate`), `docs/ROADMAP.md`. Vượt 5 file → plan tách `21e2a` (phiên bản + ghi chú phát hành) và `21e2b` (tài liệu).

- `docs/MCP.md`: một ứng dụng AI chỉ ghép với một profile; profile khác không hỏi; cách kết nối tay; `unpair`; hỏi tối đa một lần với máy chủ cũ.
- Thứ tự phát hành: publish `le-sach-mcp@1.3.3` → nộp extension `1.5.1`.

## Lỗi và trường hợp biên
| Tình huống | Hành vi |
|---|---|
| Extension mới ↔ máy chủ `1.3.2`, profile chưa ghép | Hỏi một lần; Từ chối/bỏ mặc → không hỏi lại; Cho phép mà máy chủ từ chối → gỡ phê duyệt, đánh dấu `rejected`, Cài đặt hiện "đã ghép với nơi khác" |
| Extension `1.5.0` ↔ máy chủ `1.3.3` | Parser cũ bỏ qua `pinnedExt`; hành vi như hiện nay |
| Người dùng thu hồi client trong Cài đặt | 60 giây không hỏi (như cũ), sau đó `asked` → im lặng; kết nối lại bằng nút |
| Bấm Kết nối nhưng ứng dụng AI đã tắt | `{ ok: false }`, mục biến khỏi danh sách |
| Bấm Kết nối quá 10 phút sau khi máy chủ khởi động, máy chủ chưa ghim | `'rejected'` → thông báo chung, gợi ý khởi động lại ứng dụng AI |
| Service worker bị dừng giữa lúc chờ quyết định | `manual` mất → lần sau im lặng; `decide` nối lại theo `port` + `keyHash` nên Cho phép vẫn chạy |
| `le-sach-mcp unpair` khi máy chủ đang chạy | Tiến trình đang chạy vẫn giữ ghim trong bộ nhớ; thông báo yêu cầu khởi động lại |

## Deferred
- Ghép một ứng dụng AI với nhiều profile cùng lúc (nhiều khoá ghim).
- Mã `reject` chi tiết từ máy chủ (phân biệt hết cửa sổ ghép với khoá sai).
