# Security audit REPORT: md-reader (run-1)

## 1. Scope, profile, execution, status
- Profile **standard**, scope: apps/api, apps/extension, apps/web, packages/core, packages/mcp, packages/ui, .github. Source ref: commit 8391eeab (main), clean worktree. Prior runs: none (no compatible ledger; no carried confirmations).
- Budget 32 agent invocations; **31 spent** (4 recon, 9 hunters, 1 post-wave critic, 8 candidate verifiers, 8 Phase 5 verifiers, 1 final-clean critic). All agents ran as sonnet.
- Execution policy: **source inspection only**. No OS-enforced sandbox exists on this host, so no target code, build, test, browser or wrangler was run, and no deployed endpoint was contacted. Consequence: **no record could reach `confirmed`**; every verified lead is `needs_validation` with a local fixture or owner-observed plan.
- **run_status: incomplete** (reason `deferred_units_budget_cannot_reserve_critics_and_validation`): the post-wave critic asked to reassign two units (awareness clientID spoofing relay; unbounded Y.Doc growth by edit peers); the budget could not fund a second hunter wave. The DO growth concern is partly covered by lead 7 and the awareness spoofing is listed under hardening, but neither unit was independently closed. The final-clean critic returned no further gaps. Coverage is therefore not claimed complete.
- Deviation to disclose: hunter/verifier prompts were passed as prompt files on disk (assembled verbatim from the skill blocks) rather than inline; three hunter candidates on the same revocation root cause and two on the Viewer XSS root cause were merged; three anonymous-exhaustion candidates were merged into one fingerprint to fit the budget; the owner-token-in-URL candidate was excluded at consolidation (operator is the only reader; recorded as hardening).

## 2. Posture summary
Core authorization on the Worker is sound in source: 256-bit hashed tokens, owner-gated link ops, token/room binding on the WebSocket, x-mdr-internal stripped, viewers' sync writes dropped, constant-time-style admin compare, asset MIME allowlist + sniff + nosniff + CSP, sanitized markdown, strict mermaid, consent dialog with post-approval re-check for share/revoke. The leads are lifecycle gaps (revocation, deletion), one post-sanitize innerHTML sink, an unconfirmed AI-to-disk write path, an export injection, a peer-poisonable format field, a forgeable local bridge handshake, and anonymous quota design.

## 3. Confirmed findings
None (see section 1: execution impossible; confirmed requires an observed local result).

## 4. NEEDS VALIDATION (prioritized, no severity)
Highest-priority and "source-deterministic" means the path is complete from source and only a runtime/deployment fact remains. Full trace/blockers/plans: NEEDS-VALIDATION.md.

| # | Lead | Sink location | Smallest fix |
|---|---|---|---|
| 1 | Code-fence info string reaches Viewer code-block header innerHTML unescaped, giving stored DOM XSS on the share web origin | `packages/ui/src/Viewer.tsx:247` | Set badge text via textContent (or escape `lang`), anchor the lang regex, restrict sanitize className to /^language-[\w+#.-]+$/, add CSP to the web assets. |
| 2 | Revoked or expired share links keep read and write access on already-open WebSockets, and for up to 60 s on new ones | `apps/api/src/room.ts:114` | On revoke, delete authCache entries and notify DocRoom to close connections whose token hash was revoked; re-check expiry periodically. |
| 3 | Unconfirmed MCP update_doc is auto-saved to the user's local file via the granted File System Access handle | `apps/extension/src/app/hooks/useFileSave.ts:108` | Do not auto-save ORIGIN_MCP-originated edits (require explicit user save) or add a per-doc allow-AI-write-to-disk confirmation; document it in docs/MCP.md. |
| 4 | Standalone HTML export injects an unvalidated remote image Content-Type into an img src attribute | `packages/core/src/export/html.ts:103` | Accept only /^image\/(png|jpeg|gif|webp|bmp)$/ MIME (else skip inlining) or escape; add a restrictive CSP meta to the export. |
| 5 | Edit-link peer can set meta.formatVersion > 2 and break the owner's room binding, checkpoints and MCP writes for that doc | `apps/extension/src/app/hooks/useDocSession.ts:233` | Do not trust peer-written meta.formatVersion; catch UnsupportedFormatVersionError in useDocSession so room binding still happens; keep integrity fields local. |
| 6 | Loopback MCP bridge authenticates peers only by forgeable Origin, discloses the pair key in hello, and accepts unproven welcome, enabling cross-OS-user pairing theft and impersonation | `apps/extension/src/worker/bridge.ts:81` | Never send pairKey in hello; use nonce + HMAC(pairKey, nonce) both ways before pairing/welcome. |
| 7 | Anonymous callers can exhaust shared Worker capacity: retained D1 asset bytes, Durable Object storage, and the global daily room cap | `apps/api/src/persistence.ts:103` | Charge per-IP total bytes regardless of install key, add global asset/byte caps and TTL, per-room Yjs size cap, /64 IPv6 aggregation. |
| 8 | Room deletion or takedown can leave document content in the Durable Object when the purge step fails, with no retry | `apps/api/src/api.ts:319` | Check the purge response, run purge before (or retry after) D1 deletion, keep a retryable deletion record. |

Priorities 1-3 are the ones most worth a quick local test before release (1: one jsdom test; 2: one DocRoom test; 3: one manual dummy-profile test).

## 5. Hardening notes and positive patterns
- Asset upload quota is charged to the room owner's install (limits.ts:73-80). An edit-link holder can exhaust the owner's daily asset count and byte quota across all of that owner's rooms.
- Limit check and record are separate, non-atomic D1 operations (api.ts:86-89, 218-222). The ROOM_ASSET_QUOTA read-then-write at api.ts:215 is also non-atomic, so concurrent requests can exceed the limits.
- GET /api/a/:id is unauthenticated and room-unbound, so the 128-bit asset id is the only capability. It is served with 'public, max-age=31536000, immutable', so browser or CDN copies outlive room deletion.
- The x-mdr-install header is client-supplied, so rotating it bypasses per-install limits. Only the per-IP limit (50 rooms/day) and the global limit (500 rooms/day) remain. An actor with about 10 IPs can exhaust global room creation, which is a resource-exhaustion unit concern.
- The asset upload path reads req.arrayBuffer() fully before enforcing the size check when Content-Length is absent (api.ts:208-213).
- Revoke selects links by 6-character token_prefix and revokes the oldest match. A prefix collision within one room would revoke an unintended link (probability about 2^-36 per pair).
- Takedown writes the takedowns table, but nothing reads it. This is safe today because room ids are random and not re-registrable, but it is dead enforcement.
- apps/api/src/api.ts:221 and :215: roomUsage is checked before put with no transaction, so concurrent uploads can exceed ROOM_ASSET_QUOTA and the install byte quota (check-then-act race).
- apps/api/src/api.ts:210-212: when Content-Length is absent (chunked), req.arrayBuffer() buffers the whole body before the size check. Auth is required first, and the Workers body limit applies upstream, so this is memory-only hardening.
- apps/api/src/api.ts:221 against deleteRoomEverywhere: an upload racing a room delete or takedown can leave orphan assets that stay publicly readable by ID, because nothing sweeps assets whose room is gone.
- apps/api/src/limits.ts:73-80: an edit-link holder's uploads are charged to the room owner's install-key quota, so an edit-link holder can use up the owner's daily asset count of 100.
- apps/api/src/protocol.ts:50-72: sanitized awareness keeps the sender-chosen clientID and clock, so a viewer can spoof or null out other peers' presence entries, and can add many entries (a 16 KiB cap per message, with no connection or rate cap). The effect is limited to presence in a room the viewer already has a link to.
- apps/api/src/api.ts:237: assets are served with `public, max-age=31536000, immutable`, so browsers and shared caches keep the bytes after room deletion or takedown, and the asset ID is a bearer capability with no revocation other than deleting the row.
- apps/api/src/tokens-d1.ts:99-107: revoke targets the oldest unrevoked link with a matching 6-character prefix, so a prefix collision within a room can revoke a different link than intended (low-probability).
- apps/api/src/index.ts:28-33: CORS is wildcard for /api/*, which is acceptable because all state-changing routes need non-ambient bearer tokens; no cookie-based ambient authority exists.
- worker/index.ts renderMd and openApp onMessage handlers do not verify sender; openApp caches attacker-supplied content under file_content_<fileUrl> (content scripts are semi-trusted, so this is hardening only).
- Each rogue connect that sends hello with an unapproved key opens a new active pairing tab (index.ts:136); the 60 s suppression applies only to revoked keys, so a local rogue listener can repeatedly spawn pairing tabs.
- pairing.ts tighten() uses path-based stat/chmod rather than fd-relative ops. It is benign when the config dir is user-owned; consider fchmod on an opened fd.
- The pairing dialog shows only the peer-chosen client name; showing the port and a short keyHash fingerprint would help users detect a rogue listener.
- apps/extension/src/app/bridge-executor.ts:89 and packages/ui/src/components/ConfirmAgentDialog.tsx:46: docTitle comes from the doc record or meta and is AI-controllable via publish_doc (trim only, up to 200 characters). It is shown in the confirm text without bidi, control or zero-width sanitization. sanitizeClientName covers the client name only. Reuse it for the title shown in the dialog.
- The confirm text for share_doc shows no size or content preview, and the AI can rewrite the doc with update_doc immediately before requesting the share. Consider showing the character count or the first lines of the content in the dialog.
- apps/extension/src/app/collab/link-cache.ts: tokens are never removed when a doc record is deleted locally (only deleteRemote calls forgetRoomTokens). Orphaned mdr.links.<room> entries persist in chrome.storage.local, and the owner token is lost with the record.
- No chrome.storage.local.setAccessLevel('TRUSTED_CONTEXTS') call was found. storage.local is readable by content scripts by default, and it holds link tokens and the install key (and, if present, pairing data). The content script is isolated from page JS, but restricting the access level would shrink the blast radius of a content-script compromise. Verify this against whether the content script actually needs storage.local.
- The useAgentConfirm timeout (100 s) and the MCP client's own timeout are independent. A user approval after the client has given up still creates a link whose URL the client never receives. This is not a security impact, but the link is orphaned and labeled 'AI · client'.
- Remediation: build the header with createElement and textContent, or escape lang. Anchor the lang regex (/^language-([A-Za-z0-9_+.#-]+)$/) and restrict the sanitize className allowlist to /^language-[\w+#.-]+$/. Apply the same for /^math-/.
- Add a CSP to the web share page (script-src 'self'; object-src 'none'; base-uri 'none') via an assets _headers file as defense in depth. The Viewer and mermaid SVG sinks rely on sanitization alone.
- The widened sanitize schema adds style, className and data-info on '*' when allowRawHtml is true. Nothing in the repo enables it today, but the flag should stay off or be documented as unsafe for untrusted content.
- MermaidBlock and the block widgets set SVG via innerHTML and depend on mermaid securityLevel 'strict' and its bundled DOMPurify. Pin the mermaid version and consider running DOMPurify on the SVG output.
- apps/extension/src/worker/index.ts openApp: fileUrl is trusted from the message and not compared to sender.tab.url or checked with isMarkdownUrl. The worker also writes the 'file_content_'+fileUrl cache key and navigates to app.html?file=<fileUrl>. Validating the scheme (http/https/file) and equality with sender.url would remove reliance on content-script integrity.
- apps/extension/src/app/hooks/useDocSession.ts: the ?file= loader accepts any scheme or origin and calls fetch/XHR from the extension origin. Restricting it to isMarkdownUrl() or a GitHub-blob URL would make it safe if app.html ever becomes web-accessible or externally navigable.
- apps/extension/src/app/image-resolver.ts: in file: origin mode, absolute or ../ image srcs can resolve to arbitrary file:/// paths that are fetched into blob URLs. Confining them to the document directory (or to image MIME types) would remove the existence oracle.
- apps/extension/src/app/App.tsx: the BroadcastChannel 'md-reader-slides-sync' is not keyed by docId, so two open decks navigate each other (a UX bug). Scope the channel name by docId.
- packages/core/src/share/share.ts parseShareUrl is currently dead code. If it is later wired into a join flow, it derives the server origin from attacker-supplied URL text, so the flow should require confirmation or a server allowlist.
- docx.ts:131-148 emits ExternalHyperlink for any URL scheme (file:, javascript:, and others). Restrict to http, https and mailto.
- The exported HTML (html.ts:110-121) has no CSP meta tag. Adding default-src 'none'; img-src data: https:; style-src 'unsafe-inline' would limit the impact of any inlined-content bug.
- The html.ts img regexes are not a real HTML parser. Because the input is sanitizer-produced HTML the risk is low, but operating on the hast tree would be safer.
- useFileSave.ts has a small gap between the disk read and the write, and the write is not atomic against a concurrent external writer. This is same-user only, and the conflict dialog mitigates most of it.
- ci.yml has no top-level permissions block, so it relies on the repository default token scope. Add permissions: contents: read.
- release.yml grants contents: write at workflow level. Move it to the release job only (it is already the only job).
- Actions are pinned by major tag (actions/checkout@v4, pnpm/action-setup@v4, setup-node@v4, upload-artifact@v4) rather than commit SHA. Pin to SHAs, since the release job holds a write token.

Additional: CI actions pinned by tag not SHA and no `permissions:` in ci.yml; release.yml grants contents:write at workflow level; no CSP/headers file for apps/web; owner token appears in URL (`/api/s/<owner>`, WS `?token=`) with Workers observability enabled (check logs; consider header or short-lived ticket); docx hyperlinks allow any scheme; `.gitignore` lacks `.dev.vars`/`.env.*`; npm publish has no provenance workflow; install-key header is client-chosen.
Positive: hashed token storage, role set server-side, internal header stripping, admin route 404 when unset, pair file 0600, manifest without externally_connectable/web_accessible_resources, store zip strips manifest key, argument-array process spawning, no eval/Function.

## 6. Coverage summary (coverage-ledger.json)
24 units: 12 covered, 10 candidate (all 8 lead fingerprints independently verified twice), 2 deferred (budget). Critics: post-wave critic requested reassignment of the 2 deferred units; final-clean critic reported no missing units and no reassignments. Not executed: all dynamic checks; deployment facts (ADMIN_SECRET, migration 0003 remote, Cloudflare WAF/D1 caps, response headers, store ID, npm provenance) remain owner-observed items.

---

## Trạng thái sau Phase 11 (2026-10-27, kiểm lại có mục tiêu, chỉ đọc mã)

| # | Hướng tấn công | Trạng thái | Chặn ở |
|---|---|---|---|
| 1 | XSS info string code fence | ĐÃ VÁ | `LANG_CLASS` (core render + sanitize), header khối code dựng bằng `textContent` (Viewer); CSP `_headers` cho web |
| 2 | Link thu hồi/hết hạn còn truy cập | ĐÃ VÁ | DO lưu tập thu hồi + đóng socket 4410, kiểm hạn mỗi message + alarm; cache auth ≤ hạn link; thu hồi idempotent, 502 thử lại được |
| 3 | `update_doc` tự ghi ra đĩa | ĐÃ VÁ | `meta.aiUnsaved` chặn auto-save; chỉ Lưu tay / người dùng sửa mới xoá cờ |
| 4 | Export HTML chèn MIME | ĐÃ VÁ | allowlist `image/*`, kiểm base64, escape `src`, meta CSP |
| 5 | `formatVersion` lạ từ peer | MỘT PHẦN | phía chủ chịu được (`ensureDoc` tolerateNewer); máy chủ vẫn cho peer ghi `meta` — lọc theo kiểu là non-goal phase 11 |
| 6 | Cầu nối MCP chiếm cặp ghép | ĐÃ VÁ | giao thức v2: ECDSA P-256 hai chiều, nonce + cổng, ghim khoá máy chủ có người duyệt + mã nhận dạng; còn khe TOFU phía máy chủ trong 10 phút đầu (ghi ở docs/MCP.md) |
| 7 | Cạn tài nguyên chung | MỘT PHẦN | quota bytes theo IP luôn tính, IPv6 /64, trần 16 MiB/message + 64 MiB/phòng, client ngừng nối lại khi đóng vĩnh viễn; chưa có trần toàn cục bytes ảnh / TTL phòng |
| 8 | Purge lỗi → nội dung mồ côi | ĐÃ VÁ | purge DO + ảnh trước, kiểm status, D1 xoá sau cùng, 502 thử lại được |
| 9 | Giả clientID awareness | ĐÃ VÁ | clientID ràng theo kết nối (≤4), chuyển quyền khi chủ im > 120 s |

Sink nghi ngờ ở review 11a (`live/table-grid.ts` renderInline, KaTeX trong `block-widgets.ts`, SVG mermaid): không có đường khai thác — renderInline qua sanitize; KaTeX an toàn nhờ `trust:false` mặc định (đừng bật `trust`); mermaid `securityLevel:'strict'`.
