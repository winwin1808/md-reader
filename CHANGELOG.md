# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Community files: CONTRIBUTING, Code of Conduct, Security policy, issue and PR templates.

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
