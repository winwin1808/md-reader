# Design: Phase 8 — Chia sẻ & cộng tác
Author: Hao Nguyen (coordinator: Claude Fable). Status: designed. Phase: 8
Intent: docs/superpowers/intent/2026-10-24-phase-8-chia-se-cong-tac.md
Branch: `phase-8` from `main` (phases 6 and 7 are merged).

## Approach chosen

**One Worker, one Durable Object class, everything behind a token.** `apps/api` is a
single Cloudflare Worker that (1) answers the `/api/*` JSON routes, (2) routes
`/parties/doc/:roomId` WebSocket upgrades to the `DocRoom` Durable Object after
resolving the token to a role, and (3) serves the built `apps/web` as static assets
(SPA fallback) so the share URL `https://<server>/s/<token>` is one origin — no CORS,
one deploy, one URL to put in Settings. The DO runs `YServer` from `y-partyserver`,
which already speaks the y-websocket protocol and awareness; we only add `onLoad` /
`onSave` persistence and role filtering in `onMessage`. Clients use `YProvider`
from `y-partyserver/provider` next to the existing `y-indexeddb` binding; core gets a
bound `Y.Doc` and never learns which provider is attached (DESIGN §2.2).

Rejected:
- *NestJS + Postgres on a VPS* (DESIGN before 2026-10-24) — a server to patch and pay
  for; Yjs-over-WebSocket on Node needs an in-memory room map that does not scale past
  one process anyway. A DO per doc *is* that room map, hosted.
- *Separate `apps/web` deploy on Pages + CORS* — two deploys, two URLs, preflight on
  every API call, and a second place to configure the server address.
- *Hand-rolled y-websocket server on a DO* — y-partyserver already does the protocol,
  hibernation and awareness; writing it again adds code without changing the design.
- *Rendering share pages server-side with core on Workers* — core still pulls katex /
  highlight / yaml statically (7n: 152.9 KB gz); client-side render in `apps/web`
  reuses `@md-reader/ui` verbatim and keeps the Worker tiny.

## Decisions on the intent's open questions

1. **Compaction and batching.** DO storage keeps `snapshot` + an update log `u:<seq>`.
   `onSave` (y-partyserver debounce 2 s, max 10 s) compacts when the log holds ≥ 200
   updates **or** ≥ 256 KB, and always compacts when the room empties. **R2 is dropped
   (decision 2026-10-24, user wants zero billable products):** Durable Object SQLite
   storage is already durable, co-located and inside the Free plan's 5 GB; a snapshot
   larger than 1 MB is stored in `snap:<i>` chunks of 1 MB. **No client-side batching in 8c**: Yjs already merges a transaction per
   keystroke, and incoming WS messages are cheap on the Free plan. 8a0 measures
   messages per 30-minute two-person session; batching becomes a Deferred item only if
   that exceeds 5 % of the daily request budget.
2. **Owner offline, collaborator edits.** Not a new conflict kind. When the owner's
   extension reconnects, Yjs merges server updates into the local Y.Doc (CRDT). Disk
   remains governed by `originHash`: disk unchanged → save overwrites with the merged
   doc; disk changed too → the existing 3-way `ConflictModal`. No third branch.
3. **Token position: path.** `https://<server>/s/<token>`. Tokens are 32 random bytes
   base64url (43 chars); the server stores only SHA-256 of tokens. A path survives
   copy/paste in chat and lets the SPA fallback serve it; Free-plan Workers keep no
   request logs. Fragment-based URLs were rejected because the token must reach the
   server for the WebSocket upgrade anyway.
4. **Expiry presets:** 7 ngày · 30 ngày (default) · Không hết hạn. Every link is
   revocable; a revoked or expired token returns 410 and the web page shows "Link này
   không còn hiệu lực".
5. **Math and mermaid in the content script (8h):** placeholders with a "Mở trong MD
   Reader" button. No katex, no mermaid in content.js; budget target ≤ 50 KB gz,
   hard limit 60 KB.
6. **`apps/web` ships inside the `apps/api` Worker** via wrangler `assets`
   (`directory: ../web/dist`, `not_found_handling: single-page-application`).
   `apps/web` stays its own workspace package with its own Vite build and tests.
7. **Server identity on the client.** Registry record gains `room?: RoomBinding`
   (`serverUrl`, `roomId`, `ownerToken`). The Y.Doc never carries tokens: viewers
   receive the whole doc. `meta.actors` (already in `DocMeta`) maps `clientID → name`
   and is the only collaboration data that lives in the doc.
8. **Identity:** `displayName` setting in the extension (default "Bạn"), `localStorage`
   `mdr.displayName` on the web (prompted once before the first edit). Sent through
   awareness `user: { name, color }` and written to `meta.actors` via `registerActor`.
9. **Default server URL** is a constant `DEFAULT_SERVER_URL` in
   `apps/extension/src/shared/collab.ts`, set to `https://md-reader-api.qhao-work.workers.dev` (deployed in
   8a1.3). Settings → "Cộng tác" shows it, editable.

## Shared interfaces (produced early, consumed verbatim later)

### `@md-reader/core` — `share/` (8b1, `packages/core/src/share/`)
```ts
export type ShareRole = 'view' | 'edit'
export interface ShareLink {
  token: string            // raw token, only present in the create response
  tokenPrefix: string      // first 6 chars, for lists
  roomId: string
  role: ShareRole
  label: string
  createdAt: number
  expiresAt: number | null
  revokedAt: number | null
}
export interface RoomBinding { serverUrl: string; roomId: string; ownerToken: string }
export const SHARE_EXPIRY_PRESETS: Record<'7d' | '30d' | 'never', number | null>
export interface CreateRoomResponse { roomId: string; ownerToken: string }
export interface CreateLinkRequest { role: ShareRole; label?: string; expiresIn: number | null }
export interface ResolveTokenResponse { roomId: string; role: ShareRole; title: string | null }
export function normalizeServerUrl(input: string): string | null   // https only (http for localhost), no trailing slash
export function buildShareUrl(serverUrl: string, token: string): string // `${serverUrl}/s/${token}`
export function parseShareUrl(url: string): { serverUrl: string; token: string } | null
export function wsHost(serverUrl: string): string                   // host[:port] for YProvider
export const API_PATHS = {
  rooms: '/api/rooms',                                  // POST → CreateRoomResponse (no auth)
  links: (roomId: string) => `/api/rooms/${roomId}/links`,   // GET list · POST create; header Authorization: Bearer <ownerToken>
  revoke: (roomId: string, prefix: string) => `/api/rooms/${roomId}/links/${prefix}`, // DELETE
  resolve: (token: string) => `/api/s/${token}`,        // GET → ResolveTokenResponse | 410
  snapshot: (token: string) => `/api/s/${token}/snapshot`, // GET → application/octet-stream (Y update)
  party: 'doc-room',                                    // YProvider party name (kebab của binding DocRoom, đo ở 8a0) → /parties/doc-room/:roomId?token=
} as const
```
Pure TS, no I/O. Shared by `apps/api`, `apps/web`, `apps/extension`.

### `apps/api` (8a1–8a3, 8e1)
```ts
// src/env.ts
export interface Env {
  DOC_ROOM: DurableObjectNamespace<DocRoom>
  DB: D1Database
  ASSETS: Fetcher
}
// src/tokens.ts
export interface TokenStore {
  createRoom(): Promise<CreateRoomResponse>
  verifyOwner(roomId: string, ownerToken: string): Promise<boolean>
  createLink(roomId: string, req: CreateLinkRequest): Promise<ShareLink>
  listLinks(roomId: string): Promise<ShareLink[]>          // token field = '' in lists
  revoke(roomId: string, tokenPrefix: string): Promise<boolean>
  resolve(token: string): Promise<{ roomId: string; role: ShareRole } | null> // null = unknown/expired/revoked; owner tokens resolve to 'edit'
}
export class D1TokenStore implements TokenStore { constructor(db: D1Database) }
export class MemoryTokenStore implements TokenStore {}      // tests only
export async function hashToken(token: string): Promise<string>   // SHA-256 hex
export function newToken(): string                                // 32 bytes base64url
// src/room.ts
export class DocRoom extends YServer<Env> {
  static callbackOptions = { debounceWait: 2000, debounceMaxWait: 10000, timeout: 5000 }
  onLoad(): Promise<void>      // DO storage snap:* chunks + u:* log
  onSave(): Promise<void>      // compaction rule (decision 1); always compact on empty room
  onConnect(conn, ctx): void   // role from header x-mdr-role → conn.setState({ role })
  onMessage(conn, msg): void   // 8e1: drop sync step2/update from role 'view'
  fetch(req): Promise<Response> // GET /snapshot → encodeStateAsUpdate
}
// src/index.ts
export default { fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> }
// order: /api/* → handleApi · /parties/doc-room/* → authorizeWs then routePartykitRequest · else env.ASSETS.fetch
```
```sql
-- migrations/0001_init.sql
CREATE TABLE rooms (id TEXT PRIMARY KEY, owner_token_hash TEXT NOT NULL UNIQUE, title TEXT, created_at INTEGER NOT NULL);
CREATE TABLE links (token_hash TEXT PRIMARY KEY, token_prefix TEXT NOT NULL, room_id TEXT NOT NULL REFERENCES rooms(id),
  role TEXT NOT NULL CHECK (role IN ('view','edit')), label TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
  expires_at INTEGER, revoked_at INTEGER);
CREATE INDEX links_room ON links(room_id);
```
Token resolution for WebSocket upgrades is cached per isolate in a `Map<tokenHash,
{ roomId, role, until }>` with 60 s TTL (D1 read budget). Wire protocol inside the DO
is y-websocket: varUint messageType (0 sync · 1 awareness), then for sync a varUint
(0 step1 · 1 step2 · 2 update). Viewers may send `0/0` and `1`; everything else from a
viewer is dropped silently and counted in `this.droppedUpdates` for the test.

### `apps/extension` (8b4, 8c1)
```ts
// src/shared/collab.ts
export const DEFAULT_SERVER_URL: string
export type SyncStatus = 'off' | 'connecting' | 'online' | 'offline'
// src/app/collab/bindRoom.ts
export function bindRoom(doc: Y.Doc, opts: { serverUrl: string; roomId: string; token: string; name: string })
  : { provider: YProvider; awareness: Awareness; status$: (cb: (s: SyncStatus) => void) => () => void; destroy(): void }
// src/app/collab/useShare.ts
export function useShare(opts: { docId: string | null; serverUrl: string }): {
  binding: RoomBinding | null
  links: ShareLink[]
  enable(): Promise<RoomBinding>            // POST rooms, save registry.room
  createLink(req: CreateLinkRequest): Promise<ShareLink>
  revoke(prefix: string): Promise<void>
  refresh(): Promise<void>
  busy: boolean; error: string | null
}
// doc-registry.ts record: + room?: RoomBinding
// ReaderSettings (packages/ui): + serverUrl?: string · displayName?: string
```

### `@md-reader/ui` (8b3, 8c1, 8d1, 8f2, 8g2)
```ts
export interface ShareModalProps {
  open: boolean; onClose(): void
  binding: RoomBinding | null; links: ShareLink[]
  onEnable(): Promise<void>
  onCreateLink(req: CreateLinkRequest): Promise<ShareLink>
  onRevoke(prefix: string): Promise<void>
  buildUrl(token: string): string
  busy?: boolean; error?: string | null
}
// TopToolbar: + onShare?: () => void · syncStatus?: SyncStatus · presence?: Peer[]
export interface Peer { clientId: number; name: string; color: string; isSelf: boolean }
export function PresenceBar(props: { peers: Peer[] }): JSX.Element
export function peerColor(clientId: number): string   // one of 6 Lề sách ink tones, deterministic
// Editor: + awareness?: Awareness (passed to yCollab for remote cursors)
export interface BlameRange { from: number; to: number; clientId: number; actor: string | null }
export function BlameGutter(props: { ranges: BlameRange[]; text: string; actors: Record<string, string> }): JSX.Element
export interface HistoryTimelineProps {
  entries: HistoryEntry[]; actors: Record<string, string>
  previewId: string | null; previewText: string | null
  onPreview(id: string | null): void; onRestore(id: string): void
}
```

### `@md-reader/core` additions (8f1, 8g1, 8h1)
```ts
// doc/blame.ts
export function computeBlame(doc: Y.Doc): BlameRange[]   // walks Y.Text items; merges adjacent same-client runs
// doc/restore.ts
export function textAtCheckpoint(doc: Y.Doc, entry: HistoryEntry): string | null   // Y.createDocFromSnapshot; null if no snapshot
export function restoreCheckpoint(doc: Y.Doc, entry: HistoryEntry, actor: string): boolean // applyTextChange + appendHistory('Khôi phục: <label>')
// render: plugins injected by the caller (7n verdict)
export interface RenderPlugins { raw?: Plugin; highlight?: Plugin; math?: Plugin }
export function renderToHtml(parsed: Parsed, opts?: RenderOptions & { plugins?: RenderPlugins }): string
export interface ParseOptions { parseYaml?: (src: string) => unknown }   // undefined → frontmatter stripped, no metadata
// new subpath entry  @md-reader/core/plugins  (packages/core/src/plugins/index.ts, package.json "exports")
export function defaultRenderPlugins(): RenderPlugins   // static imports of rehype-raw, rehype-highlight, rehype-katex
export const parseYaml: (src: string) => unknown        // from 'yaml'
```
`packages/core/src/render/` and `src/parse/` must contain **no** static import of
`rehype-raw`, `rehype-highlight`, `rehype-katex`, `katex`, `yaml` after 8h1; `guard`
greps for it.

## Sub-phases

### 8a0 — SPIKE: y-partyserver on a Durable Object, Free plan
Spiker, throwaway under `spike/do-yjs/` (outside the workspace, deleted in 8a1).
Minimal Worker: `YServer` subclass, wrangler with DO binding, `wrangler dev`; two Node
clients with `YProvider` + `ws` polyfill editing one `Y.Text`. Report into DESIGN §5.6:
(1) converge yes/no and time to converge; (2) Worker bundle gz; (3) WS messages sent in a
scripted 30-minute two-client session at 3 edits/s, extrapolated to requests/day with
the 20:1 incoming ratio; (4) whether `wrangler deploy` on a Free account accepts SQLite
DO (`new_sqlite_classes` migration) and what the dashboard shows for storage; (5) does
`onConnect(conn, ctx)` expose the upgrade request headers. Decision rules: (1) must be
yes; (4) must be yes or the phase stops here and asks; (3) ≥ 5 % of 100 k → add
"client batching" to Deferred for 8c.

### 8a1 — `apps/api` scaffold
FILES `apps/api/package.json` · `wrangler.jsonc` · `src/env.ts` · `src/room.ts` ·
`src/index.ts` · `src/index.test.ts`. (`tsconfig.json` extends base; lockfile excluded.)
Deps: `partyserver`, `y-partyserver`, `yjs`, `@cloudflare/workers-types`, `wrangler`.
`DocRoom` with only in-memory doc (no persistence yet); `fetch` routes `/parties/*` via
`routePartykitRequest` and returns 404 JSON elsewhere; `GET /api/health` → `{ ok: true }`.
Test (vitest, node): route table — `/api/health` 200, `/parties/doc/x` without token 401,
unknown 404 — against `index.ts` with a stub env. Deploy once by hand; put the host into
`DEFAULT_SERVER_URL` (8b4 consumes it). Deletes `spike/do-yjs/`.

### 8a2 — tokens: D1 schema, store, HTTP routes
FILES `apps/api/migrations/0001_init.sql` · `src/tokens.ts` · `src/api.ts` (handleApi) ·
`src/index.ts` · `src/tokens.test.ts`.
Routes per `API_PATHS` (consumes 8b1 — so 8b1 is planned **before** 8a2; see queue).
Errors: 401 missing/invalid owner token, 404 room, 410 expired/revoked, 400 bad body.
Tests on `MemoryTokenStore` + `handleApi`: create room → create view link → resolve ok →
revoke → resolve 410; expired link 410; wrong owner 401; `hashToken` stable.

### 8a3 — persistence and snapshot endpoint
FILES `apps/api/src/room.ts` · `src/persistence.ts` · `src/api.ts` · `src/persistence.test.ts`.
`persistence.ts`: `loadState(storage): Promise<Uint8Array | null>`, `appendUpdate(storage, u)`,
`shouldCompact(stats): boolean`, `compact(storage, doc)` (writes `snap:<i>` 1 MB chunks +
`snap:meta {chunks, bytes}`, deletes `u:*`) — pure functions over a `KVLike` interface
(get/put/delete/list) so they test in node with a Map. No R2. `GET /api/s/:token/snapshot`
→ DO `fetch('/snapshot')`. Tests: compaction thresholds (199 vs 200 updates; 256 KB), load
order snapshot→log, chunking at > 1 MB round-trips, empty room compacts once.

### 8b1 — core `share/`
FILES `packages/core/src/share/share.ts` · `share/index.ts` · `src/index.ts` ·
`share/share.test.ts`. Exactly the interface above. Tests: URL build/parse round trip,
`normalizeServerUrl` rejects `http://` non-localhost and trailing slashes, `wsHost`.

### 8b2 — `apps/web` read-only page
FILES `apps/web/package.json` · `vite.config.ts` · `index.html` · `src/main.tsx` ·
`src/SharePage.tsx` · `src/SharePage.test.tsx` (tsconfig excluded). Route `/s/:token`:
resolve → snapshot → `new Y.Doc({ gc: false })` + `applyUpdate` → `exportText` →
`Viewer` + `ThemeProvider` from `@md-reader/ui`, title in the tab, footer "Xem bằng MD
Reader". States: loading, 410 "Link này không còn hiệu lực", network error with retry.
No `chrome.*`. `apps/api/wrangler.jsonc` gets the `assets` block in 8b4's deploy step.
Test: renders a doc from a stubbed fetch; shows the 410 copy.

### 8b3 — `ShareModal`
FILES `packages/ui/src/components/ShareModal.tsx` · `ShareModal.test.tsx` · `src/index.ts`
· `TopToolbar.tsx` (adds `onShare`). Unshared state: explanation "Tài liệu sẽ được tải
lên máy chủ đồng bộ. Chỉ người có link mới xem được." + "Bật chia sẻ". Shared: one
"Tạo link xem" (30 ngày) and the list of links with copy button; revoke per row.
Role picker and expiry presets arrive in 8e2. Tests: both states, copy writes clipboard,
revoke calls back with prefix.

### 8b4 — extension share wiring
FILES `apps/extension/src/shared/collab.ts` · `src/app/collab/useShare.ts` ·
`src/app/doc-registry.ts` (+`room`) · `src/app/App.tsx` · `src/app/collab/useShare.test.ts`.
Toolbar button "Chia sẻ" opens `ShareModal`; `enable()` POSTs and stores `room` in the
registry; `createLink` builds URLs with `buildShareUrl`. Also adds `assets` to
`apps/api/wrangler.jsonc` and a root script `pnpm deploy:api` = build web + wrangler
deploy (documented, not run by the pipeline). Test: hook state machine with stubbed fetch.

### 8c1 — WebSocket provider in the extension
FILES `src/app/collab/bindRoom.ts` · `src/app/hooks/useDocSession.ts` ·
`packages/ui/src/components/SettingsModal.tsx` (+`serverUrl`, `displayName` under tab
"Cộng tác") · `TopToolbar.tsx` (+`syncStatus`) · `bindRoom.test.ts`.
Binding happens after `whenSynced` of IndexedDB and only when `registry.room` exists;
destroyed on doc switch. `syncStatus` text: Ngoại tuyến / Đang kết nối / Đã đồng bộ.
Test: `bindRoom` with a fake `YProvider` constructor — status transitions and destroy.

**Split at plan time (2026-10-24)** because files and lines exceed the sizing rule:
- **8c1a** — `bindRoom` (+ `y-partyserver` dependency), `useDocSession` gains
  `opts.room` / `opts.displayName` and returns `syncStatus` + `awareness`; App passes
  `share.binding` and the default name "Bạn". Enabling share now uploads the doc.
- **8c1b** — `SettingsModal` tab "Cộng tác" (`serverUrl`, `displayName`), `TopToolbar`
  `syncStatus` text, App reads both settings (serverUrl through `normalizeServerUrl`).

### 8c2 — edit mode on the web
FILES `apps/web/src/SharePage.tsx` · `src/EditPage.tsx` · `src/collab.ts` (bindRoom twin,
same signature, no registry) · `src/EditPage.test.tsx`. Role `edit` → name prompt once
(`mdr.displayName`) → `Editor` + `FormattingToolbar` from ui bound through
`y-codemirror.next` with the provider's awareness; `SplitViewContainer` for preview.
No disk, no export. Test: edit role shows editor; view role never does.

### 8d1 — presence UI
FILES `packages/ui/src/components/PresenceBar.tsx` · `PresenceBar.test.tsx` · `Editor.tsx`
(+`awareness`) · `TopToolbar.tsx` (+`presence`) · `theme/tokens.css` (6 peer tones).
Avatars = initials in a tone from `peerColor`; tooltip with full name; self first.

### 8d2 — awareness wiring
FILES `apps/extension/src/app/collab/bindRoom.ts` · `src/app/App.tsx` · `apps/web/src/collab.ts`
· `apps/web/src/EditPage.tsx` · `apps/extension/src/app/collab/presence.test.ts`.
`awareness.setLocalStateField('user', { name, color })`; `registerActor(doc, name)` on
first local edit with role edit; `awarenessToPeers(states, selfId): Peer[]` helper (tested).

### 8e1 — role enforcement in the room
FILES `apps/api/src/room.ts` · `src/index.ts` (authorizeWs sets `x-mdr-role`) ·
`src/protocol.ts` (`classifyMessage(buf): 'step1' | 'step2' | 'update' | 'awareness' | 'other'`)
· `src/protocol.test.ts`. Viewer sends update → dropped, counter increments, nothing broadcast.

### 8e2 — link management
FILES `packages/ui/src/components/ShareModal.tsx` · `ShareModal.test.tsx` ·
`apps/extension/src/app/collab/useShare.ts`. Role picker (Xem / Sửa), expiry presets,
label, relative expiry text ("còn 12 ngày"), revoke confirm. "Tắt chia sẻ" revokes every
link (keeps the room; owner can re-enable). Tests: create edit link with 7d, revoke all.

### 8f1 — core blame
FILES `packages/core/src/doc/blame.ts` · `blame.test.ts` · `src/index.ts`. Walk
`getSource(doc)._start` items (the one private-API use, pinned by a test that the item
shape still has `id.client`, `length`, `deleted`, `content`). Tests: two docs edit,
sync, ranges match each client's text; deleted text absent; adjacent runs merged.

### 8f2 — `BlameGutter`
FILES `packages/ui/src/components/BlameGutter.tsx` · `BlameGutter.test.tsx` · `src/index.ts`
· `apps/extension/src/app/App.tsx` (toggle in toolbar `actions`). Gutter beside the Editor
in edit/split modes: a tone bar per line = dominant author, name on hover; off by default.

### 8g1 — core checkpoint restore
FILES `packages/core/src/doc/restore.ts` · `restore.test.ts` · `src/index.ts`.
Tests: text at checkpoint equals the text when the checkpoint was taken; restore applies a
minimal delta (origin `ORIGIN_REVERT`) and appends a history entry; entry without
snapshot → null and false.

### 8g2 — `HistoryTimeline`
FILES `packages/ui/src/components/HistoryTimeline.tsx` · `HistoryTimeline.test.tsx` ·
`src/index.ts` · `apps/extension/src/app/App.tsx` · `apps/extension/src/app/hooks/useHistory.ts`.
Right-side panel "Lịch sử": entries newest first (snapshots come from `Y.Array "history"`, no server fetch) with actor names from `meta.actors`,
"Xem" swaps the Viewer text (read-only banner "Đang xem mốc …"), "Khôi phục" calls
`restoreCheckpoint`. Keyboard: ↑↓ move, Enter preview, Esc exit.

### 8h1 — core: plugins and yaml injected by the caller
FILES `packages/core/src/render/render.ts` · `src/parse/parse.ts` · `src/plugins/index.ts`
· `packages/core/package.json` (exports) · `src/plugins/plugins.test.ts`.
Then a follow-up task in the same sub-phase plan updates callers (`packages/ui` Viewer /
`apps/extension` app / `apps/web`) to import `@md-reader/core/plugins` — the plan **must
split** this into 8h1a (core) and 8h1b (callers) if the caller edit touches > 2 files.
Tests: render with no plugins has no `<code class="hljs">` and no katex markup; with
`defaultRenderPlugins()` both appear; frontmatter without `parseYaml` is stripped.

### 8h2 — in-place reading in the content script (7o)
FILES `apps/extension/src/content/render.ts` · `ContentApp.tsx` · `content.css` ·
`index.ts` · `ContentApp.test.tsx`. Raw `.md` page → render into the shadow root over the
`<pre>`; bar "Đọc trong MD Reader" · "Xem bản thô"; math/mermaid placeholders. Still no
Yjs, no `@md-reader/ui`. `check-size.js` stays at 61 440; the plan records the measured gz
and the review blocks above 50 KB unless the spec is amended with the reason.

### 8i — import lock
FILES `apps/extension/src/app/doc-registry.ts` · `doc-registry.test.ts`.
`findOrCreateByOrigin` runs inside `navigator.locks.request('mdr:import:' + originKey)`;
fallback to direct call when `navigator.locks` is undefined. Test: two concurrent calls
with a fake `locks` resolve to the same record.

### 8j — e2e smoke: extension ↔ web
FILES `apps/extension/e2e/collab.spec.ts` · `playwright.config.ts` (webServer: `wrangler dev`
in `apps/api`, port 8787) · `apps/extension/package.json` (script). Flow: open app with a
doc, Settings serverUrl = localhost:8787, Chia sẻ → Bật → Tạo link sửa → open URL in a
second context → type → text appears in the extension; presence shows 2.

### 8k — store kit, privacy, version
FILES `docs/store/listing.md` · `docs/store/privacy-policy.md` · `apps/extension/public/manifest.json`
· `apps/extension/package.json` · `README.md`. Version 1.1.0. Privacy: data leaves the
device only when the user turns on sharing for a document; what is stored on the server
(doc content, display names, link metadata), retention (until the owner turns sharing
off), no analytics. Listing gains the "Chia sẻ" paragraph in VI + EN.

## Sub-phase queue
- 8a0: done      (spike; stop-and-ask if Free plan rejects SQLite DO)
- 8b1: done      (core share types — before 8a2 which consumes them)
- 8a1: done
- 8a2: done
- 8a3: done
- 8b2: done
- 8b3: done
- 8b4: done
- 8c1a: done      (provider + đẩy nội dung; tách từ 8c1 vì >300 dòng)
- 8c1b: planned   (Settings "Cộng tác" + trạng thái đồng bộ trên toolbar)
- 8c2: pending
- 8d1: pending
- 8d2: pending
- 8e1: pending
- 8e2: pending
- 8f1: pending
- 8f2: pending
- 8g1: pending
- 8g2: pending
- 8h1: pending   (plan may split 8h1a core / 8h1b callers)
- 8h2: pending
- 8i: pending
- 8j: pending
- 8k: pending

## Invariants copied into every envelope (pick the relevant 3-6)
- packages/core: pure TS — no react, chrome.*, document/window; it receives a bound Y.Doc and never imports a provider.
- packages/ui: no chrome.*. apps/api: no document/window, no chrome.*. apps/web: no chrome.*.
- Cross-package imports by workspace name only (`@md-reader/core`, `@md-reader/core/plugins`, `@md-reader/ui`).
- Y.Doc schema unchanged (`formatVersion: 2`); tokens never stored in the Y.Doc; `meta.actors` is the only collab data in the doc.
- Server stores only SHA-256 of tokens; view connections cannot write; 410 for expired/revoked. No R2 binding anywhere.
- Content script: no Yjs, no ui package, no katex/mermaid, ≤ 60 KB gz (target ≤ 50 KB).
- Writes to Y.Text are minimal deltas (`applyTextChange`) or CodeMirror transactions.
- Copy in Vietnamese, sentence case, no emoji, icon-only buttons have aria-label.

## Deferred
- Client-side update batching — only if 8a0 shows ≥ 5 % of the daily request budget per session.
- Comment role, per-user accounts/OAuth, link passwords.
- Lazy KaTeX in the app page (app.js 417 KB gz) — becomes natural after 8h1 (`plugins` entry is already separate).
- IDB flake `TransactionInactiveError` (not reproduced in 30 runs).
