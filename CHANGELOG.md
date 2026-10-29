# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Community files: CONTRIBUTING, Code of Conduct, Security policy, issue and PR templates.

## [1.3.0] - 2026-10-29

First Chrome Web Store release. Covers phases 10 to 16. The store build ships with a default sync server run by the author (changeable in Settings → Cộng tác); sharing stays off by default.

### Added
- Local MCP bridge (`le-sach-mcp`, protocol v2): 7 tools, mutual ECDSA P-256 authentication, pairing dialog with an identifier, confirmation for every share/revoke. MCP edits are attributed to the client's name (for example "Claude Code") and do not write to disk by themselves.
- Server tenancy: anonymous install key, daily per-install and per-IP limits (429), global image caps (3 GiB stored, 1 GiB per day), content reports and admin takedown.
- Room deletion ("Delete data on server") and automatic deletion of rooms unopened for 90 days (daily cron); "Revoke all" in one server call.
- "Compact document" when a shared room is full (drops edit history and blame, old links stop working).
- Clear sync messages when a link is revoked or a document is too large (no endless reconnect); banner when a document uses a newer format version.
- Word export writes equations as editable OMML; HTML export embeds relative images; history drawer is paginated.
- `Readme.Md` and other mixed-case Markdown file names are recognised.

### Changed
- KaTeX is loaded lazily (app page 511 to 436 KB gzip, web page 393 to 315 KB).
- Edit links can only write `source` and their own author entry; anything else is rolled back and the connection is closed (4403). Update checks run before applying.
- Limits are 16 MiB per message and 64 MiB per room.

### Fixed
- Security fixes from the 2026-10-27 audit: code-fence class allowlist, CSP for the web page and HTML export, immediate revocation and expiry, IPv6 /64 quotas, newer-format documents no longer break the owner session.
- Double-clicking Allow in the MCP pairing dialog no longer breaks pairing.
- Test flakes fixed (the extension and ui test suites no longer depend on test order).

## le-sach-mcp 1.3.1 - 2026-10-29

### Fixed
- Pinning keys takes a file lock, so several CLI processes can start at the same time safely.

## [1.2.0] - 2026-10-25

### Added
- Edit directly on the reading page: two modes, Read and Edit, with a CodeMirror 6 live preview on `Y.Text "source"`.
- Tables stay a grid while editing (per-cell edits, Tab/Enter/arrow navigation, add/remove rows and columns).
- Relative images render correctly; paste or drag images while editing (shared docs, granted folder, or small inline `data:` images).
- Redesigned sharing: View/Edit groups, re-copy created links, server setup in Settings.
- English interface (i18n with `vi` and `en` catalogs), also on the web share page.
- GitHub Actions CI and release workflow; Firefox/Edge build targets.

### Changed
- Source and split view modes removed in favor of Read/Edit.

### Licensing
- Released under the MIT license.

## [1.1.0] - 2026-10-24

### Added
- Sharing and collaboration (phase 8): self-hostable Cloudflare Worker sync server, view/edit links, presence, per-line blame, history and restore, in-place reading in the content script, and the `/s/<token>` web page.

## [1.0.0] - 2026-10-24

### Added
- Phases 1-7: reader with Yjs document model and IndexedDB storage, HTML/PDF/Word export, slide presentation with speaker view, mind map and Excalidraw blocks, safe save to disk with conflict detection, hardening (migrations, KaTeX math, permissions, Playwright e2e), and the "Margin of the Book" visual design with logo.
