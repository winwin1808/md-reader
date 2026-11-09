# MD Reader Roadmap

[English](ROADMAP.en.md) · [Tiếng Việt](ROADMAP.md)

This is a plan, not a delivery-date commitment. Order and scope may change with feedback. Legend: `[x]` done, `[ ]` not started.

**Order from here:** v1.4 → v1.5 → Lề sách Cloud → v2.0 Beyond the browser.
Requests from real users run **in parallel** with this order (see [User requests](#user-requests-in-parallel)).

## Done (phases 1 to 17 and 19, version 1.4.0)

- [x] **P1 Foundation and reader:** `unified`/`remark` parser, Yjs document model, content script, app page.
- [x] **P2 Export:** single-file HTML, PDF (print CSS), Word `.docx`, the first five palettes.
- [x] **P3 Presenting:** slide splitting, speaker view, two-window sync, slide PDF.
- [x] **P4 Mind map and Excalidraw:** mind map from headings, SVG/PNG export, view embedded excalidraw diagrams.
- [x] **P5 Editing:** CodeMirror 6 on `Y.Text`, save to disk, conflict detection.
- [x] **P6 Hardening:** smallest-delta writes, schema migration, minimal permissions, KaTeX, Playwright.
- [x] **P7 Margin Book look:** three palettes, bundled fonts, logo, content script widget.
- [x] **P8 Sharing and collaboration:** self-hosted Cloudflare Worker, view/edit links, presence, blame, history.
- [x] **P9 Edit on the page:** live preview, grid tables, images (paste/drag/relative paths), new share dialog.
- [x] **P10 Local MCP:** `le-sach-mcp` (7 tools), `127.0.0.1` bridge, anonymous install key, daily limits, room deletion, content reports.
- [x] **P11 Security fixes:** attack paths from the 2026-10-27 audit, immediate link revocation, MCP bridge v2 with mutual authentication.
- [x] **P12 Server hardening:** edit links can only write their own part, `last_seen`, global image caps, cron deleting rooms unopened for 90 days.
- [x] **P13 UX polish:** clear messages for revoked links / documents too large, newer-format banner, HTML export embeds relative images, no more `window.alert` on web.
- [x] **P14 Risk closure:** edit-link updates checked before applying, clientID bound per link, batched cleanup cron, full room → read-only on web.
- [x] **P15 User and server debt:** one-call "Revoke all", lazy KaTeX, Word equations as OMML, paginated history, `.Md` files recognised, MCP edits named after the client, CLI file lock, "Compact document".
- [x] **P16 Test debt:** configurable-port collaboration e2e, tightened weak tests, order-independent suites.
- [x] **P17 On the Chrome Web Store:** AI connection setup guide right in Settings, `le-sach-mcp` 1.3.2 accepts the store build, new name "LeSach – Markdown Reader & AI Editor".
- [x] **P19 Slide PDF without clipped text:** long slides split automatically by their real height (lists and tables split by item/row, tables repeat their header), blocks that cannot be split are scaled down with a warning; manual `<!-- slide-break -->` marker and a "Break slide here" button in Edit mode; a "Split long slides automatically" switch in Settings; PDF pages are exactly 1280×720.
- [x] Vietnamese / English UI, CI, MIT license, Firefox build (limited).

## v1.3 Local MCP (done)

Target user: someone who asks an AI to write a Markdown document (report, proposal, technical doc) and then needs to send it to a colleague or client as a nicely rendered reading link, or a link to co-edit, without copying back and forth.

- [x] **Local bridge:** the AI (Claude Desktop / Claude Code / Cursor) talks to the extension through a bridge that listens only on `127.0.0.1`, off by default. Nothing is sent to the internet; a document goes to the server only when shared, after the user confirms.
- [x] **7 MCP tools** to create, read and update documents and to share / list / revoke links. Sharing requires user confirmation.
- [x] **Multi-tenant hardening:** anonymous install key, daily limits, deleting room data on the server, content reports on the view page.

## v1.4 Broader rendering and export

Ideas inspired by the feature lists of other Markdown viewers, notably docu.md (markdown-viewer-extension). Size needs care: the content script stays ≤ 60 KB gzip, so heavy parts will be lazy-loaded on the app page.

Diagrams and charts:

- [ ] PlantUML
- [ ] Graphviz / dot
- [ ] Vega / Vega-Lite
- [ ] ECharts
- [ ] draw.io
- [ ] Infographic
- [ ] OpenAPI / Swagger (YAML) rendered as API docs

Export:

- [ ] EPUB
- [ ] XLSX for tables
- [ ] Export individual figures (SVG / PNG)
- [x] Editable formulas in Word (OMML)

Look and performance:

- [ ] More document themes: business, academic, technical
- [ ] Large documents: caching and incremental rendering
- [ ] More interface languages beyond Vietnamese / English
- [x] Export through the image resolver (HTML export embeds relative images)

## v1.5 Finished collaboration and wide release

Collaboration:

- [ ] Comments and suggested edits
- [x] Room-data deletion endpoint ("Delete data from server" button) and automatic deletion of rooms unopened for 90 days
- [x] Daily limits for the Worker (anonymous install key, IP, global image caps)
- [ ] One-click deploy to Cloudflare ("Deploy to Cloudflare" button)
- [x] Replace `window.alert` on the web page with in-UI notifications

Release:

- [x] Chrome Web Store
- [ ] Microsoft Edge Add-ons
- [ ] Firefox AMO (with a replacement for File System Access on Firefox)

## Lề sách Cloud (paid)

A paid, closed-source cloud service. The extension, core and self-hosted server stay MIT and free. Only once there are a few hundred real users.

- [ ] Permanent storage and unlimited shared documents (the free tier deletes rooms unopened for 90 days)
- [ ] `.md` projects following a local folder tree, two-way sync
- [ ] View, edit, annotate and review documents on a phone
- [ ] Remote MCP + OAuth: an MCP endpoint on the server for AI agents running in the cloud (deferred, only if there is real demand)
- [ ] Password-protected links, cloud history
- [ ] Team: workspaces, SSO

## v2.0 Beyond the browser

- [ ] **Web app:** drop a file to read/edit, no extension needed
- [ ] **VS Code extension:** preview in the Margin Book look, share from the editor
- [ ] **Obsidian plugin**
- [ ] **Headless CLI:** `md → HTML / PDF` for CI and scripts
- [ ] **Mobile** (last, scope undecided)

## User requests (in parallel)

Requests from store users and GitHub Issues, worked in alongside the main roadmap as needed.

- [x] **Slide PDF without clipped text:** users can set where slides/pages break, so long content displays the way they want instead of being cut off as it is today. Done in P19.

## How to give input

Open an issue at [GitHub Issues](https://github.com/winwin1808/md-reader/issues) saying what you need; items with real demand get moved up.
