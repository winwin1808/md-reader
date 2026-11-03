# Phase 17 — Hướng dẫn dùng AI + bản Chrome Web Store

Author: haonq. Status: shipped. Phase: 17
Intent: docs/superpowers/intent/2026-11-03-phase-17-huong-dan-ai.md

Ship: *người cài MD Reader từ Chrome Web Store bật Kết nối AI, làm theo hướng dẫn ngay trong mục cài đặt, và ghép cặp được với
Claude Code / Claude Desktop / Cursor mà không phải điền ID hay token.*

## Sub-phase queue

- 17a — ID store + phiên bản MCP — done
- 17b — Hướng dẫn trong mục Kết nối AI — done
- 17c1 — README + site trỏ store — done
- 17c2 — Docs MCP + email liên hệ privacy — done
- 17d — Tên extension "LeSach – Markdown Reader & AI Editor" (chỉ `extName`, thêm theo yêu cầu người dùng) — done

## Approach chosen

Hướng dẫn là một component React thuần trong `packages/ui`, gắn vào phần `aiBridge` sẵn có của `SettingsModal`. Chuỗi lệnh/JSON sinh từ một
hằng duy nhất `MCP_PACKAGE_SPEC` ở `@md-reader/core`, và test ở `packages/mcp` buộc hằng đó khớp `package.json` + `VERSION`. Nhờ vậy số
phiên bản không lệch như lần này (`VERSION = '1.3.0'` trong khi `package.json` là `1.3.1`).

Đã loại:
- **Trang/modal onboarding riêng:** thêm route và file, mà người dùng lại phải tìm. Họ đã ở đúng mục Kết nối AI khi bật công tắc.
- **Tải `docs/MCP.md` từ GitHub rồi render:** cần mạng, chịu CSP, và docs có thể lệch phiên bản extension. Chỉ để một link "Xem hướng dẫn đầy đủ".
- **Viết cứng lệnh vào i18n:** mỗi lần phát hành MCP phải sửa 6 chuỗi ở 2 ngôn ngữ, đúng kiểu lệch vừa gặp.

Không cần sửa `apps/extension`: prop `aiBridge` đã có `enabled` và `clients`.

## Giả định đã chốt (thay cho open questions)

- Câu lệnh mẫu: bốn câu, mỗi câu ứng với một nhóm tool (publish · list · get+update · share). Nội dung nằm ở 17b.
- Link "hướng dẫn đầy đủ": `https://github.com/winwin1808/md-reader/blob/main/docs/MCP.md` (vi) và `…/docs/MCP.en.md` (en). Mở bằng `<a target="_blank" rel="noopener noreferrer">`.
- Firefox (`moz-extension://<uuid>`, mỗi máy một uuid) nằm ngoài phạm vi, xem Deferred.
- Bản vá MCP là `1.3.2`. Người dùng tự `npm publish` (OTP) sau khi merge. Trước lúc đó, snippet `@1.3.2` trong extension trỏ tới bản chưa có trên npm,
  nên **thứ tự phát hành bắt buộc**: publish `le-sach-mcp@1.3.2` → rồi mới nộp bản extension chứa 17b lên store. Ghi vào handover.

---

## 17a — ID store + phiên bản MCP

**Package:** `packages/core` (hằng thuần TS, §2.4 OK) và `packages/mcp`.

**Files (5):** `packages/core/src/bridge/protocol.ts` · `packages/core/src/bridge/protocol.test.ts` · `packages/mcp/package.json` ·
`packages/mcp/src/cli.ts` · `packages/mcp/src/cli.test.ts`. Không có test file mới.

**Sinh ra:**

```ts
// packages/core/src/bridge/protocol.ts
export const STORE_EXTENSION_ID = 'eolclccibhickmpbpbdodbhopnddcdog'
export const DEV_EXTENSION_ID = 'ojcemoafaibjfghljkbagnkbgljakbji'
export const KNOWN_EXTENSION_IDS: readonly string[] = [STORE_EXTENSION_ID, DEV_EXTENSION_ID]
export const MCP_PACKAGE_SPEC = 'le-sach-mcp@1.3.2'
```

Hai ID là xuất hiện duy nhất trong mã nguồn. Bỏ comment `// ID store thêm ở 10o`.

```ts
// packages/mcp/src/cli.ts
export const VERSION = '1.3.2'
```

`packages/mcp/package.json` → `"version": "1.3.2"`.

**Test phải chứng minh:**
- `protocol.test.ts` / `isAllowedExtensionOrigin`: chấp nhận `chrome-extension://eolclccibhickmpbpbdodbhopnddcdog` và
  `chrome-extension://ojcemoafaibjfghljkbagnkbgljakbji`; từ chối `moz-extension://eolclccibhickmpbpbdodbhopnddcdog`, ID store thêm hậu tố `/`, và chữ hoa.
- `cli.test.ts`: `VERSION === package.json.version` (đọc `../package.json` bằng `fs`) và `MCP_PACKAGE_SPEC === \`le-sach-mcp@${VERSION}\``
  (import từ `@md-reader/core/bridge`, subpath mcp đang dùng). Test này đỏ trên mã cũ (`1.3.0` ≠ `1.3.1`).

**Lỗi:** không có đường chạy mới. `MDR_EXTENSION_ID` vẫn ghi đè như cũ.

## 17b — Hướng dẫn trong mục Kết nối AI

**Package:** `packages/ui`. Không `chrome.*`; sao chép bằng `navigator.clipboard.writeText` (đã dùng ở `Viewer.tsx`, `ExcalidrawBlock.tsx`).

**Files (5):** `packages/ui/src/components/AiSetupGuide.tsx` (mới) · `packages/ui/src/components/AiSetupGuide.test.tsx` (test file mới duy nhất) ·
`packages/ui/src/components/SettingsModal.tsx` · `packages/ui/src/i18n/catalog/settings.ts` · `packages/ui/src/theme/settings.css`.

**Tiêu thụ:** `MCP_PACKAGE_SPEC` từ `@md-reader/core` (root đã `export * from './bridge/protocol.js'`).

**Sinh ra:**

```ts
export type AiClientKind = 'claudeCode' | 'claudeDesktop' | 'cursor'
export function mcpSetupSnippet(kind: AiClientKind): string
export interface AiSetupGuideProps { hasClients: boolean }
export function AiSetupGuide(props: AiSetupGuideProps): JSX.Element
```

`mcpSetupSnippet`:
- `claudeCode` → `claude mcp add md-reader -- npx -y ${MCP_PACKAGE_SPEC}`
- `claudeDesktop`, `cursor` → `JSON.stringify({ mcpServers: { 'md-reader': { command: 'npx', args: ['-y', MCP_PACKAGE_SPEC] } } }, null, 2)`

**Gắn vào `SettingsModal`:** trong khối `props.aiBridge`, ngay dưới hàng công tắc, chỉ khi `props.aiBridge.enabled`:
`<AiSetupGuide hasClients={props.aiBridge.clients.length > 0} />`. Tắt công tắc thì hướng dẫn biến mất.

**Cấu trúc:** `<details className="ai-guide" open={!hasClients}>` + `<summary>` = `settings.ai.guide.title`. `const [open, setOpen] = useState(!hasClients)`;
`<details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>`. Giá trị ban đầu lấy lúc mount; danh sách client đổi trong lúc mở không làm hướng dẫn tự gập.
Thân là `<ol>` gồm 3 bước:

1. `settings.ai.guide.step1` + hàng tab `role="tablist"`, 3 nút `role="tab"` có `aria-selected` và `aria-controls`, nhãn là tên riêng
   không dịch: "Claude Code", "Claude Desktop", "Cursor". Mặc định chọn `claudeCode`; ←/→ chuyển tab. Panel `role="tabpanel"` gồm:
   gợi ý vị trí (`settings.ai.guide.where.<kind>`), `<pre><code>` chứa `mcpSetupSnippet(kind)`, nút `common.copy`.
   Bấm thì `navigator.clipboard.writeText(snippet)`. Thành công: nhãn nút thành `settings.ai.guide.copied` trong 2000 ms. Lỗi hoặc
   không có `navigator.clipboard`: hiện `settings.ai.guide.copyFailed`, đoạn mã vẫn chọn được bằng tay (`user-select: all` trên `<code>`).
   Dưới panel: `settings.ai.guide.node`.
2. `settings.ai.guide.step2`.
3. `settings.ai.guide.step3` + `<ul>` 4 câu `settings.ai.guide.ex1..ex4`, rồi link `settings.ai.guide.more` tới docs theo ngôn ngữ
   (`settings.ai.guide.moreHref`).

**Khoá i18n (vi / en):**

| Khoá | vi | en |
|---|---|---|
| `settings.ai.guide.title` | Cách dùng với AI | How to use with AI |
| `settings.ai.guide.step1` | Thêm MD Reader vào ứng dụng AI của bạn: | Add MD Reader to your AI app: |
| `settings.ai.guide.where.claudeCode` | Chạy lệnh này trong terminal: | Run this in a terminal: |
| `settings.ai.guide.where.claudeDesktop` | Settings → Developer → Edit Config, thêm vào `claude_desktop_config.json`: | Settings → Developer → Edit Config, add to `claude_desktop_config.json`: |
| `settings.ai.guide.where.cursor` | Thêm vào `~/.cursor/mcp.json` (hoặc `.cursor/mcp.json` trong dự án): | Add to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project): |
| `settings.ai.guide.node` | Cần Node.js 20 trở lên. | Requires Node.js 20 or later. |
| `settings.ai.guide.copied` | Đã chép | Copied |
| `settings.ai.guide.copyFailed` | Không chép được — hãy chọn đoạn mã và chép tay. | Couldn't copy — select the snippet and copy it manually. |
| `settings.ai.guide.step2` | Khởi động lại ứng dụng AI. Trong 10 phút, MD Reader hiện hộp ghép cặp có mã nhận dạng dạng ABCD-1234 — kiểm mã khớp với dòng "đã ghép cặp" trong log của ứng dụng AI rồi bấm Cho phép. | Restart the AI app. Within 10 minutes MD Reader shows a pairing box with an identifier like ABCD-1234 — check it matches the "paired" line in the AI app's log, then click Allow. |
| `settings.ai.guide.step3` | Nhờ AI bằng lời thường, ví dụ: | Ask the AI in plain words, for example: |
| `settings.ai.guide.ex1` | "Đưa bản tóm tắt này vào MD Reader với tiêu đề Họp tuần." | "Put this summary into MD Reader titled Weekly sync." |
| `settings.ai.guide.ex2` | "Trong MD Reader đang có những tài liệu nào?" | "What documents are in MD Reader?" |
| `settings.ai.guide.ex3` | "Mở tài liệu Họp tuần trong MD Reader, sửa lỗi chính tả rồi cập nhật lại." | "Open Weekly sync in MD Reader, fix the typos and update it." |
| `settings.ai.guide.ex4` | "Tạo link xem 7 ngày cho tài liệu Họp tuần." (MD Reader luôn hỏi bạn trước khi tạo hay thu hồi link.) | "Create a 7-day view link for Weekly sync." (MD Reader always asks you before creating or revoking a link.) |
| `settings.ai.guide.more` | Xem hướng dẫn đầy đủ | Full guide |
| `settings.ai.guide.moreHref` | https://github.com/winwin1808/md-reader/blob/main/docs/MCP.md | https://github.com/winwin1808/md-reader/blob/main/docs/MCP.en.md |
| `settings.ai.guide.tabs` | Ứng dụng AI | AI app |

`settings.ai.guide.tabs` là `aria-label` của tablist. Không thêm khoá cho tên ứng dụng.

**CSS (`settings.css`):** `.ai-guide`, `.ai-guide-tabs`, `.ai-guide-tab[aria-selected="true"]`, `.ai-guide-code` (`white-space: pre`,
`overflow-x: auto`, `user-select: all`, font mono theo token). Chỉ dùng token Lề sách sẵn có (`--surface --ink --pencil --rule --accent`),
không thêm màu mới.

**Test phải chứng minh (`AiSetupGuide.test.tsx`):**
- `mcpSetupSnippet('claudeCode')` chứa đúng `MCP_PACKAGE_SPEC`; JSON của `claudeDesktop`/`cursor` parse được và `args[1] === MCP_PACKAGE_SPEC`.
- `hasClients=false` → `<details>` mở; `true` → đóng.
- Bấm tab Cursor → `aria-selected` chuyển, panel hiện JSON; →/← chuyển tab.
- Bấm Sao chép → `navigator.clipboard.writeText` được gọi với snippet của tab đang chọn, nhãn thành "Đã chép"; `writeText` reject → hiện `copyFailed`.
- `SettingsModal` với `aiBridge.enabled=false` không render hướng dẫn; `enabled=true` có render (đặt trong cùng file test).
- Bất biến cũ giữ nguyên: test `i18n.test.tsx` (en đủ khoá vi, placeholder khớp) và `PairDialog.test.tsx` "SettingsModal AI section" vẫn xanh.

**Lỗi:** chỉ có lỗi clipboard, xử lý như trên. Component không gọi mạng.

## 17c1 — README + site trỏ store

**Files (3):** `README.md` · `README.vi.md` · `site/index.html`. Chỉ docs, không test. Kiểm bằng `grep`.

- Link store: `https://chromewebstore.google.com/detail/md-reader/eolclccibhickmpbpbdodbhopnddcdog`.
- README: bảng nền tảng, hàng Chrome ghi "Cài từ Chrome Web Store (link) hoặc từ mã nguồn". Hàng "Chrome Web Store / Edge Add-ons / Firefox AMO"
  tách thành hàng Chrome Web Store **Có** và hàng Edge Add-ons / Firefox AMO giữ **Đang làm**. Mục "From the Chrome Web Store" /
  "Từ Chrome Web Store" thay "Coming soon" bằng link + một dòng "bật Kết nối AI trong Cài đặt để dùng với Claude/Cursor — xem docs/MCP".
- `site/index.html:49`: `<span class="btn soon" aria-disabled="true">…</span>` thành `<a class="btn main" href="<link store>">Chrome Web Store</a>`,
  đặt **đầu tiên** trong `.cta`. Nút "Cài từ mã nguồn" bỏ class `main`. Nếu class `.soon` không còn chỗ dùng thì xoá rule CSS của nó trong file.
- Kiểm: `grep -n "Coming soon\|Sắp có\|being prepared\|đang chuẩn bị" README.md README.vi.md site/index.html` → rỗng; `grep -c eolclccibhickmpbpbdodbhopnddcdog` mỗi file ≥ 1.

## 17c2 — Docs MCP + email liên hệ privacy

**Files (5):** `docs/MCP.md` · `docs/MCP.en.md` · `packages/mcp/README.md` · `docs/store/privacy-policy.md` · `site/privacy.html`. Chỉ docs.

- `1.3.1` → `1.3.2` ở mọi chỗ trong `docs/MCP.md`, `docs/MCP.en.md` (dòng 15, 18, 30, 39, 49).
- §4 bước 1: thêm "Cài MD Reader từ Chrome Web Store (link)". Mô tả `MDR_EXTENSION_ID`: "Mặc định gồm ID bản Chrome Web Store và ID bản dev (cài từ mã nguồn)".
- Thêm một câu: trong Cài đặt → Kết nối AI có sẵn lệnh để chép.
- `packages/mcp/README.md`: nếu có lệnh cài kèm số phiên bản thì đổi sang `1.3.2`; thêm link store ở chỗ nói về extension.
- `nguyenquanghao1808@gmail.com` → `qhao.work@gmail.com` ở `docs/store/privacy-policy.md:41` và `site/privacy.html:44,65` (cả text lẫn `mailto:`).
- **Không chạm** `docs/store/listing.md` (đang có thay đổi chưa commit của người dùng).
- Kiểm: `grep -rn "1\.3\.1\|nguyenquanghao1808" docs/MCP.md docs/MCP.en.md packages/mcp/README.md docs/store/privacy-policy.md site/privacy.html` → rỗng.

---

## Kích cỡ (§4)

| Phase con | File | Diff ước lượng | Test file mới |
|---|---|---|---|
| 17a | 5 | ~40 | 0 |
| 17b | 5 | ~280 | 1 |
| 17c1 | 3 | ~40 | 0 |
| 17c2 | 5 | ~40 | 0 |

17c ban đầu chạm 8 file nên đã tách thành 17c1/17c2.

## Deferred

- Firefox: Origin `moz-extension://<uuid>` khác nhau mỗi máy, nên allowlist cố định không dùng được. Cần cơ chế khác (ví dụ ghim origin lúc ghép cặp). Hoãn.
- Edge Add-ons: chưa có ID, thêm vào `KNOWN_EXTENSION_IDS` khi được duyệt.
- Remote MCP + OAuth: vẫn hoãn.

## Việc người làm sau merge

1. `cd packages/mcp && pnpm build && pnpm publish --access public --no-git-checks --otp=<mã>` → `le-sach-mcp@1.3.2`.
2. Sau bước 1 mới build zip extension và nộp bản cập nhật lên store (bản này chứa 17b với snippet `@1.3.2`).
3. Thêm và xác minh `qhao.work@gmail.com` trên GitHub, và đổi email liên hệ trong Chrome Web Store Developer Dashboard nếu cần.
