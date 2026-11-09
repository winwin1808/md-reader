# Phase 18 — Các luồng vòng đời người dùng

Author: haonq. Status: designed. Phase: 18
Intent: docs/superpowers/intent/2026-11-09-phase-18-vong-doi-nguoi-dung.md

Ship: *cài xong có hướng dẫn; bản lớn báo "Có gì mới" đúng một lần; góp ý được ngay trong Cài đặt; trước khi gỡ lấy được tài liệu ra;
gỡ xong được hỏi lý do và biết dữ liệu của mình đi đâu. Không telemetry.*

## Sub-phase queue

- 18a — Móc vòng đời trong worker — done
- 18b1 — Tài liệu mẫu song ngữ — done
- 18b2 — Trang chào + checklist + mở tab khi cài — done
- 18c1 — Trang "Có gì mới" + tự mở theo cờ — done
- 18c2 — Chấm báo + công tắc + xem lại trong Cài đặt — done
- 18d1 — Lưu góp ý (migration, store, giới hạn, dọn) — done
- 18d2 — Route góp ý + đọc qua admin — done
- 18e — Trang sau gỡ trên `site/` — done
- 18f1 — `FeedbackForm` trong Cài đặt — done
- 18f2 — Nối góp ý vào extension — done
- 18f3 — Lời mời đánh giá — done
- 18g1 — Sao lưu `.zip` — done
- 18g2 — Mục "Trước khi gỡ" — done
- 18h1 — E2E vòng đời — done
- 18h2 — Quyền riêng tư, tài liệu, phiên bản 1.5.0 — planned

## Approach chosen

Quyết định nằm trong một hàm thuần `decideLifecycle`; worker chỉ đọc trạng thái, gọi hàm, rồi thực thi kết quả. Mọi tổ hợp `reason`, cờ và phiên bản
được test mà không cần mock `chrome.*` sâu (§6). Ghi chú phát hành là dữ liệu TypeScript đóng gói trong extension, cờ `showOnUpdate` đặt tay theo từng bản.
Góp ý đi qua endpoint riêng của `apps/api`, không có định danh.

Đã loại:
- **Trang "Có gì mới" trên `site/`:** phải có mạng, và nội dung có thể lệch với bản đang chạy.
- **Suy ra "big update" từ số phiên bản:** người làm sản phẩm đã chọn cờ đặt tay.
- **Form bên thứ ba cho khảo sát gỡ:** đưa dữ liệu người dùng cho thêm một bên, và phải khai thêm trong privacy.
- **Tài liệu mẫu tự tạo khi cài:** làm bẩn danh sách tài liệu của người không cần tới nó.

## Giả định đã chốt (thay cho open questions)

- **Tài liệu mẫu** là tài liệu thường, chỉ tạo khi người dùng bấm "Mở tài liệu mẫu", nhờ vậy dùng được đủ Trình chiếu, Mindmap. Origin cố định theo ngôn ngữ để bấm lại không tạo bản sao.
- **"Có gì mới"** nằm trong app page.
- **Máy chủ góp ý:** luôn là máy chủ mặc định, kể cả khi người dùng cấu hình máy chủ tự dựng (góp ý là về sản phẩm, không về máy chủ của họ). Form ghi rõ điều này. Gửi lỗi → hiện `mailto:qhao.work@gmail.com` với cùng nội dung.
- **Giữ góp ý 180 ngày**, cron tự xoá. Không lưu IP hay băm IP trong bảng góp ý; bộ đếm giới hạn dùng cơ chế `usage_daily` sẵn có (tự xoá sau khoảng 2 ngày).
- **Đọc góp ý:** `GET /api/admin/feedback` với `ADMIN_SECRET`. Không dựng màn hình admin.
- **Ngưỡng xin đánh giá:** ≥ 10 lần mở tài liệu và ≥ 7 ngày từ khi bắt đầu đếm.
- **Thời điểm mở "Có gì mới":** `onStartup` kế tiếp hoặc lần mở app page kế tiếp, tuỳ cái nào tới trước; dù cách nào cũng chỉ một lần.
- **Thư viện zip:** `fflate`, `import()` lười trong app page, không vào chunk chính.
- **Sao lưu chỉ gồm nguồn Markdown.** Ảnh `data:` nằm sẵn trong nguồn nên đi theo; ảnh trên máy chủ hoặc đường dẫn tương đối vẫn là link, và giao diện nói rõ điều này.
- **Firefox:** dùng chung code qua optional chaining, không thêm test. Link đánh giá ẩn ở Firefox. Xem Deferred.
- **Phiên bản phát hành:** `1.5.0`, ghi chú đầu tiên bật `showOnUpdate`. Số `manifest` độc lập với tên mốc "v1.5" trong ROADMAP.

Tên hàm/prop của code có sẵn mà spec không trích được (hàm liệt kê trong `doc-registry`, prop `SettingsModal`, cách route đặt CORS, tên file app page, hằng máy chủ mặc định, `action` trong manifest)
được `plan-from-design` xác nhận bằng `guard` trước khi ghi envelope.

---

## 18a — Móc vòng đời trong worker

Tạo `apps/extension/src/shared/release-notes.ts`, `apps/extension/src/worker/lifecycle.ts`, test `lifecycle.test.ts`; sửa `worker/index.ts`. Đều trong `apps/extension` vì dùng `chrome.*` (§2.4); phần quyết định thuần.

```ts
// shared/release-notes.ts
export interface ReleaseNote {
  version: string            // x.y.z
  showOnUpdate: boolean
  title: { vi: string; en: string }
  items: { vi: string[]; en: string[] }
}
export const RELEASE_NOTES: readonly ReleaseNote[]   // mới nhất trước

// worker/lifecycle.ts
export const LIFECYCLE_KEY = 'mdr:lifecycle'
export interface LifecycleState {
  v: 1
  startedAt: number | null
  lastSeenVersion: string | null
  pendingWhatsNew: string | null
  pendingWelcome: boolean
  autoOpenWhatsNew: boolean
  docOpens: number
  review: 'idle' | 'dismissed' | 'accepted'
}
export type LifecycleEvent =
  | { type: 'installed'; reason: string; previousVersion?: string }
  | { type: 'startup' }
export type TabToOpen = 'welcome' | 'whatsnew'
export function parseLifecycleState(raw: unknown): LifecycleState
export function compareVersions(a: string, b: string): number
export function pendingNote(notes: readonly ReleaseNote[], seen: string | null, current: string): ReleaseNote | null
export function decideLifecycle(
  ev: LifecycleEvent, s: LifecycleState, notes: readonly ReleaseNote[], current: string, now: number,
): { next: LifecycleState; open: TabToOpen[] }
export function uninstallUrl(version: string, uiLang: string): string
// https://winwin1808.github.io/md-reader/uninstall.html?v=<version>&lang=<vi|en>
```

Hành vi:
- `install`: `startedAt = now`, `lastSeenVersion = current`, `pendingWelcome = true`, `open = ['welcome']`.
- `update`: lần đầu có trạng thái thì `lastSeenVersion = previousVersion`, `startedAt = now`. Có `pendingNote` thì `pendingWhatsNew = note.version`; `open = []`. Không có `pendingWelcome`.
- `chrome_update`, `shared_module_update`: `next` không đổi, `open = []`.
- `startup`: `pendingWhatsNew` khác null và `autoOpenWhatsNew` → `open = ['whatsnew']`, xoá pending, `lastSeenVersion = pendingWhatsNew`. `autoOpenWhatsNew` tắt → giữ pending để chấm báo xử lý.
- `pendingNote` lấy mục mới nhất có `showOnUpdate`, `> seen`, `<= current`.
- `onBoot` tách theo sự kiện; luôn gọi `setUninstallURL(uninstallUrl(...))` ở cả hai đường, nên người dùng cũ cũng có. Các handler chạy tuần tự qua một promise chain để hai sự kiện không ghi đè nhau.
- **Tab chưa mở ở phase con này** (18b2, 18c1 mới nối) để không phá e2e giữa chừng.

Lỗi: storage hỏng → `parseLifecycleState` trả mặc định với `pendingWelcome: false` (không mở tab khi không chắc). `setUninstallURL` lỗi → `console.warn`, không chặn `tick`.
Test chứng minh: từng `reason`; `chrome_update` không đổi gì; cờ tắt không pending; bỏ qua nhiều bản vẫn ra mục mới nhất có cờ; `startup` thứ hai không mở lại; so sánh `1.10.0 > 1.9.0`; URL không có gì ngoài `v` và `lang`.

## 18b1 — Tài liệu mẫu song ngữ

Tạo `apps/extension/src/app/welcome-doc.ts` + test.

```ts
export const WELCOME_ORIGIN = { vi: 'mdr://welcome/vi', en: 'mdr://welcome/en' } as const
export function welcomeMarkdown(locale: 'vi' | 'en'): string
```

Nội dung: tiêu đề, bảng, code, alert, công thức, một sơ đồ mermaid, các phần ngăn bằng `---` để bấm Trình chiếu được, đề mục đủ cấp để xem Mindmap. Test: hai ngôn ngữ cùng số đề mục và số `---`; `parseMarkdown` không lỗi; có khối mermaid.

## 18b2 — Trang chào + checklist + mở tab khi cài

Tạo `apps/extension/src/app/WelcomePage.tsx` + test; sửa điểm route app page (`?welcome=1`), `worker/index.ts`, catalog i18n `ext.ts`.

```ts
export interface WelcomeStatus {
  pinned: boolean | null        // null = trình duyệt không cho biết → ẩn bước
  fileAccess: boolean
  openedFile: boolean
  aiConnected: boolean
}
export function WelcomePage(props: { status: WelcomeStatus; onOpenSample(): void; onOpenFileSettings(): void; onDone(): void })
```

Một hành động chính: **Mở tài liệu mẫu**. Checklist phản ánh trạng thái thật: `chrome.action?.getUserSettings()` · `isAllowedFileSchemeAccess` (dùng lại cách của `FileAccessHint`) · registry có tài liệu · bridge có client được duyệt. Kết nối AI ghi "tuỳ chọn". Không giải thích lại quyền. Worker mở `welcome` khi `open` chứa nó và xoá `pendingWelcome`. Fixture e2e đóng tab chào để luồng cũ không đổi. Lỗi đọc trạng thái → bước đó hiện là chưa xong, trang vẫn dùng được.

## 18c1 — Trang "Có gì mới" + tự mở theo cờ

Tạo `apps/extension/src/app/WhatsNewPage.tsx` + test; sửa route (`?whatsnew=1`), `worker/index.ts`, catalog.

```ts
export function WhatsNewPage(props: { notes: readonly ReleaseNote[]; locale: 'vi' | 'en'; highlight: string | null })
export function markWhatsNewSeen(s: LifecycleState, version: string): LifecycleState   // trong lifecycle.ts
```

Liệt kê mọi ghi chú, mục `highlight` ở đầu. Worker mở tab khi `open` chứa `whatsnew`. Mở app page khi còn pending và cờ tự mở đang bật → điều hướng trong app sang trang này rồi `markWhatsNewSeen`, để không có tab thứ hai. Test: hai ngôn ngữ, phân biệt mục nổi bật, đánh dấu đã xem.

## 18c2 — Chấm báo + công tắc + xem lại

Sửa `packages/ui` `SettingsModal` (props mới thuần, không `chrome.*`), catalog, `App.tsx`, thêm test vào file sẵn có.

```ts
interface SettingsLifecycleProps {
  autoOpenWhatsNew: boolean
  onAutoOpenWhatsNewChange(v: boolean): void
  onOpenWhatsNew(): void
  hasUnseenNotes: boolean
}
```

Chấm báo hiện khi có `RELEASE_NOTES` mới hơn `lastSeenVersion`, kể cả bản không bật cờ. Bấm xem xong hết chấm.

## 18d1 — Lưu góp ý

Tạo `apps/api/migrations/0005_feedback.sql`, `apps/api/src/feedback.ts` + test; sửa `limits.ts`, nơi cron dọn dẹp.

```ts
export const FEEDBACK_KINDS = ['uninstall', 'bug', 'idea'] as const
export const UNINSTALL_REASONS = ['not_needed', 'missing_feature', 'bugs', 'hard_to_use', 'privacy', 'switched', 'other'] as const
export const MAX_FEEDBACK_MESSAGE = 2000
export const MAX_FEEDBACK_BODY = 8192
export const FEEDBACK_TTL_MS = 180 * 86_400_000
export interface FeedbackInput {
  kind: (typeof FEEDBACK_KINDS)[number]
  reason: (typeof UNINSTALL_REASONS)[number] | null
  message: string
  email: string | null
  version: string | null
  browser: string | null
  locale: 'vi' | 'en' | null
}
export interface FeedbackRow extends FeedbackInput { id: number; createdAt: number }
export function parseFeedback(body: unknown): FeedbackInput | null
export interface FeedbackStore {
  add(f: FeedbackInput): Promise<void>
  list(opts: { limit: number; before?: number }): Promise<FeedbackRow[]>
  prune(beforeMs: number): Promise<number>
}
export class MemoryFeedbackStore implements FeedbackStore {}
export class D1FeedbackStore implements FeedbackStore {}
```

`LimitKind` thêm `'feedback'`: ≤ 5/ngày theo `ipHash`, ≤ 500/ngày toàn cục, `installHash` luôn `null`. `record` dùng `roomId: '-'`. Bảng không có cột IP hay định danh. `parseFeedback` bác bỏ enum lạ, `uninstall` thiếu `reason`, message rỗng khi `kind` khác `uninstall`, email không có `@` hoặc quá 254; `browser`, `version` cắt 64 ký tự. Cron gọi `prune` theo lô như `CLEANUP_MAX_ROOMS`. Test: validate từng nhánh; giới hạn; prune đúng mốc.

## 18d2 — Route góp ý + đọc qua admin

Sửa `apps/api/src/api.ts` và test API sẵn có.

- `POST /api/feedback`: body > `MAX_FEEDBACK_BODY` → 413; field bẫy `website` khác rỗng → 204 và bỏ qua; JSON hỏng hoặc `parseFeedback` null → 400; hết hạn mức → 429 qua `limited`; thành công → 204.
- CORS cho phép origin `https://winwin1808.github.io` và origin extension.
- `GET /api/admin/feedback?limit=&before=`: `adminAuthorized`, 401 nếu sai, `limit` ≤ 200.
- Không đọc `x-mdr-install`. Test khẳng định có gửi header đó cũng không lưu.

## 18e — Trang sau gỡ trên `site/`

Tạo `site/uninstall.html`, `site/uninstall.js`; sửa `site/style.css`; test `apps/extension/src/shared/uninstall-page.test.ts` đọc file trang.

Nội dung, vi/en theo `?lang=`: (1) xác nhận đã gỡ; (2) **tài liệu trong trình duyệt đã bị xoá cùng extension**; (3) link đã chia sẻ vẫn hoạt động, phòng tự xoá sau 90 ngày không ai mở, muốn xoá sớm thì gửi link tới email liên hệ; (4) form một lựa chọn lý do + ô góp ý + email tuỳ chọn, ghi rõ "chỉ gửi khi bạn bấm Gửi"; (5) link cài lại. Lấy `version` từ `?v=`, cho người dùng thấy nó sẽ được gửi kèm. Gửi lỗi → hiện `mailto:` điền sẵn. Không script ngoài, không cookie, không analytics.

Test chứng minh: giá trị `<option>` khớp `UNINSTALL_REASONS`, không có `<script src="http`, không có `x-mdr-install`, có đủ khối vi và en.

## 18f1 — `FeedbackForm` trong Cài đặt

Tạo `packages/ui/src/.../FeedbackForm.tsx` + test; sửa `SettingsModal`, catalog. Thuần React, không `chrome.*`.

```ts
export interface FeedbackDraft { kind: 'bug' | 'idea'; message: string; email: string }
export function FeedbackForm(props: {
  diagnostics: { version: string; browser: string; locale: string }
  onSubmit(d: FeedbackDraft): Promise<'sent' | 'failed'>
  fallbackMailto(d: FeedbackDraft): string
})
```

Hiện nguyên văn thông tin kèm theo trước khi gửi. Không gửi nội dung tài liệu hay URL. Nhóm Cài đặt "Trợ giúp & góp ý" có link trợ giúp, quyền riêng tư. Test: chặn gửi rỗng, chống bấm hai lần, lỗi hiện mailto.

## 18f2 — Nối góp ý vào extension

Tạo `apps/extension/src/app/feedback-client.ts` + test; sửa `App.tsx`.

```ts
export function sendFeedback(input: FeedbackInput, fetchImpl?: typeof fetch): Promise<'sent' | 'failed'>
export function diagnostics(): { version: string; browser: string; locale: string }
```

`FeedbackInput` do `apps/extension` khai lại kiểu tương ứng, vì không được import từ `apps/api`. Không gửi `x-mdr-install`. `browser` chỉ là tên và số phiên bản chính. 429 và lỗi mạng đều trả `'failed'`. Test khẳng định header và body gửi đi.

## 18f3 — Lời mời đánh giá

Tạo `packages/ui/src/.../ReviewPrompt.tsx` + test; sửa `lifecycle.ts`, `useDocSession` hoặc `App.tsx` để tăng `docOpens`.

```ts
export function shouldAskReview(s: LifecycleState, now: number): boolean   // lifecycle.ts
```

Đúng khi `review === 'idle'`, `docOpens >= 10`, `now - startedAt >= 7 ngày`. Có "Đánh giá" (mở trang store theo ID store, đặt `accepted`) và "Không hỏi nữa" (`dismissed`). Không phân nhánh theo mức độ hài lòng. Ẩn ở Firefox. Bộ đếm không rời máy.

## 18g1 — Sao lưu `.zip`

Tạo `apps/extension/src/app/backup.ts` + test; thêm `fflate` vào `apps/extension/package.json`.

```ts
export interface BackupResult { blob: Blob; included: number; failed: string[] }
export function backupFileNames(titles: string[]): string[]
export function readDocSource(rec: DocRecord): Promise<string>
export function buildBackup(records: DocRecord[], read?: (r: DocRecord) => Promise<string>): Promise<BackupResult>
```

`readDocSource` mở `IndexeddbPersistence` trên một `Y.Doc({ gc: false })` tạm, chờ `whenSynced`, đọc `getSource`, rồi `destroy`. **Chỉ đọc**: không `ensureDoc`, không `storeState`, nên không ghi gì và đọc được cả tài liệu `formatVersion` mới hơn. `backupFileNames` bỏ ký tự đường dẫn và điều khiển, chống `..`, tên rỗng thành `Untitled`, trùng tên (không phân biệt hoa thường) thêm ` (2)`. Tài liệu đọc lỗi không làm hỏng cả gói: ghi vào `failed` và tệp `_backup-errors.txt`. Test: trùng tên, tên độc hại, một tài liệu lỗi, nội dung giải nén khớp, `data:` còn nguyên, và Y.Doc không đổi state sau khi đọc.

## 18g2 — Mục "Trước khi gỡ"

Sửa `SettingsModal` (prop thuần), `App.tsx`, catalog; thêm test vào file sẵn có.

```ts
interface SettingsBackupProps {
  onBackupAll(): Promise<{ included: number; failed: number }>
  sharedDocs: Array<{ docId: string; title: string }>
  onOpenSharedDoc(docId: string): void
}
```

Nêu rõ gỡ sẽ xoá tài liệu trong trình duyệt. Nút "Sao lưu tất cả (.zip)" tải bằng `a[download]`, không thêm quyền `downloads`. Danh sách tài liệu đã chia sẻ, mỗi mục mở đúng tài liệu để dùng nút "Xoá dữ liệu trên máy chủ" sẵn có; không thêm xoá hàng loạt. Báo số tài liệu đã sao lưu và số lỗi.

## 18h1 — E2E vòng đời

Thêm một luồng Playwright: load-unpacked → tab chào mở đúng một lần → mở tài liệu mẫu → khởi động lại context không mở thêm tab. Kiểm `setUninstallURL` đã gọi nếu quan sát được từ worker; không thì ghi lại là kiểm thủ công.

## 18h2 — Quyền riêng tư, tài liệu, phiên bản

Sửa `docs/store/privacy-policy.md`, `site/privacy.html`, `docs/ROADMAP.md`, `docs/ROADMAP.en.md`, `apps/extension/public/manifest.json` + `release-notes.ts`. Nêu góp ý tự nguyện, các trường, giữ 180 ngày, không định danh bản cài. Giữ "không phân tích, không theo dõi". Thứ tự phát hành ghi vào handover: **chạy migration 0005 và deploy Worker → merge để `site/` lên Pages → mới nộp 1.5.0**, nếu không URL gỡ sẽ trỏ vào trang chưa có. Form Data usage trên store do người làm kiểm lại. Không chạm `docs/store/listing.md`.

## Deferred

- Tài khoản, email vòng đời, thanh toán, nâng cấp/huỷ gói, win-back → Lề sách Cloud (repo private).
- Phễu định lượng → không làm khi còn cam kết không theo dõi.
- Kiểm thử luồng trên Firefox, link đánh giá AMO → khi phát hành Firefox AMO.
- Xoá dữ liệu máy chủ hàng loạt.
- Màn hình admin đọc góp ý.
