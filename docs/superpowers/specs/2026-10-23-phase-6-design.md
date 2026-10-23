# Design: Phase 6 — Gia cố (Hardening)
Author: haonq (coordinator: Claude Opus). Status: designed. Phase: 6
Intent: docs/superpowers/intent/2026-10-23-phase-6-gia-co.md
Facts: docs/research/2026-10-23-phase-6-codemap.md (line numbers below refer to it, branch `phase-6` @ 128894a)

## Approach chosen

**Refactor-first, then fix in the small pieces.** `App.tsx` (875 dòng) is split
into hooks with no behaviour change (6b1-6b3, guarded by the existing 27-test
`App.test.tsx`), and every later fix lands in one hook instead of the god
component. Data fixes go in dependency order: delta primitive (6a) → replace
the writes (6c) → safe load (6d) → identity/schema (6e) → handles/3-way (6f).

Rejected:
- *Fix in place inside App.tsx first, split later* — every fix would touch the
  same 875-line file, each sub-phase would blow the ≤300-line budget on context
  alone, and builders would have to read the whole file every task.
- *One big "rewrite App" sub-phase* — impossible under the sizing rule and
  impossible to review.

## Decisions on the intent's open questions

1. **Yjs `gc: false` from `formatVersion: 2`.** Every session constructs
   `new Y.Doc({ gc: false })`. Each checkpoint stores `Y.encodeSnapshot(Y.snapshot(doc))`
   in the history entry, so phase 8g can restore any checkpoint with attribution.
   Cost (tombstones) is acceptable once 6a/6c make writes minimal. Content
   deleted before the upgrade is already collected — timeline restore starts
   from the first v2 checkpoint; recorded in DESIGN §2.1.
2. **Split App.tsx first** (6b1-6b3), behaviour-preserving.
3. **Math: implement** with `remark-math` + `rehype-katex` in core (pure, Node-safe),
   KaTeX CSS loaded in the app page only.
4. **Remove dead toggles** `advancedTables`, `taskLists`, `enablePlantUml`,
   `enableGraphviz` (GFM is always on; remote diagram servers would send document
   content off-machine — out of scope). `enableMermaid` gets wired.
5. **Playwright** as a separate script `pnpm --filter extension e2e`, not part of
   `test`. The current jsdom "e2e" specs move to `src/flows/` and stay in vitest.
6. **Not in this phase:** the 122 redundant `expect(getBy…).toBeDefined()` asserts
   (they are redundant, not wrong — `getBy*` already throws; a cross-file sweep
   would violate sizing for little value) → Deferred to phase 7n.
7. **Registry location:** IndexedDB DB `md_reader_registry` in `apps/extension`
   (it holds `FileSystemFileHandle`, which only IDB can store). core gets no
   registry code — it only knows `Y.Doc`.
8. **Transaction origins** (string constants, exported from core so every layer
   uses the same values):
   `ORIGIN_LOAD = 'md:load'` (import from disk/URL — not dirty),
   `ORIGIN_FORMAT = 'md:format'` (format-on-save — not dirty),
   `ORIGIN_REVERT = 'md:revert'` (take disk version — not dirty).
   User edits: CodeMirror's y-codemirror origin or `null` → dirty and undoable.

## Shared interfaces (produced early, consumed verbatim later)

```ts
// packages/core/src/doc/apply.ts   (6a)
export interface TextChange { index: number; deleteCount: number; insert: string }
export function computeTextChanges(prev: string, next: string): TextChange[]
export function applyTextChange(yText: Y.Text, next: string, origin?: unknown): boolean
export const ORIGIN_LOAD = 'md:load'
export const ORIGIN_FORMAT = 'md:format'
export const ORIGIN_REVERT = 'md:revert'

// apps/extension/src/app/hooks/useDocSession.ts   (6b1; extended 6d, 6e3, 6i1, 6j3)
export interface DocSession {
  doc: Y.Doc; yText: Y.Text; undoManager: Y.UndoManager
  content: string            // debounced 120ms from 6i1
  title: string
  hasContent: boolean
  isDirty: boolean
  setDirty(dirty: boolean): void
  error: string | null
  setError(message: string | null): void
  synced: boolean            // y-indexeddb finished initial load
}
export function useDocSession(opts: { fileUrl: string | null }): DocSession   // 6e3 changes opts, see there

// apps/extension/src/app/hooks/useFileSave.ts   (6b2; extended 6c, 6d, 6f1, 6f2, 6j3)
export type SaveState =
  | { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string; canSaveAs: boolean }
  | { kind: 'conflict' } | { kind: 'needs-permission'; fileName: string }
export interface FileSave {
  activeHandle: FileSystemFileHandle | null
  saveState: SaveState
  save(opts?: { explicit?: boolean }): Promise<void>     // explicit=true from Cmd+S / button
  conflict: { open: boolean; localContent: string; diskContent: string; baseContent?: string }
  keepLocal(): Promise<void>
  revertToDisk(): Promise<void>
  closeConflict(): void
  saveAs(): Promise<void>            // added in 6d: always opens the Save As picker
}
export function useFileSave(session: DocSession, settings: { formatOnSave: boolean }): FileSave
```

## Sub-phases

Sizing: every row ≤5 files touched, ≤300 diff lines, ≤1 new test file. Pure code
moves (6b*) count moved lines once.

### 6a — `core/doc` applyTextChange
- **Builds:** `computeTextChanges` = trim common prefix/suffix, then Myers O((N+M)·D)
  diff over UTF-16 code units of the middle; if D > 2000 return one change for the
  whole middle. Changes returned in ascending `index` against `prev`.
  `applyTextChange` reads `yText.toString()`, returns `false` without a
  transaction when equal, else applies changes **from last to first** inside one
  `doc.transact(fn, origin)`. `importText` (doc.ts:64) is re-implemented on top of
  it (keeps its signature; origin `ORIGIN_LOAD`).
- **Files:** core/src/doc/apply.ts (new), core/src/doc/doc.ts, core/src/index.ts,
  core/src/doc/apply.test.ts (new).
- **Tests prove:** applying changes to `prev` yields `next` (property test over
  ~200 random string pairs incl. Vietnamese combining marks and emoji);
  equal → no update event emitted; editing one word keeps
  `sourceClientIds` of untouched text = original client (attribution survives);
  two replicas: A formats `* a\n* b\n` → `- a\n- b\n` while B appends `\nc` —
  after sync both equal `- a\n- b\n\nc` (no duplication);
  `importText` still passes existing doc tests.

### 6b1 — extract `useDocSession` (no behaviour change)
- **Builds:** moves from App.tsx: persistenceName/doc/yText/undoManager memos
  (:110-117), persistence effect (:192-237), file-load effect (:304-388), and the
  states content/docTitle/hasContent/isDirty/error/isFileContentSetRef into
  `useDocSession`. App consumes `DocSession`. `synced` set on y-indexeddb `synced`.
- **Files:** apps/extension/src/app/hooks/useDocSession.ts (new), App.tsx.
- **Tests prove:** existing `App.test.tsx` (27) green unchanged; no new test file
  (pure move).

### 6b2 — extract `useFileSave` (no behaviour change)
- **Builds:** moves activeHandle, conflict states, executeSave, handleSave,
  handleKeepLocal, handleRevertToDisk, handleSaveRef, autosave effect (:535-551)
  and Cmd+S effect (:554-563) into `useFileSave`. `saveState` exists but in 6b2
  only reflects `saving`/`idle`/`conflict` (others come in 6d/6f1).
  `settings.formatOnSave` is fed from `readerSettings.autoFormatMd` for now.
- **Files:** apps/extension/src/app/hooks/useFileSave.ts (new), App.tsx.
- **Tests prove:** `App.test.tsx` green unchanged.

### 6b3 — extract `useExport`, `useShortcuts`, add ErrorBoundary
- **Builds:**
  `useExport(args: { html: string; title: string; parseResult: ParseResult }): { exportAs(format: ExportFormat): Promise<void>; isExporting: boolean; isPrintingSlides: boolean }`
  (moves handleExport :624-666);
  `useShortcuts(map: { onSearch(): void; onMindmap(): void; onPresent(): void; onEscape?(): void; enabled: { present: boolean } }): void`
  (moves effects :142-190 except Cmd+S which stays in useFileSave);
  `AppErrorBoundary` class component in `src/app/AppErrorBoundary.tsx` showing
  "Có lỗi khi hiển thị tài liệu." + the message + a "Tải lại" button; `main.tsx`
  wraps `<App/>`.
- **Files:** hooks/useExport.ts (new), hooks/useShortcuts.ts (new),
  AppErrorBoundary.tsx (new), App.tsx, main.tsx. No new test file (moves);
  AppErrorBoundary is checked by the reviewer and exercised by 6k1.
- **Tests prove:** `App.test.tsx` green unchanged; typecheck.

### 6c — stop whole-text writes; format only on explicit save
- **Builds:**
  - useDocSession load path: `applyTextChange(yText, text, ORIGIN_LOAD)`.
  - useFileSave: `executeSave(handle, { format })`; format-on-save writes via
    `applyTextChange(yText, formatted, ORIGIN_FORMAT)`; revert via
    `applyTextChange(yText, disk, ORIGIN_REVERT)`. Autosave calls
    `save({ explicit: false })` → **never formats**. Cmd+S calls
    `save({ explicit: true })` → formats iff `settings.formatOnSave`.
  - Dirty tracking ignores the three ORIGIN_* constants (replaces the old
    'save-format'/'load-file' strings).
  - App `handleFormatAction`: compute `applyFormat(...)`; if `editorViewRef.current`
    exists, `view.dispatch({ changes: computeTextChanges(old, newText).map(c => ({ from: c.index, to: c.index + c.deleteCount, insert: c.insert })), selection: { anchor: newSelectionStart, head: newSelectionEnd }, userEvent: 'input.format' })`
    (goes through y-codemirror → undoable, dirty); otherwise
    `applyTextChange(yText, newText)` (origin null → undoable, dirty).
  - FileDrop: `applyTextChange(doc.getText('source'), content, ORIGIN_LOAD)` +
    sets `originHash` (hashText) in the same flow.
  - New setting `formatOnSave` (ReaderSettings, default `true`) replaces the use of
    `autoFormatMd` in saving; `autoFormatMd` keeps meaning "content script active".
    SettingsModal gets one toggle row "Định dạng Markdown khi bấm lưu".
- **Files:** hooks/useDocSession.ts, hooks/useFileSave.ts, App.tsx, FileDrop.tsx,
  packages/ui/src/components/SettingsModal.tsx. Test: new
  `apps/extension/src/app/hooks/useFileSave.test.tsx`.
- **Tests prove:** autosave path does not change text (format would have);
  explicit save formats; after a format-on-save the untouched lines keep their
  original clientID; formatting button marks dirty and `undoManager.undo()`
  restores previous text.

### 6d — safe load, honest save errors
- **Builds:**
  - useDocSession: file load waits for y-indexeddb `whenSynced` before touching
    text. Then, with `remote` text and `h = hashText(remote)`:
    empty Y.Text → import + set `originHash = h`;
    `meta.originHash === h` → keep Y.Doc as is (local edits preserved);
    else if `hashText(yText) === meta.originHash` (no local edits) → apply remote
    (ORIGIN_LOAD) + update originHash; else set
    `externalChange: { remoteText: string; remoteHash: string } | null` and do
    nothing. Adds to DocSession: `externalChange`, `acceptExternal(): void`
    (apply remote, ORIGIN_LOAD, update originHash), `dismissExternal(): void`.
  - useFileSave: `handle.getFile()` failure → `saveState = { kind:'error', message:'Không đọc được file trên đĩa (đã bị xoá hoặc di chuyển?).', canSaveAs:true }`,
    no conflict. Write failure → error state with the exception message.
    Successful save → `{ kind:'saved', at: Date.now() }`. `keepLocal` takes the
    same `isSavingRef` guard. While `saveState.kind === 'conflict'` autosave is
    paused; `closeConflict()` keeps `kind:'conflict'` (no re-open loop) until the
    next explicit save. A cancelled Save As picker → `idle`.
  - App: minimal banners using the existing `.error-banner` markup: externalChange
    → "File gốc đã thay đổi kể từ lần mở trước." [Tải bản mới] [Giữ bản đang sửa];
    save error → message + [Lưu thành…] when canSaveAs. (Visual design: phase 7.)
- **Files:** hooks/useDocSession.ts, hooks/useFileSave.ts, App.tsx,
  hooks/useFileSave.test.tsx, new `hooks/useDocSession.test.tsx`.
- **Tests prove:** sync-after-load ordering cannot duplicate (mock persistence
  resolving late); unchanged remote keeps local edits; changed remote + local edits
  → externalChange set, text untouched; getFile rejects → error state, no conflict,
  text untouched; closing conflict does not re-open on next autosave tick.

### 6e1 — `core/doc` formatVersion 2 + migration
- **Builds:** `FORMAT_VERSION = 2`. `HistoryEntry` gains `snapshot?: Uint8Array`
  and `label` values `'save' | 'auto' | 'import'` (type stays `string`).
  `migrateDoc` v1→v2 in one transaction: `meta.name` → `meta.title` (if title
  missing), delete `meta.size`, ensure `createdAt` (Date.now()), `actors` ({}),
  `originPath` (null), set `formatVersion: 2`. Doc with no `formatVersion` = v1.
  New `ensureDoc(doc: Y.Doc, init?: Parameters<typeof createDoc>[0]): { migrated: boolean }`
  — if meta empty, writes createDoc fields into the existing doc (used by sessions
  that receive a doc from a provider); else runs migrateDoc.
- **Files:** core/src/doc/schema.ts, core/src/doc/doc.ts, core/src/index.ts,
  core/src/doc/migrate.test.ts (new, includes a v1 fixture built the way the
  old App wrote docs: bare doc + meta name/size/originHash), core/src/doc/doc.test.ts.
- **Tests prove:** v1 fixture → v2 shape; idempotent; >2 throws; two replicas
  migrating concurrently converge to the same meta.

### 6e2 — extension doc registry module
- **Builds:** `apps/extension/src/app/doc-registry.ts`:
  ```ts
  export type OriginKind = 'url' | 'file' | 'drop'
  export interface DocRecord { docId: string; title: string; originKind: OriginKind; originPath: string | null; persistenceName: string; lastOpenedAt: number; hasHandle: boolean }
  export function findByOrigin(originPath: string): Promise<DocRecord | null>
  export function getRecord(docId: string): Promise<DocRecord | null>
  export function createRecord(init: { title: string; originKind: OriginKind; originPath: string | null; persistenceName?: string }): Promise<DocRecord>  // docId = crypto.randomUUID(); default persistenceName `md-reader-doc-${docId}`
  export function touchRecord(docId: string, patch?: Partial<Omit<DocRecord, 'docId'>>): Promise<void>  // sets lastOpenedAt = Date.now()
  export function listRecent(limit?: number): Promise<DocRecord[]>  // lastOpenedAt desc, default 10
  export function storeHandle(docId: string, handle: FileSystemFileHandle): Promise<void>
  export function getHandle(docId: string): Promise<FileSystemFileHandle | null>
  export function storeBase(docId: string, text: string): Promise<void>
  export function getBase(docId: string): Promise<string | null>
  export function migrateLegacyRegistry(): Promise<number>  // once (flag key 'migratedV1' in store 'meta'):
     // chrome.storage.local 'recentFiles' entries whose id looks like a URL → createRecord(url) with persistenceName `md-reader-${encodeURIComponent(url)}` (the legacy y-indexeddb name, so no data copy);
     // if IDB database 'md-reader' exists (indexedDB.databases()) → one record {title:'Tài liệu đã kéo thả', originKind:'drop', persistenceName:'md-reader'}; returns records created
  ```
  DB `md_reader_registry` v1, stores `docs` (keyPath docId, index `originPath`),
  `handles`, `bases`, `meta`.
- **Files:** doc-registry.ts (new), doc-registry.test.ts (new),
  apps/extension/package.json (devDep `fake-indexeddb` 6.0.1, test setup imports
  `fake-indexeddb/auto` inside the test file).
- **Tests prove:** CRUD + ordering; legacy migration creates records once and
  points at legacy persistence names; handles/bases round-trip (handle mocked as
  a structured-cloneable object).

### 6e3 — wire registry into the session
- **Builds:** URL contract: `app.html?doc=<docId>` (primary) and
  `app.html?file=<url>` (resolved via `findByOrigin`, else `createRecord`
  originKind 'url', then `history.replaceState` to `?doc=`). No param → empty
  state. `useDocSession(opts: { docId: string | null; fileUrl: string | null })`;
  it runs `migrateLegacyRegistry()` once, opens
  `new IndexeddbPersistence(record.persistenceName, doc)` with
  `new Y.Doc({ gc: false })`, calls `ensureDoc` after `whenSynced`, `touchRecord`
  on open, and DocSession gains `docId: string | null`, `record: DocRecord | null`.
  Title comes from `readMeta(doc).title`. FileDrop: creates a record
  (originKind 'drop', title = file name), writes the text into a **new** doc for
  that record, navigates to `?doc=<id>`; it no longer receives the current doc.
  RecentFiles: lists `listRecent()`, links `?doc=<id>`. Speaker window URL uses
  `?doc=`. `registry.ts` is deleted (its two callers move to doc-registry).
- **Files:** hooks/useDocSession.ts, App.tsx, FileDrop.tsx, RecentFiles.tsx,
  registry.ts (delete). Test updates: hooks/useDocSession.test.tsx,
  FileDrop.test.tsx — these are test files of touched modules (counted with them).
- **Tests prove:** dropping two files yields two records and two persistence
  names; reopening `?doc=` restores text; `?file=` for a known URL reuses the record.

### 6f1 — file handles per doc, Open file, permission prompt
- **Builds:** on save-as / open, `storeHandle(docId, handle)` + `touchRecord({hasHandle:true})`.
  On session open with `record.hasHandle`: `getHandle` → `handle.queryPermission({mode:'readwrite'})`;
  `'granted'` → activeHandle; otherwise `saveState = { kind:'needs-permission', fileName: handle.name }`
  and `FileSave` gains `grantPermission(): Promise<void>` (calls `requestPermission`
  — must be invoked from a click). New App button "Mở file…" in the empty state
  and in toolbar `rightActions`: `openLocalFile()` → find existing record whose
  stored handle `isSameEntry` (loop over records with hasHandle) else create
  (originKind 'file', originPath `file:${handle.name}`), import text
  (ORIGIN_LOAD), originHash, storeHandle, navigate `?doc=`. `idb-handle.ts` is
  deleted; `file-system.ts` stops re-exporting it.
- **Files:** hooks/useFileSave.ts, App.tsx, fs/file-system.ts, fs/idb-handle.ts
  (delete), hooks/useFileSave.test.tsx.
- **Tests prove:** stored handle + granted → saves without picker; prompt state
  when not granted and grantPermission flips it; open-same-file twice → one record.

### 6f2 — real three-way conflict
- **Builds:** after every successful import (load/open/drop) and save,
  `storeBase(docId, text)`. On conflict, `conflict.baseContent = await getBase(docId) ?? undefined`.
  `ConflictModal`: when `baseContent` is provided, render two labelled diffs —
  "Thay đổi trên đĩa" (`computeLineDiff(base, disk)`) and "Thay đổi của bạn"
  (`computeLineDiff(base, local)`) with added/removed counts in each header;
  without it keep today's 2-way view. Buttons unchanged in behaviour.
- **Files:** hooks/useFileSave.ts, hooks/useDocSession.ts, FileDrop.tsx,
  packages/ui/src/components/ConflictModal.tsx, ConflictModal.test.tsx.
- **Tests prove:** modal shows both diffs and correct counts from a base;
  falls back to 2-way without base.

### 6g1 — render transforms as rehype plugins (before sanitize)
- **Builds:** `core/src/render/plugins.ts` exports `rehypeGithubAlerts(options: { locale: 'vi' | 'en' })`,
  `rehypeExternalLinks()`, `rehypeTypographer()` (text nodes only, skipping
  descendants of `pre, code, kbd, script, style, svg`) and
  `rehypeMetadataCard(frontmatter: Record<string, unknown>)` — hast transforms
  producing exactly today's markup. `renderToHtml` inserts them **before**
  `rehypeSanitize`; `sanitizeSchema` usage in render extends allow-lists for what
  they emit (div/svg/path with the alert classes; `a[target, rel, className]`;
  `span.external-link-icon`/svg; metadata card div/dl/dt/dd classes). The string
  functions in options.ts are removed; `processFrontmatter` stays exported.
- **Files:** core/src/render/plugins.ts (new), core/src/render/render.ts,
  core/src/render/options.ts, core/src/render/render-options.test.ts (4 files; no
  new test file — render-options.test.ts covers the plugins).
- **Tests prove:** all 15 existing render-options cases pass unchanged in output;
  a `> [!NOTE]` containing `<img onerror>` raw text (allowRawHtml false) stays
  inert; typographer does not touch code spans.

### 6g2 — clobber prefix, in-page anchors, Viewer mermaid switch
- **Builds:** `sanitizeSchema.clobberPrefix = 'user-content-'`, drop `foreignObject`
  from tagNames. `extractToc` ids become `'user-content-' + slug` so ToC/mindmap
  scroll targets match. `Viewer` intercepts clicks on `a[href^="#"]`: scrolls to
  `#user-content-<hash>` if present, else `#<hash>`. `ViewerProps.mermaid?: boolean`
  (default true) — false leaves mermaid code blocks as code (consumed by 6j2).
- **Files:** core/src/parse/sanitize-schema.ts, core/src/render/render.ts,
  core/src/render/render.test.ts, packages/ui/src/Viewer.tsx,
  packages/ui/src/Viewer.test.tsx.
- **Tests prove:** heading id has prefix and matches toc id; `id`/`name` clobber
  attempts get the prefix; Viewer anchor click scrolls to the prefixed id;
  `mermaid={false}` mounts no MermaidBlock.

### 6h1 — manifest, worker, shared URL rules
- **Builds:** `apps/extension/src/shared/md-url.ts`:
  `export const MD_EXTENSIONS = ['md','markdown','mdown','mkd','mdx'] as const`;
  `export function isMarkdownUrl(url: string): boolean` (case-insensitive, ignores
  query/hash; `github.com/<o>/<r>/blob/` excluded). Manifest: permissions
  `["storage","activeTab"]` (drop `tabs`, `scripting`); host_permissions and
  content_scripts matches = the 7 `*://*/*.<ext>` patterns (+ upper-case `.MD`,
  `.MARKDOWN`) + `file:///*`; drop localhost/127.0.0.1 entries;
  `web_accessible_resources: [{ resources:["app.css"], matches: <same md patterns + file:///*> }]`.
  Worker: remove the `tabs.onUpdated` executeScript/redirect block (manifest
  content script + content-side redirect already cover it); action click uses
  `isMarkdownUrl`; on `runtime.onStartup`/`onInstalled` purge `file_content_*`
  entries older than 10 minutes (entries become `{ text: string; ts: number }`).
- **Files:** public/manifest.json, src/worker/index.ts, src/worker/index.test.ts,
  src/shared/md-url.ts (new), src/shared/md-url.test.ts (new).
- **Tests prove:** URL rules incl. `.mdx`, query strings, GitHub blob; purge keeps
  fresh entries and deletes stale/legacy-string ones; action click routing.

### 6h2 — content script caches only on demand
- **Builds:** content/index.ts no longer writes `file_content_*` on every visit;
  it writes `{ text, ts }` only (a) when the user clicks open, or (b) right before
  the alwaysOpenApp redirect. ContentApp: drop the `window.open(app.html)`
  fallback (no WAR for app.html) — on failure show "Không mở được MD Reader. Thử
  bấm biểu tượng MD Reader trên thanh công cụ." Use `isMarkdownUrl`.
  useDocSession reads both new `{text, ts}` and legacy string values, then removes the key.
- **Files:** src/content/index.ts, src/content/ContentApp.tsx,
  src/content/index.test.ts, src/content/ContentApp.test.tsx, hooks/useDocSession.ts.
- **Tests prove:** visiting does not write storage; clicking writes `{text,ts}`;
  failure message shown; budget still ≤61440 (guard).

### 6i1 — debounce, lazy derived data, mermaid cache
- **Builds:** `DocSession.content` updates at most every 120ms (trailing debounce
  on Y.Text observe; flush immediately on load/revert origins). App computes
  `slides` only when `isPresenting || isPrintingSlides || isSpeakerMode` and
  `mindmapRoot` only when `isMindmapOpen`. `MermaidBlock` keeps a module-level
  `Map<string, string>` (code → svg, max 50 entries, LRU) and renders cached SVG
  synchronously; mermaid initialize becomes `{ startOnLoad:false, securityLevel:'strict' }`.
- **Files:** hooks/useDocSession.ts, hooks/useDocSession.test.tsx, App.tsx,
  packages/ui/src/components/MermaidBlock.tsx, MermaidBlock.test.tsx.
- **Tests prove:** 10 rapid edits → ≤2 content updates (fake timers); same mermaid
  code renders once across two mounts.

### 6i2 — fast line diff
- **Builds:** `computeLineDiff` same signature and output contract; trims common
  prefix/suffix lines then Myers O((N+M)·D) on the middle; sets `lineNumber`
  (1-based in the side it belongs to: modified for added/same, original for removed).
- **Files:** core/src/diff/diff.ts, core/src/diff/diff.test.ts.
- **Tests prove:** existing 10 cases; 20k-line files with 3 edits diff in <200ms
  and produce minimal output.

### 6i3 — code splitting
- **Builds:** `packages/ui/package.json` `"sideEffects": ["**/*.css"]` and subpath
  exports `"./editor": "./src/components/Editor.tsx"`,
  `"./split-view": "./src/components/SplitViewContainer.tsx"`, `"./deck": "./src/components/Deck.tsx"`.
  `packages/core/package.json` subpath `"./docx": "./src/export/docx.ts"`.
  App loads Editor/SplitViewContainer/Deck with `React.lazy` + `<Suspense fallback>`;
  useExport imports `@md-reader/core/docx` dynamically. The ui `index.ts` keeps
  its exports (tests import them).
- **Files:** packages/ui/package.json, packages/core/package.json, App.tsx,
  hooks/useExport.ts, apps/extension/vite.config.ts (manualChunks only if needed).
- **Tests prove:** `App.test.tsx` green; build shows separate chunks; initial
  `app.js` gz reported before/after (target: ≥30% smaller).

### 6j1 — math in core
- **Builds:** core deps `remark-math` 6.0.0, `rehype-katex` 7.0.1 (+ `katex` 0.16.x
  peer). `ParseOptions.math?: boolean` (default true) adds remark-math in
  `parseMarkdown`; `RenderOptions.math?: boolean` (default true) runs
  `rehypeKatex` **after** `rehypeSanitize` (it only reads math nodes' text; its
  output is generated, not user HTML). Sanitize keeps `className` matching
  `/^math-/` on code/span/div so math nodes survive to katex.
- **Files:** core/package.json, core/src/parse/index.ts, core/src/render/render.ts,
  core/src/render/types.ts, core/src/render/render-options.test.ts.
- **Tests prove:** `$a^2$` and `$$\int$$` render `.katex`; `math:false` leaves text;
  `<script>` inside `$...$` is rendered as text by katex, not executed markup.

### 6j2 — wire / remove settings
- **Builds:** App passes `math: readerSettings.enableMath` to parse+render and
  `mermaid={readerSettings.enableMermaid}` to Viewer (prop from 6g2). Extension app
  imports `katex/dist/katex.min.css` in main.tsx (dep `katex` in
  apps/extension/package.json). Remove `advancedTables`, `taskLists`,
  `enablePlantUml`, `enableGraphviz` from `ReaderSettings`, defaults and SettingsModal.
- **Files:** App.tsx, main.tsx, packages/ui/src/components/SettingsModal.tsx,
  packages/ui/src/components/SettingsModal.test.tsx, apps/extension/package.json.
- **Tests prove:** SettingsModal no longer renders the removed rows; toggling
  math/mermaid settings changes `onSettingChange` keys that App forwards.

### 6j3 — checkpoints with real clientIds, quiet 30s, snapshots
- **Builds:** core `doc/checkpoint.ts`:
  ```ts
  export interface CheckpointTracker { flush(label: 'save' | 'auto' | 'import', actor: string): HistoryEntry | null; dispose(): void }
  export function createCheckpointTracker(doc: Y.Doc, opts?: { quietMs?: number; onAuto?: (e: HistoryEntry) => void; actor?: string }): CheckpointTracker
  export function registerActor(doc: Y.Doc, name: string): void   // meta.actors[String(doc.clientID)] = name
  ```
  Collects clientIDs whose state-vector clock advanced or who appear in the
  deleteSet of each transaction touching `source`; `flush` appends
  `{ actor, label, clientIds:[...sorted], snapshot: Y.encodeSnapshot(Y.snapshot(doc)) }`
  (returns null when nothing changed); quietMs (default 30000) timer fires
  `flush('auto', opts.actor ?? 'local')`. useDocSession creates the tracker
  (actor name 'Bạn') and `registerActor`; useFileSave calls `flush('save', ...)`
  instead of the `as any` appendHistory call.
- **Files:** core/src/doc/checkpoint.ts (new), core/src/doc/checkpoint.test.ts (new),
  core/src/index.ts, hooks/useDocSession.ts, hooks/useFileSave.ts.
- **Tests prove:** two replicas editing → entry lists both clientIDs; no-change
  flush → null; quiet timer (fake timers) appends one 'auto'; snapshot decodes
  and `Y.createDocFromSnapshot` (gc:false doc) reproduces the text at that moment.

### 6k1 — Playwright smoke on real Chromium
- **Builds:** apps/extension devDep `@playwright/test` 1.56.1, script
  `"e2e": "pnpm build && playwright test"`; `playwright.config.ts` (testDir `e2e-pw`,
  one worker, Chromium headless with `--disable-extensions-except=dist --load-extension=dist`
  via `launchPersistentContext` in a fixture); `e2e-pw/fixtures.ts` (extension
  context, extensionId from service worker URL, tiny node `http` server serving a
  temp dir of `.md` files on a random port); `e2e-pw/smoke.spec.ts` with 3 flows:
  (1) open `http://127.0.0.1:<port>/doc.md` → widget → open → app shows the H1;
  (2) in app, switch to the editor, type, reload → text persists;
  (3) change the served file, reopen → "File gốc đã thay đổi" banner.
  vitest include must not pick up `e2e-pw/`.
- **Files:** apps/extension/package.json, playwright.config.ts (new),
  e2e-pw/fixtures.ts (new), e2e-pw/smoke.spec.ts (new test file), vite.config.ts.
- **Tests prove:** the 3 flows pass headless in this machine's Chromium
  (`~/Library/Caches/ms-playwright/chromium-1248` already present).

### 6k2 — rename jsdom "e2e" to flows
- **Builds:** move `apps/extension/e2e/{editor,export,mindmap,ux-reading}.spec.ts`
  → `apps/extension/src/flows/*.flow.test.tsx` (content unchanged except import
  paths); vitest include drops `e2e/**`.
- **Files:** the 4 moved files + vite.config.ts.
- **Tests prove:** extension test count unchanged.

### 6k3 — delete junk
- **Builds:** `git rm patch.cjs patch_intent.cjs patch_modal.cjs patch_plan.cjs apps/extension/sources.txt`; add `.vitest/` to root .gitignore.
- **Files:** the 5 deleted files (+ .gitignore — counted as the cleanup task's 6th
  trivial touch; accepted: zero-logic deletions).
- **Tests prove:** full suite green.

## Sub-phase queue

- 6a: done
- 6b1: done
- 6b2: done
- 6b3: done
- 6c: done
- 6d: done
- 6e1: done
- 6e2: done
- 6e3: done
- 6e4: done      (split from 6e3 at plan time: drop, recent files, delete registry.ts)
- 6f1: done
- 6f2: done   (data half: base storage)
- 6f3: done   (split from 6f2 at plan time: three-way ConflictModal UI)
- 6g1: done
- 6g2: done
- 6h1: done
- 6h2: done
- 6i1: done
- 6i2: done
- 6i3: done
- 6j1: done
- 6j2: done
- 6j3: done   (core tracker)
- 6j4: done   (split from 6j3 at plan time: wiring into session + saves)
- 6k1: done
- 6k2: done
- 6k3: pending

## Deferred

- To 7n: replace redundant `expect(getBy…).toBeDefined()` asserts.
- To 7n (review 6f3): ConflictModal a11y — aria-label on the "+a −r" counts, pane headings /
  aria-labelledby, a visible +/− marker per changed line.
- To 7n (review 6e2/6e3): cross-tab dedupe for registry migration (in-tab is done).
- To 7l: content script renders Markdown in place (read-only).
- To 7 (review 6j2): the mermaid setting gates only Viewer, not Deck/slides.
- To 7 (review 6k1): a small dedicated content.css for the widget instead of the full app.css (~100 KB) in the shadow root.
- To 7n (review 6k1): Playwright — replace waitForTimeout(500) with a persistence signal; resolve dist relative to the config file.
- To 8x: PlantUML/Graphviz only if a self-hosted renderer exists; raw-HTML
  "tin tài liệu này" per-doc toggle UI.
