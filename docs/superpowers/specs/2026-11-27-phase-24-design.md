# Phase 24 — Đa ngôn ngữ (vi · en · it · fr · de)
Author: winwin1808. Status: shipped. Phase: 24

Intent: `docs/superpowers/intent/2026-11-27-phase-24-da-ngon-ngu.md`

Branch `phase-24` xếp chồng trên `fix-open-file-validation` (commit `ff040200`, sửa mở file sai định dạng).
MR cuối phase: `phase-24` → `main` mang theo commit đó.

## Approach chosen

**Giữ hệ `createT`/catalog hiện có, thêm 3 catalog nạp lười theo locale; vi + en vẫn nạp sẵn.**

- Loại *gộp cả 5 catalog vào bundle chính*: mỗi ngôn ngữ ~590 khoá ≈ 15 KB gz, ba ngôn ngữ ≈ 45 KB gz vào
  `app.js` và web — vượt trần 25 KB của intent, trong khi mỗi người chỉ dùng một ngôn ngữ.
- Loại *thư viện i18n (i18next, FormatJS)*: intent cấm; `format()` hiện có đủ cho `{x}` và số nhiều 2 dạng
  (it/fr/de đều có 2 dạng số nhiều như en).
- Loại *dùng `chrome.i18n` cho toàn bộ giao diện*: không đổi được ngôn ngữ trong Cài đặt, và `packages/ui`
  không được dùng `chrome.*`. `chrome.i18n` chỉ dùng cho `_locales` (tên/mô tả extension).

## Quyết định (giải open questions của intent)

1. **Nạp catalog:** `loadLocale(locale)` nạp động `locales/<l>/index.ts` một lần. `LocaleRoot` (extension) và
   `main.tsx` (web) chờ nạp xong rồi mới đổi sang locale mới; trong lúc chờ giữ locale cũ (lần đầu: chưa render,
   chunk cục bộ nên chỉ vài ms).
2. **Thứ tự rơi khoá:** `locale → en → vi → key`. Khoá thiếu ở it/fr/de hiện tiếng Anh.
3. **Quy tắc `auto`:** duyệt `navigator.languages` theo thứ tự; lấy mã chính (`fr-CA` → `fr`); khoá đầu tiên
   thuộc `SUPPORTED_LOCALES` thắng; không khớp → `en`. Ví dụ `['fr-CA','vi']` → fr, `['es','de']` → de, `['ja']` → en.
4. **Tài liệu mẫu (trang chào):** dịch đủ it/fr/de — đó là thứ người mới thấy đầu tiên.
   **Release notes:** kiểu đổi thành `{ vi; en } & Partial<Record<'it'|'fr'|'de', …>>`; các bản cũ rơi về en;
   bản 1.7.0 có đủ 5 ngôn ngữ.
5. **Alert GitHub:** bảng tiêu đề 5 ngôn ngữ nằm trong core (25 chuỗi, không phụ thuộc ui). Cài đặt
   `localizeAlerts` giữ là boolean (không đổi storage): bật → tiêu đề theo ngôn ngữ giao diện; tắt → tiếng Anh
   như GitHub. Đổi nhãn cài đặt cho đúng nghĩa mới.
6. **Dữ liệu đã lưu bằng tiếng Việt** (`'Bạn'` trong `meta.actors`/history, nhãn `'Khôi phục: '`,
   `'AI: cập nhật'`, tiêu đề mặc định `'Untitled'`): **không đổi** trong phase này — đổi chuỗi đã lưu cần kế
   hoạch tương thích với client cũ và phòng chia sẻ. Ghi vào Deferred.
7. **Bộ chọn ngôn ngữ:** đổi từ nhóm nút sang `<select>` 6 mục (Tự động + 5 tên bản địa) để không tràn hàng.
8. Phiên bản: extension **1.7.0**. Không đổi schema Y.Doc, không đổi giao thức MCP, không migration D1.

## Interfaces dùng chung (tên chốt, các phase con dùng nguyên văn)

```ts
// packages/ui/src/i18n/types.ts
export type Locale = 'vi' | 'en' | 'it' | 'fr' | 'de'
export type LocalePref = 'auto' | Locale
export const SUPPORTED_LOCALES: readonly Locale[]            // ['vi','en','it','fr','de']
export const LOCALE_NAMES: Record<Locale, string>            // 'Tiếng Việt','English','Italiano','Français','Deutsch'
export function isLocale(v: unknown): v is Locale
export function localeTag(l: Locale): string                 // vi-VN en-US it-IT fr-FR de-DE

// packages/ui/src/i18n/resolve.ts
export function resolveLocale(pref: LocalePref | undefined, navigatorLanguages: readonly string[] | undefined): Locale

// packages/ui/src/i18n/translate.ts
export function createT(locale: Locale): TFunction            // locale → en → vi → key
export function loadLocale(locale: Locale): Promise<void>     // idempotent; vi/en resolve ngay
export function isLocaleLoaded(locale: Locale): boolean
export type PartialMessages = Partial<Messages>

// packages/ui/src/i18n/locales/{it,fr,de}/index.ts
declare const messages: PartialMessages; export default messages   // gộp các file vùng

// packages/core/src/render/plugins.ts
export type AlertLocale = 'vi' | 'en' | 'it' | 'fr' | 'de'
export function alertLocale(code: string | undefined): AlertLocale   // mã chính, không khớp → 'en'
export function rehypeGithubAlerts(options: { locale: string }): …   // nhận mã bất kỳ, qua alertLocale
// RenderOptions.localizeAlerts?: string  (mã locale; undefined → en)

// apps/extension/src/content/strings.ts
export type ContentLocale = 'vi' | 'en' | 'it' | 'fr' | 'de'
export function resolveContentLocale(pref: unknown, langs: readonly string[] | undefined): ContentLocale  // cùng quy tắc với resolveLocale
```

Catalog dịch: `packages/ui/src/i18n/locales/<l>/<area>.ts` với `<area>` ∈ common, settings, present, live,
shell, ext, web; mỗi file `export const <l>: PartialMessages = { … }` chỉ chứa khoá của vùng đó (khớp
`catalog/<area>.ts`). `locales/<l>/index.ts` gộp các vùng đã có.

## Invariants (chép vào envelope builder)

- `packages/ui` không `chrome.*`; `packages/core` không react/`document`; import chéo package bằng tên workspace.
- Content script không import `@md-reader/ui`; content.js ≤ 60 KB gz.
- Không thêm dependency. Không đổi schema Y.Doc, không đổi chuỗi đã lưu vào Y.Doc.
- Bản dịch: giữ nguyên placeholder `{name}` và dạng số nhiều `{count|a|b}`, giữ tên riêng (LeSach, MD Reader,
  Markdown, MCP, Claude, Cursor, PDF, Word, HTML), phím tắt, emoji, ký tự `…`/`—` như bản en; giọng ngắn,
  tự nhiên, xưng hô lịch sự chuẩn giao diện phần mềm (it: tu-form ngắn như app phổ biến; fr: vous; de: Sie).
- Fallback khoá: locale → en → vi.

## Sub-phase queue

| # | Phase con | Status |
|---|---|---|
| 24a1 | ui: nền locale 5 ngôn ngữ | done |
| 24a2 | gắn locale: extension + web + bộ chọn | done |
| 24b1 | ui: ngày/số theo locale + `lang` + Untitled | done |
| 24b2 | extension: chuỗi cứng app page vào catalog | done |
| 24b3 | core: alert 5 ngôn ngữ | done |
| 24b4 | extension: chuỗi `localizeAlerts` theo locale | done |
| 24c | content script 5 ngôn ngữ | done |
| 24d | `_locales` it/fr/de + feedback locale | done |
| 24e1 | trang chào it/fr/de | done |
| 24e2 | "Có gì mới" + lifecycle 5 ngôn ngữ | done |
| 24f1 | it: common/settings/present/live | done |
| 24f2 | it: shell | done |
| 24f3 | it: ext/web | done |
| 24g1 | fr: common/settings/present/live | done |
| 24g2 | fr: shell | done |
| 24g3 | fr: ext/web | done |
| 24h1 | de: common/settings/present/live | done |
| 24h2 | de: shell | done |
| 24h3 | de: ext/web | done |
| 24i1 | khoá đủ khoá + placeholder | done |
| 24i2 | phiên bản 1.7.0 + ghi chú phát hành | done |

Song song: sau 24b2 (mọi khoá mới đã vào catalog vi/en), ba làn **24f\*, 24g\*, 24h\*** chạy song song (file
rời nhau theo ngôn ngữ), trong mỗi làn tuần tự 1→2→3 (chung `index.ts`). 24b3→24b4 tuần tự. 24c, 24d, 24e1,
24e2 độc lập với các làn dịch.

## Thiết kế từng phase con

### 24a1 — ui: nền locale 5 ngôn ngữ
- **Files:** `packages/ui/src/i18n/types.ts`, `resolve.ts`, `translate.ts`, `index.ts` (export thêm),
  `locales/{it,fr,de}/index.ts` (stub `export default {} as PartialMessages` — 3 file một dòng, không tính vào
  trần 5 file), test trong `i18n.test.tsx` (sẵn có).
- **Xây:** các interface ở trên. `catalogs` thành `Partial<Record<Locale, PartialMessages>>` với vi, en sẵn.
  `loadLocale` dùng bảng `{ it: () => import('./locales/it'), fr: …, de: … }`, ghi vào `catalogs`, nhớ promise
  để không nạp hai lần; lỗi nạp → log + coi như đã nạp (rơi về en), không throw.
- **Test:** `resolveLocale` (pref hợp lệ; `['fr-CA','vi']`→fr; `['es','de']`→de; `['ja']`→en; rỗng→en; pref lạ→auto);
  `createT('it')` trước nạp → en; sau `loadLocale('it')` với catalog giả → chữ it, khoá thiếu → en;
  `localeTag`; `isLocale`.

### 24a2 — gắn locale: extension + web + bộ chọn
- **Files:** `apps/extension/src/app/LocaleRoot.tsx`, `apps/web/src/main.tsx`, `apps/web/index.html`
  (`lang` thật đặt lúc chạy), `packages/ui/src/components/SettingsModal.tsx`, test `LocaleRoot.test.tsx` (mới).
- **Xây:** `asPref` dùng `isLocale`. LocaleRoot: tính locale → `await loadLocale` → mới set locale hiển thị;
  render `null` cho tới lần nạp đầu xong. `webLocale` nhận `?lang=` thuộc 5 mã; `main.tsx` `await loadLocale`
  trước `render`, đặt `document.documentElement.lang`. SettingsModal: `uiLanguage?: LocalePref`; `<select>`
  6 mục, nhãn `t('settings.lang.auto')` + `LOCALE_NAMES`.
- **Test:** LocaleRoot với `navigator.languages=['de-DE']` + catalog de giả hiển thị chữ de; đổi
  `uiLanguage` qua storage → đổi ngôn ngữ; SettingsModal chọn `fr` gọi `onChange('uiLanguage','fr')`.

### 24b1 — ui: ngày/số theo locale + `lang` + Untitled
- **Files:** `HistoryTimeline.tsx`, `WordCountBar.tsx`, `TopToolbar.tsx`, `live/index.ts`, `catalog/shell.ts`.
- **Xây:** mọi `locale === 'vi' ? 'vi-VN' : 'en-US'` → `localeTag(locale)`. `TopToolbar` `'Untitled'` →
  `t('shell.untitled')` (khoá mới, vi "Tài liệu không tên", en "Untitled"). Live preview: `lang` của
  contentAttributes lấy từ tham số locale (mặc định `'vi'` giữ hành vi cũ khi không truyền); bên gọi trong ui
  truyền `useLocale()`.
- **Test:** HistoryTimeline với locale `de` định dạng `de-DE`; WordCountBar `fr` dùng dấu cách nghìn kiểu fr.

### 24b2 — extension: chuỗi cứng app page vào catalog
- **Files:** `apps/extension/src/app/hooks/useDocSession.ts`, `App.tsx`, `hooks/useExport.ts`,
  `packages/ui/src/i18n/catalog/ext.ts`, test trong `useDocSession` test sẵn có.
- **Xây:** 4 chỗ `Cannot read file…` → `t('ext.session.fileAccess', { url })`; `App.tsx:616` → `localeTag`;
  `setImageNotice('Đoạn đã chọn đã thay đổi — chọn lại.')` → `t('ext.app.selectionChanged')`;
  export HTML truyền `lang: locale` (core `html.ts` đã có tham số `lang`).
- **Test:** lỗi đọc file URL với locale en ra chuỗi en mới; vi ra chuỗi vi.

### 24b3 — core: alert 5 ngôn ngữ
- **Files:** `packages/core/src/render/plugins.ts`, `render.ts`, `types.ts`, test plugins sẵn có.
- **Xây:** `ALERT_TITLES: Record<AlertLocale, Record<'note'|'tip'|'important'|'warning'|'caution', string>>`
  (it: Nota/Suggerimento/Importante/Avviso/Attenzione; fr: Remarque/Astuce/Important/Avertissement/Attention;
  de: Hinweis/Tipp/Wichtig/Warnung/Vorsicht; vi/en giữ nguyên). `render.ts` truyền thẳng `localizeAlerts`.
- **Test:** `localizeAlerts:'fr-FR'` → "Remarque"; `'ja'` → "Note"; undefined → "Note"; `'vi'` không đổi so với trước.

### 24b4 — extension: chuỗi `localizeAlerts` theo locale
- **Files:** `content/index.ts`, `content/render.ts`, `worker/render-md.ts`, `worker/index.ts`, `app/App.tsx`
  (+ nhãn cài đặt trong `catalog/settings.ts` nếu vượt 5 file thì gộp vào 24b2 — builder không tự mở rộng).
- **Xây:** `alertLang` thành `string` (locale đã resolve) khi `localizeAlerts` bật, `'en'` khi tắt; worker
  chuyển thẳng xuống core. Content script dùng `resolveContentLocale`.
- **Test:** `renderMarkdownForPage(md, { alertLang: 'de' })` có "Hinweis".

### 24c — content script 5 ngôn ngữ
- **Files:** `content/strings.ts`, `content/ContentApp.tsx`, `content/content.css`, test `strings.test.ts`.
- **Xây:** `CONTENT_STRINGS` thêm it/fr/de (8 khoá); `resolveContentLocale` theo quy tắc mục Quyết định 3;
  CSS pseudo-text công thức/mermaid thêm biến thể `.doc[lang="it|fr|de"]`. Ngân sách content.js đo lại.
- **Test:** bảng đủ 8 khoá cho 5 ngôn ngữ; quy tắc resolve giống `resolveLocale` trên cùng bộ ví dụ.

### 24d — `_locales` it/fr/de + feedback locale
- **Files:** `public/_locales/{it,fr,de}/messages.json`, `app/feedback-client.ts`, `apps/api/src/feedback.ts`.
- **Xây:** 3 message (`extName` giữ "LeSach – " + phần mô tả dịch, `extDescription` ≤ 132 ký tự, `actionTitle`).
  Feedback gửi locale thật trong 5 mã; api nhận 5 mã, lạ → null. `default_locale` giữ `vi`.
- **Test:** test api feedback sẵn có thêm ca `'de'` lưu `de`, `'xx'` lưu null; test JSON đủ khoá + độ dài mô tả.

### 24e1 — trang chào it/fr/de
- **Files:** `app/welcome-doc.ts`, `app/welcome/{it,fr,de}.ts` (mới, mỗi file một chuỗi Markdown dịch từ EN),
  `app/WelcomeRoute.tsx`.
- **Xây:** `welcomeMarkdown(locale: Locale)`, `WELCOME_ORIGIN` đủ 5; tiêu đề trang chào qua catalog
  (`ext.welcome.docTitle`) thay cho nhánh vi/en.
- **Test:** test welcome sẵn có: mỗi locale trả markdown bắt đầu bằng H1 đúng ngôn ngữ, giữ mọi đường dẫn/ảnh như EN.

### 24e2 — "Có gì mới" + lifecycle 5 ngôn ngữ
- **Files:** `shared/release-notes.ts`, `app/WhatsNewRoute.tsx`, `app/WhatsNewPage.tsx`, `worker/lifecycle.ts`.
- **Xây:** kiểu notes như Quyết định 4; trang chọn `n.title[locale] ?? n.title.en`; lifecycle dùng quy tắc
  resolve chung (bản duplicate nhỏ như content script vì worker không import ui).
- **Test:** WhatsNewPage locale `it` với note chỉ có vi/en hiện en.

### 24f1..24h3 — bản dịch (9 phase con, ba làn song song)
- **Files mỗi phase con:** `locales/<l>/{common,settings,present,live}.ts` + `index.ts` (phần 1);
  `locales/<l>/shell.ts` + `index.ts` (phần 2); `locales/<l>/{ext,web}.ts` + `index.ts` (phần 3).
- **Nguồn:** dịch từ `catalog/<area>.ts` bản `en` (đối chiếu `vi` khi en mơ hồ), đúng tập khoá của vùng.
- **Test:** không file test mới. Kiểm bằng `pnpm --filter ui typecheck` (kiểu `PartialMessages` bắt khoá sai
  tên) + script `scripts/i18n-keys.mjs <l> <area…>` (tạo ở 24f1, dùng lại cho mọi làn) in số khoá thiếu/thừa
  so với `catalog/<area>.ts` — phải là 0/0.

### 24i1 — khoá đủ khoá + placeholder
- **Files:** `packages/ui/src/i18n/locales/{it,fr,de}/index.ts` (kiểu `Messages` thay `PartialMessages`),
  test mới `i18n/catalog-parity.test.ts`.
- **Test:** mỗi locale có đủ mọi khoá của `vi`, không chuỗi rỗng, tập placeholder `{x}` và số dạng `{a|b|c}`
  khớp bản en; chuỗi it/fr/de không trùng nguyên văn en quá 15% số khoá (bắt quên dịch; trừ khoá chỉ là tên riêng).

### 24i2 — phiên bản 1.7.0 + ghi chú phát hành
- **Files:** `apps/extension/public/manifest.json`, `apps/extension/package.json`, `shared/release-notes.ts`
  (mục 1.7.0 đủ 5 ngôn ngữ), `site/changelog.html` (mục 1.7.0 vi/en — test release-notes yêu cầu), `docs/ROADMAP.md`.

## Deferred to phase sau

- Chuỗi đã lưu trong Y.Doc bằng tiếng Việt (`'Bạn'`, `'Khôi phục: '`, `'AI: cập nhật'`, `'Untitled'`) — cần
  khoá ổn định + hiển thị theo locale, tương thích client cũ.
- Trang `site/` (landing, changelog, uninstall) và listing store cho it/fr/de.
- Chuỗi CLI `le-sach-mcp`.
