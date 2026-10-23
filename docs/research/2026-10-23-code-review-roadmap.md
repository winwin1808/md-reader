# Code review & roadmap — md-reader @ `main` (4d52e78), 2026-10-23

Phạm vi: kiến trúc, độ đúng, dữ liệu, bảo mật, hiệu năng, test, sẵn sàng phase 6. Không lặp lại các phát hiện
về giao diện trong `docs/design/2026-10-23-ui-audit.md`, chỉ nhắc lại khi chúng ảnh hưởng tới kiến trúc.
Bằng chứng: codegraph + đọc file + chạy lệnh thật (dưới). Chỗ nào chưa kiểm được thì ghi **nghi vấn**.

```
pnpm -r typecheck                    exit 0
pnpm --filter core test              12 files, 133 passed
pnpm --filter ui test                25 files, 207 passed
pnpm --filter extension test         12 files, 65 passed
pnpm --filter extension build        exit 0 · dist/content.js 30.58 kB, gz 11.76 kB (check-size: 11657 B ≤ 61440)
                                     dist/app.js 1,910 kB, gz 599.9 kB (một chunk, Vite cảnh báo >500 kB)
Mô phỏng Yjs (node, yjs 13.6.32)     2 replica cùng "xoá hết + chèn lại" → nội dung bị nhân đôi (xem R1)
```

## 1. Tóm tắt

- **Xanh về hình thức, vàng về thực chất.** Typecheck, 405 test và build đều qua. Ranh giới package sạch:
  `core` không có `chrome.*`/DOM/React, `ui` không có `chrome.*`, không có import tương đối giữa các package.
- **Lõi `core` tốt:** parse/render/slides/mindmap/format/diff đều thuần TS và có test. Schema Y.Doc có
  `formatVersion` và `migrateDoc`. **Lớp app lại dùng Y.Doc như một biến string:** có 6 chỗ "xoá toàn bộ Y.Text rồi
  chèn lại". Kiểu ghi này phá attribution, và khi có 2 replica thì **nhân đôi nội dung**. Đây là blocker số 1
  của phase 6, và ngay hôm nay đã gây lỗi khi mở lại file.
- Có nhiều tính năng mà tài liệu handover ghi là "done" nhưng **chưa được nối vào luồng thật**: khôi phục file handle
  sau reload, diff 3 chiều, debounce 120ms, content script render Markdown, 6 setting render. Phần "E2E" thực ra là
  test jsdom có mock, không phải Playwright.
- `App.tsx` (875 dòng, 21 `useState`, 13 `useEffect`) gánh hết: provider, I/O, lưu file, export, phím tắt. Muốn
  đổi provider ở phase 6 thì phải tách lớp này ra trước.
- Khuyến nghị: làm **một phase "Hardening" ngắn (H1–H4) trước phase 6**. Sửa hết mục 3 hạng Critical/High trước
  khi viết dòng collab đầu tiên.

## 2. Kiến trúc thực tế so với DESIGN.md (8 ràng buộc khoá cứng)

| # | Ràng buộc | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Y.Doc là nguồn sự thật, schema + `formatVersion` + migration | **Lệch** | `App.tsx:115` dùng `new Y.Doc()` chứ không gọi `createDoc` (`core/doc/doc.ts:4-26`), nên `formatVersion`/`createdAt`/`actors` không bao giờ được ghi. `migrateDoc` (`doc.ts:91`) không được gọi khi load. `meta` dùng key `name`/`size` (`App.tsx:318`, `FileDrop.tsx:39-40`), không có trong `DocMeta` (`schema.ts:11-20`, field là `title`). `originPath` không bao giờ được set. Y.Text vẫn là state thật, cái đó đạt. |
| 2 | Ranh giới package, import bằng tên workspace | **Đạt** | grep `chrome.` trong `packages/*/src` cho 0 kết quả. `core` không có `document/window/react`. 0 import `../../packages`. |
| 3 | `core` không biết provider | **Đạt ở core, lệch ở app** | `core` không import `y-indexeddb`. Nhưng việc gắn provider nằm inline trong component (`App.tsx:192-237`), không có hook hay adapter nào để thay bằng WebSocket. |
| 4 | Content script không Yjs, ≤60KB gz | **Đạt (và hơi quá tay)** | gz 11.76 kB, alias preact (`vite.content.config.ts:9-14`), không có yjs. Nhưng content script **không còn render Markdown nữa**, chỉ mount một widget (`content/index.ts:144-178`), trái với §1 "render tại chỗ, read-only" và phase con 1h1. |
| 5 | unified/remark, re-parse toàn bộ, debounce 120ms | **Nửa đạt** | Đúng là remark (`core/parse/index.ts:22-54`). **Không có debounce:** observer gọi `setContent` mỗi lần Y.Text đổi (`App.tsx:213`), rồi `useMemo` parse+render (`:583-608`), `splitIntoSlides` render từng slide (`:105`), `extractMindmap` (`:610`). Tức là mỗi phím gõ ở split view tốn khoảng 2 lần render toàn bộ. grep `debounce` trong source cho 0 kết quả. |
| 6 | Excalidraw chỉ ở app page, lazy, `viewMode` | **Lệch thiết kế** | Không dùng thư viện Excalidraw. `ExcalidrawBlock.tsx` (336 dòng) tự vẽ một tập con các element, import tĩnh vào `Viewer.tsx:5`. Content script không render nên vế "chỉ app page" vẫn đúng. Mindmap cũng không dùng `d3-hierarchy` như §9 (layout tự viết trong `MindmapModal.tsx`). |
| 7 | PDF bằng print, Word bằng `docx` | **Đạt, thiếu ảnh/sơ đồ** | `printDocument`/`printSlides`, `mdastToDocx` (`App.tsx:629-653`). `imageMap` không được truyền nên ảnh trong .docx bị bỏ (`docx.ts:157-163`). `rasterizeSvg` (phase 2d) không được ai gọi. HTML export nhận `html` của core (`App.tsx:642`), nên mermaid còn nguyên là khối code, không phải "SVG đã render" như 2b yêu cầu. |
| 8 | Không giả định mermaid chạy trong content script | **Đạt** | Mermaid chỉ có ở `ui/MermaidBlock.tsx:17` (`import()` lazy, tách chunk), content script không dùng. |

Lệch khác so với DESIGN: diff "ba chiều" thật ra là 2 chiều. `ConflictModal` có prop `baseContent?` nhưng App không
truyền, và tổ tiên chung không được lưu ở đâu, chỉ có hash (`App.tsx:734-742`). Registry `docId → {name, originPath,
fileHandle, lastOpenedAt}` (§2.2) chưa có. `recentFiles` ở `chrome.storage.local` dùng URL hoặc tên file làm id
(`registry.ts:11-20`). Quyền manifest rộng hơn §3 ("chỉ `storage`"): có thêm `tabs`, `scripting`,
`http(s)://localhost/*`, `127.0.0.1/*`, và `web_accessible_resources` mở `app.html` cho `*://*/*`. Raw HTML toggle
"tin tài liệu này" (§2.5) chưa có UI: `allowRawHtml` không được truyền ở đâu, mặc định an toàn.

## 3. Bất lợi và rủi ro (xếp theo mức độ)

**R1 — Critical — Thay toàn bộ Y.Text ở 6 chỗ, phá lịch sử Yjs và nhân đôi nội dung khi merge.**
Bằng chứng: `App.tsx:311-315` (load-file), `:397-400` (format khi lưu), `:483-486` (revert), `:498-500`,
`:516-518`, `:527-529` (nút định dạng), `FileDrop.tsx:34-36` (không có transaction, không origin). Mô phỏng: 2 replica
cùng format `"* a\n* b\n"` cho ra `"- a\n- b\n- a\n- b\n"`.
Tác động: (a) blame theo ký tự (§2.3) vô nghĩa, vì mọi ký tự bị gán lại cho client vừa lưu. (b) Undo của một thao tác
định dạng là xoá và chèn cả tài liệu. Undo trước mốc format-on-save, vốn không được track (origin `save-format`),
cho kết quả khó đoán. (c) Phase 6: hai người cùng lưu hoặc cùng định dạng thì tài liệu nhân đôi.
Sửa: thêm `applyTextChange(yText, next)` vào `core/doc`, chỉ áp phần khác giữa chuỗi cũ và mới (trim prefix/suffix
rồi diff ký tự trên đoạn giữa). Nút định dạng nên `view.dispatch` qua CodeMirror (`markdown-commands.ts` đã trả
`newText`/selection). Thêm test hội tụ 2 replica ở mức thao tác app. **Effort M.**

**R2 — Critical — Mở lại file từ URL có thể ghi đè hoặc nhân đôi bản sửa cục bộ.**
Bằng chứng: `loadContent` luôn thay Y.Text bằng nội dung lấy từ mạng hoặc cache (`App.tsx:309-331`). Lệnh này chạy
khi IndexedDB chưa chắc đã `synced`: `chrome.storage.local.get` (`:373`) và `IndexeddbPersistence` (`:195`) chạy
song song. Mô phỏng nhánh "load trước, sync sau" cho ra `"old\nold + my edits\n"`.
Tác động: file mở từ URL không có handle, nên nơi duy nhất giữ bản sửa là IDB. Mở lại link thì mất bản sửa (nhánh sync
xong trước) hoặc nội dung bị dính đôi (nhánh **nghi vấn** về thứ tự, phụ thuộc timing).
Sửa: `await persistence.whenSynced`, rồi so `hash(remote)` với `meta.originHash`. Bằng nhau thì giữ nguyên Y.Doc.
Khác nhau mà doc có bản sửa chưa lưu thì hiện lựa chọn, không tự thay. **Effort S–M.**

**R3 — High — Auto-format chạy mỗi 2s autosave, tự viết lại văn bản dưới con trỏ người gõ.**
`autoFormatMd` mặc định `true` (`App.tsx:52`). Autosave 2000ms (`:535-551`) gọi `executeSave`, và hàm này format
rồi thay toàn văn (`:395-401`). Tác động: bullet `*` thành `-`, ký tự bị escape. CodeMirror nhận một remote change
trên cả tài liệu, nên con trỏ và vùng chọn bị nhảy (**nghi vấn** về mức độ, chưa chạy tay). Biến R1 thành sự kiện
lặp lại liên tục. Sửa: chỉ format khi người dùng bấm lưu (Cmd+S), autosave không format. Tách setting
"format khi lưu" khỏi `autoFormatMd`, vì cờ này đang đồng thời quyết định content script có chạy hay không
(`content/index.ts:52`). **Effort S.**

**R4 — High — Xung đột giả khi không đọc được file trên đĩa, dẫn tới xoá sạch tài liệu.**
`handleSave` nuốt lỗi `getFile()` và để `diskText = ''` (`App.tsx:444-450`). `detectConflict(originHash, '')` trả
`true` (`diff.ts:9-12`), modal hiện "bản trên đĩa" rỗng. Bấm "Tải lại từ đĩa" là Y.Text bị đặt thành `''`
(`:481-490`). `handleKeepLocal` cũng bỏ qua `isSavingRef` (`:474-479`). Sửa: lỗi đọc file phải là một trạng thái
lỗi riêng ("file đã bị xoá/di chuyển — Lưu thành…"), không được thành xung đột. Bọc keep-local bằng cùng guard.
**Effort S.**

**R5 — High — Các file kéo-thả dùng chung một Y.Doc, recent files không mở lại được.**
`persistenceName` là `'md-reader'` khi không có `?file=` (`App.tsx:110-113`), nên mỗi lần thả file mới là đè lên
doc cũ, kể cả bản sửa chưa lưu. Recent files ghi `id: file.name` (`FileDrop.tsx:42-46`), click vào thì mở
`?file=<tên>`. App sẽ fetch tên đó như một URL rồi báo lỗi (`RecentFiles.tsx:25-29`, `App.tsx:357-370`).
Sửa: registry `docId (uuid) → {name, originPath, handle?, lastOpenedAt}` đúng như §2.2, mỗi doc một
`IndexeddbPersistence`. **Effort M.**

**R6 — High — Khôi phục file handle là code chết, tính năng "lưu thẳng về đĩa" mất sau mỗi lần reload.**
`getStoredFileHandle`, `verifyHandlePermission`, `openLocalFile` chỉ được gọi trong test (grep). `activeHandle` chỉ
được set sau `saveFileAs` (`App.tsx:431-433`). IDB chỉ có một key `active_file` (`idb-handle.ts:4`), không gắn
với doc nào. Không có nút "Mở file". Tác động: §5.5 ("thiết kế với giả định quyền sẽ mất") chưa được hiện thực.
Mỗi phiên làm việc người dùng phải Save As lại. Sửa: lưu handle theo `docId` trong registry R5. Khi mở doc thì
`queryPermission`, và gọi `requestPermission` từ một cử chỉ của người dùng (nút "Cho phép lưu"). **Effort M.**

**R7 — High — Bảo mật render: sanitize đã nới và sửa HTML bằng regex sau khi sanitize.**
`clobberPrefix: ''` (`sanitize-schema.ts:23`) tắt chống DOM clobbering cho `id`/`name` do người dùng viết (rủi ro
thấp ở app page vì CSP MV3 chặn inline script, nhưng sẽ thành **bắt buộc sửa** khi `apps/web` render share link
công khai). `foreignObject` nằm trong whitelist (`:39`). `applyGitHubAlerts`, `applyExternalLinks` và
`applyTypographer` chạy regex trên chuỗi HTML **sau** sanitize (`render.ts:120-128`). Hiện chúng chỉ chèn hằng số,
nhưng mọi thay đổi về sau có thể vượt qua sanitize, và alert đóng `<p>` bằng `</div>` (`options.ts` `applyGitHubAlerts`).
Mermaid `initialize({startOnLoad:false})` không ghim `securityLevel` (`MermaidBlock.tsx:18`). Mặc định thư viện là
`strict` (**nghi vấn**, chưa kiểm ở bản 12). PlantUML/Graphviz chỉ là toggle chết (mục R11), nên hiện chưa có
request nào ra server sơ đồ bên ngoài. Sửa: chuyển các transform thành plugin rehype chạy *trước*
`rehype-sanitize`, đặt `clobberPrefix: 'user-content-'` và sửa slug ToC cho khớp, bỏ `foreignObject` nếu không cần,
ghim `securityLevel:'strict'`. Nếu làm PlantUML thì phải có opt-in theo doc, vì nó gửi nguyên nội dung sơ đồ ra
server. **Effort M.**

**R8 — Medium — Quyền và bề mặt tấn công của extension.**
`web_accessible_resources` mở `app.html` cho `*://*/*` (manifest), nên trang bất kỳ có thể nhúng hoặc mở
`app.html?file=<url>` (rủi ro clickjacking, ghi doc rác vào IDB theo URL tuỳ ý). `tabs` có thể thừa vì host
permission đã đủ để đọc URL `.md` (**nghi vấn**). `tabs.onUpdated` gọi `scripting.executeScript(content.js)`
(`worker/index.ts:97-107`) trong khi manifest đã khai content script. `onUpdated` bắn nhiều lần mỗi lần điều hướng,
nên content script chạy lại và cache lại nhiều lần. Guard bằng `#md-reader-root` chỉ chặn được phần mount.
Content script cũng khớp mọi trang `localhost/*` và coi trang nào có `<pre>` và ≤2 phần tử con là markdown
(`content/index.ts:87-90`). Sửa: thu hẹp WAR (chỉ `app.css`, mở app qua `chrome.tabs` của worker), bỏ
`executeScript` hoặc bỏ khai báo tĩnh, bỏ match localhost (hoặc chỉ giữ cho `*.md`). **Effort S.**

**R9 — Medium — `chrome.storage.local` phình lên không giới hạn.**
Mỗi lần mở một trang `.md`, toàn văn bị ghi vào `file_content_<url>` (`content/index.ts:107-115`, lặp lại ở
`ContentApp.tsx:18-25` và `worker/index.ts:19-27`). Key chỉ bị xoá khi app mở đúng URL đó (`App.tsx:377`). Quota
`local` mặc định 10MB và manifest không có `unlimitedStorage`. Khi đầy thì `set` lỗi trong im lặng và luồng mở file
chuyển sang fetch, mà fetch `file:` lại cần quyền file URL. Thêm nữa, y-indexeddb lưu update tăng dần, chỉ gộp sau
khoảng 500 update. Doc 50KB lưu 500 lần có thể chiếm khoảng 25MB trước khi gộp (**nghi vấn**, tính từ mô phỏng:
mỗi update thay toàn văn khoảng 50KB). Sửa: chỉ cache khi người dùng bấm mở (hoặc truyền qua message), đặt TTL và
dọn khi worker khởi động. R1 sửa xong thì update sẽ nhỏ lại. **Effort S.**

**R10 — Medium — Hiệu năng với file lớn.**
(a) Không có debounce (xem ràng buộc 5). (b) Viewer unmount rồi mount lại **mọi** khối mermaid mỗi khi `html` đổi
(`Viewer.tsx:79-109`), nên mỗi phím gõ ở split view render lại hết sơ đồ. (c) `computeLineDiff` cấp bảng n×m đầy
đủ (`diff.ts:32`): file 10k dòng cần khoảng 10⁸ ô, dễ làm tab crash khi mở ConflictModal. (d) `app.js` là một chunk
600KB gz. CodeMirror và `docx` nằm sẵn trong đó (grep dist), trái §5.3 "lazy theo route". `HIGHLIGHT_LANGUAGES`
được export nhưng không truyền vào `rehypeHighlight` (`render.ts:78`), nên bộ ngôn ngữ đầy đủ bị kéo vào bundle.
Sửa: debounce 120ms ở chỗ `setContent`. Chỉ tính slides/mindmap khi modal mở. Cache SVG mermaid theo hash nội dung.
Diff: trim prefix/suffix rồi dùng Myers. Lazy `Editor` / `docx` / `Deck`. **Effort M.**

**R11 — Medium — Setting "ma" và tính năng được ghi là done nhưng chưa nối.**
`enableMath`, `enableMermaid`, `advancedTables`, `taskLists`, `enablePlantUml`, `enableGraphviz` chỉ xuất hiện ở
`App.tsx:57-61` (default) và `SettingsModal.tsx`. Không có code render nào đọc chúng, và không có remark-math hay
katex trong deps của core. Undo/Redo trên toolbar không render vì App không truyền callback (audit UI). History
checkpoint ghi `actor:'user', clientIds:[]` qua `as any`, kèm field `source`/`timestamp` mà `appendHistory` bỏ qua
(`App.tsx:407-413`, `history.ts:13-19`). Không có checkpoint "lặng 30s" (§2.3). Sửa: nối các setting vào render hoặc
xoá chúng. Checkpoint phải ghi `clientIds` thật (clientID của các transaction kể từ mốc trước). **Effort S–M.**

**R12 — Medium — Chất lượng test: nhiều nhưng nông ở đúng chỗ rủi ro.**
Bốn file "E2E" (`apps/extension/e2e/*.spec.ts`) là vitest jsdom, `vi.mock('y-indexeddb')` và mock `file-system`
(`editor.spec.ts:34`). Chúng được gom chung vào vitest (`vite.config.ts:24`), không phải Playwright load-unpacked
như §6. Không có test nào cho manifest, worker routing thật, content script trên Chrome, persistence sau reload,
hay quota. 122 lần `expect(getBy…).toBeDefined()` là assert vô nghĩa, vì `getBy*` vốn đã throw khi không tìm thấy.
Test hội tụ chỉ có ở primitive (`converge.test.ts:36-96`), không có cho thao tác app (R1, R2). Đó là lý do 405 test
xanh mà vẫn sót bug dữ liệu. Sửa: thêm Playwright + Chromium load-unpacked với 3 luồng khói: mở .md → app, sửa →
reload còn bản sửa, lưu → xung đột. Thêm test hội tụ cho `applyTextChange`. **Effort M.**

**R13 — Low — Tech debt.**
`App.tsx` là god component: 875 dòng, `fileUrlParam` đọc lại mỗi lần render (`:102-103`), `undoManager` và `doc`
không bao giờ được `destroy()`, không có ErrorBoundary ở app page (`main.tsx`). `renderToHtml` nuốt lỗi rồi trả
`''` (`render.ts:140-143`), nên người dùng thấy trang trắng mà không có thông báo. `handleSettingChange` ghi mọi key
vào cả `sync` lẫn `local` mà không `await` hay bắt lỗi quota (`App.tsx:565-573`). `slideBgImage` dạng data URL có thể
vượt 8KB/item của `sync` (**nghi vấn**). Có 41 chỗ `any`/`as any` trong source không phải test. Ở root còn 4 file
`patch*.cjs`: script dùng regex ghi đè `docs/DESIGN.md` (`patch.cjs:2-19`), commit nhầm. `apps/extension/sources.txt`
(377 dòng liệt kê module cũ) đã stale. Dep `docx` và `@codemirror/*` dùng `^`, trong khi phần còn lại ghim phiên bản.
Sửa: tách `useDocSession`, `useFileSave`, `useExport`, `useShortcuts`. Xoá các file rác. **Effort M (tách App), S (dọn).**

## 4. Mức sẵn sàng cho phase 6 (collab)

**Đã có sẵn và giúp được:** Y.Text là state thật. Editor bind bằng `yCollab(yText, null, {undoManager})`
(`Editor.tsx:65`), tức chỉ cần truyền `awareness` thay cho `null` là có con trỏ và presence. `core` thuần, chạy trên
Node được (vitest env node, `hash.ts` dùng `globalThis.crypto`), đủ cho 6b render share link bằng `core/render`
phía server. Schema đã có `actors` và `history.clientIds`. Đã có `sourceClientIds` (`history.ts:30-40`) kèm test.
`BroadcastChannel` sync slide là tiền lệ cho kênh presence.

**Đang chặn, phải sửa trước:**
1. **R1/R2/R3**: mọi thao tác thay toàn văn phải thành delta nhỏ nhất. Không sửa thì provider nào (WebSocket hay
   WebRTC) cũng nhân đôi nội dung ngay lần lưu đầu tiên của 2 người.
2. **Định danh doc**: hiện doc được định danh bằng URL hoặc chuỗi `'md-reader'`. Collab cần `docId` ổn định
   (uuid trong registry, R5) làm room name. Nội dung từ file hay URL chỉ là `originPath`.
3. **Provider adapter**: tách `App.tsx:192-237` thành `useDocSession(docId, providers[])` trong `apps/extension`.
   `core` vẫn chỉ nhận `Y.Doc` (ràng buộc 3). Hiện mỗi tab, kể cả speaker view (`App.tsx:704-711`), tạo một Y.Doc
   riêng trên cùng IDB và không đồng bộ live với nhau (**nghi vấn** gây merge lạ, R2). Có adapter thì có thể thêm
   `y-indexeddb` + kênh BroadcastChannel ngay.
4. **Attribution**: `createDoc`/`migrateDoc` chưa được gọi. `meta.actors` không bao giờ được ghi. Checkpoint chứa
   `clientIds: []`. Cần map `doc.clientID → tên tự khai` khi mở phiên.
5. **Timeline tua lại được (6g)**: `Y.Doc` mặc định `gc: true` (`App.tsx:115`), nên `Y.snapshot`/khôi phục mốc cũ
   **không làm được** với dữ liệu hiện tại. Phải chốt trong DESIGN: hoặc `gc:false` từ một `formatVersion` mới (kèm
   migration và đánh đổi dung lượng), hoặc lưu snapshot hay text theo từng checkpoint. Đây là thay đổi schema nên
   theo §5.4 bắt buộc kèm migration + fixture.
6. **Lựa chọn transport**: DESIGN §2.2/§4 chốt WebSocket + `apps/api` (NestJS + Postgres). `y-webrtc` sẽ là một
   lệch thiết kế, cần ghi lại quyết định (rẻ cho demo P2P, nhưng không có share link bền và không có phân quyền
   6e). Đề xuất giữ đúng DESIGN.
7. **Bảo mật cho web công khai**: R7 (clobber, transform sau sanitize, raw HTML toggle theo doc) là điều kiện cần
   của 6b, vì `apps/web` không có CSP MV3 che chắn.

## 5. Tính năng có thể phát triển tiếp

Ký hiệu: [P5] hoặc [P6] là nằm trong phase có sẵn của DESIGN. [Mới] là cần phase mới, nghĩa là phải chạy
`brainstorm-intent`/`capture-intent`. Không có tính năng AI nào trong danh sách.

**Now (rẻ, dựa trên code sẵn có):**
| Tính năng | Giá trị | Dựa trên | Effort | Phase |
|---|---|---|---|---|
| Mở lại file và lưu thẳng về đĩa sau reload | Không phải Save As lại mỗi phiên | `idb-handle.ts`, `verifyHandlePermission` đã viết sẵn | S–M | [P5] nợ 5b |
| Nút "Mở file…" / "Mở thư mục…" | Đường vào chính thay cho kéo-thả | `openLocalFile` (`file-system.ts:29`) | S | [P5] 5b |
| Diff 3 chiều thật | Giải xung đột an toàn hơn | lưu `baseText` khi import/lưu, `ConflictModal.baseContent` đã có prop | S | [P5] 5d |
| Math (`$…$`) bằng remark-math + KaTeX lazy | Setting hiện có nhưng chết | katex đã nằm trong dist (qua mermaid) | S | [P1/P2] |
| Content script render read-only | Đúng lời hứa §1, đọc ngay không cần mở tab | `core/parse` + `render` (bản không highlight), budget còn khoảng 48KB | M | [P1] 1h1 |

**Next:**
| Tính năng | Giá trị | Dựa trên | Effort | Phase |
|---|---|---|---|---|
| Version timeline cục bộ + diff viewer | "Hôm qua tôi đã đổi gì", khôi phục bản cũ, không cần server | `Y.Array history`, `computeLineDiff`, `ConflictModal` | M (+ quyết định gc/snapshot) | [P6] 6g, làm local-first trước |
| Command palette (Cmd+K) | Mọi hành động có một chỗ, giảm tải cho toolbar 10+ nút (audit UI) | handler đã có sẵn trong App: present, mindmap, export, search, view mode | S–M | [Mới] nhỏ, hoặc gộp vào Hardening UX |
| Outline/mindmap thành điều hướng và chỉnh cấu trúc | Kéo node để đổi thứ tự section, "Present từ heading này" | `core/mindmap` (slug khớp ToC), `core/slides` | M | [Mới] |
| Local folder workspace (`showDirectoryPicker`) | Làm việc với cả thư mục ghi chú | `file-system.ts`, registry R5 | M | [P5] 5b ghi "mở folder"; phần cây thư mục là [Mới] |
| Tìm kiếm toàn workspace | Tìm nhanh trong nhiều file | `core/parse` (mdast thành text), index thuần TS trong core | M | [Mới] (phụ thuộc workspace) |
| `[[wikilink]]` + backlinks | Liên kết ghi chú kiểu Obsidian-lite (không phải IDE, đúng non-goal) | plugin remark trong `core/parse`, slug `core/render/slug.ts` | M | [Mới] |

**Later:**
| Tính năng | Giá trị | Dựa trên | Effort | Phase |
|---|---|---|---|---|
| Share link read-only, rồi co-edit, rồi awareness | Mục tiêu phase 6 | `core/render` trên Node, `yCollab` awareness | L | [P6] 6a–6e |
| `BlameGutter` (ai viết dòng này) | Trace tác giả | `sourceClientIds`, `meta.actors` (sau khi R1 xong) | M | [P6] 6f |
| Export ảnh/sơ đồ đầy đủ (docx `imageMap`, HTML có SVG mermaid) | File xuất trông giống trên màn hình | `rasterizeSvg`, `exportToHtml.fetchImage` | M | [P2] nợ 2b/2d |
| PlantUML/Graphviz | Thêm loại sơ đồ | cần server hoặc wasm. Server gửi nội dung ra ngoài nên bắt buộc opt-in theo doc | M–L | [Mới] |

## 6. Đề xuất thứ tự làm tiếp

1. **Hardening H1, toàn vẹn dữ liệu** (≤5 file, một phase con): `applyTextChange` trong `core/doc` thay cả 6 chỗ
   thay toàn văn. Autosave không format. Đợi `whenSynced` và so `originHash` trước khi load-file. Lỗi đọc đĩa không
   được thành xung đột. Kèm test hội tụ 2 replica cho từng thao tác. (R1–R4)
2. **H2, định danh và schema**: registry `docId`, mỗi doc một IDB. Gọi `createDoc`/`migrateDoc`, đổi
   `name` thành `title`, ghi `formatVersion`. Chốt quyết định `gc`/snapshot vào DESIGN §2.1/§2.3 kèm fixture
   migration. (R5, phase 6 mục 2/4/5)
3. **H3, đường lưu file thật**: khôi phục handle theo `docId`, nút Mở file, trạng thái lưu nhìn thấy được, diff
   3 chiều có `baseText`. (R6, cộng audit UI "trạng thái lưu")
4. **H4, bảo mật và quyền**: rehype plugin thay cho regex sau sanitize, `clobberPrefix`, thu hẹp WAR/matches, bỏ
   `executeScript` trùng, dọn cache `file_content_*`. (R7–R9)
5. **H5, hiệu năng**: debounce 120ms, tính slides/mindmap lười, cache mermaid, diff có trim + Myers, lazy chunk
   Editor/docx/Deck. (R10)
6. **H6, test thật**: Playwright load-unpacked cho 3 luồng khói. Thay các `toBeDefined` vô nghĩa. Tách "e2e" jsdom
   ra khỏi tên gọi E2E. (R12)
7. **Dọn và tách App**: xoá `patch*.cjs`, `sources.txt`, các setting ma (hoặc nối vào). Tách `App.tsx` thành
   hooks, để `useDocSession` là chỗ cắm provider. (R11, R13)
8. Sau đó mới chạy `brainstorm-intent` / `capture-intent` cho **phase 6**, bắt đầu từ 6a/6b đúng DESIGN.
   Song song có thể làm version timeline cục bộ (6g local-first) vì nó chỉ cần H1+H2.
