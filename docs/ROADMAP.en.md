# MD Reader Roadmap

[English](ROADMAP.en.md) · [Tiếng Việt](ROADMAP.md)

This is a plan, not a delivery-date commitment. Order and scope may change with feedback. Legend: `[x]` done, `[ ]` not started.

## Done (phases 1 to 9, version 1.2.0)

- [x] **P1 Foundation and reader:** `unified`/`remark` parser, Yjs document model, content script, app page.
- [x] **P2 Export:** single-file HTML, PDF (print CSS), Word `.docx`, the first five palettes.
- [x] **P3 Presenting:** slide splitting, speaker view, two-window sync, slide PDF.
- [x] **P4 Mind map and Excalidraw:** mind map from headings, SVG/PNG export, view embedded excalidraw diagrams.
- [x] **P5 Editing:** CodeMirror 6 on `Y.Text`, save to disk, conflict detection.
- [x] **P6 Hardening:** smallest-delta writes, schema migration, minimal permissions, KaTeX, Playwright.
- [x] **P7 Margin Book look:** three palettes, bundled fonts, logo, content script widget.
- [x] **P8 Sharing and collaboration:** self-hosted Cloudflare Worker, view/edit links, presence, blame, history.
- [x] **P9 Edit on the page:** live preview, grid tables, images (paste/drag/relative paths), new share dialog.
- [x] Vietnamese / English UI, CI, MIT license, Firefox build (limited).

## v1.3 Share with AI (MCP)

The next milestone. Target user: someone who asks an AI to write a Markdown document (report, proposal, technical doc) and then needs to send it to a colleague or client as a nicely rendered reading link, or a link to co-edit, without copying back and forth.

The `@md-reader/mcp` package, two ways to run:

- **stdio:** runs locally (`npx`), configured in Claude Desktop / Claude Code / Cursor. Calls the user's own Worker server.
- **Remote:** an MCP endpoint on the self-hosted Worker itself, for agents running in the cloud.

Planned tools:

| Tool | What it does |
|---|---|
| `publish_doc` | Takes Markdown + a title, creates a document, returns a view link (and an edit link if requested). |
| `get_doc` | Reads the current content of a shared document (including what others just edited). |
| `update_doc` | Writes a new version or applies a change; writes as a delta so it doesn't overwrite others' edits. |
| `list_docs` | Lists the owner's documents (id, title, last edited, active links). |
| `create_link` | Creates a view or edit link, with an optional expiry. |
| `revoke_link` | Revokes a link. |

Addition: comments (`append_comment`) once the v1.5 comments feature is ready.

Authentication and limits (planned design):

- Authenticate with the Worker server's owner token; the token is stored only as a hash on the server, like links today.
- By default an agent only creates view links; an edit link must be requested explicitly.
- Limits on document size, document count and call rate per token (together with the v1.5 rate limit).

To do:

- [ ] Design the document management API in `apps/api`, shared by the extension and MCP
- [ ] Owner token, revocation, rotation
- [ ] `@md-reader/mcp` (stdio) with the 6 tools above
- [ ] Remote MCP endpoint on the Worker
- [ ] Setup docs for Claude, ChatGPT, Cursor; example prompts
- [ ] Tool contract tests and e2e with wrangler dev

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
- [ ] Editable formulas in Word (OMML)

Look and performance:

- [ ] More document themes: business, academic, technical
- [ ] Large documents: caching and incremental rendering
- [ ] More interface languages beyond Vietnamese / English
- [ ] Export through the image resolver (export currently doesn't use the relative-image resolver)

## v1.5 Finished collaboration and wide release

Collaboration:

- [ ] Comments and suggested edits
- [ ] Room-data deletion endpoint (revoking a link currently only blocks access)
- [ ] Rate limit for the Worker
- [ ] One-click deploy to Cloudflare ("Deploy to Cloudflare" button)
- [ ] Replace `window.alert` on the web page with in-UI notifications

Release:

- [ ] Chrome Web Store
- [ ] Microsoft Edge Add-ons
- [ ] Firefox AMO (with a replacement for File System Access on Firefox)

## v2.0 Beyond the browser

- [ ] **Web app:** drop a file to read/edit, no extension needed
- [ ] **VS Code extension:** preview in the Margin Book look, share from the editor
- [ ] **Obsidian plugin**
- [ ] **Headless CLI:** `md → HTML / PDF` for CI and scripts
- [ ] **Mobile** (last, scope undecided)

## How to give input

Open an issue at [GitHub Issues](https://github.com/winwin1808/md-reader/issues) saying what you need; items with real demand get moved up.
