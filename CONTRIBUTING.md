# Contributing to MD Reader

Thanks for helping out. This guide is short on purpose; the architecture rules below are the part that matters most.

Note: `docs/DESIGN.md` and several other design docs are written in Vietnamese. The README, this file and `docs/SELF_HOST.md` are in English. Issues and PRs in English or Vietnamese are both welcome.

## Setup

Requirements: Node 22, pnpm 10.

```bash
pnpm install
pnpm --filter extension build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/extension/dist`.

## Repo layout

| Path | Role |
|---|---|
| `packages/core` | Pure TypeScript: parser, Yjs doc model, slides, mind map, export |
| `packages/ui` | React components and the i18n catalogs |
| `apps/extension` | MV3 shell: app page, content script, service worker |
| `apps/api` | Sync server (Cloudflare Worker, Durable Object + D1) |
| `apps/web` | The `/s/<token>` share page |

## Architecture rules

PRs that break these will be asked to change.

1. **`Y.Text "source"` is the source of truth.** The `.md` file is an import/export gateway, not state. Do not change the Y.Doc schema without a migration and an old-format test fixture.
2. **Package boundaries.** `packages/core` must not use React, `chrome.*` or `document`. `packages/ui` must not use `chrome.*`. Only `apps/extension` may use `chrome.*`. Import across packages by workspace name (`@md-reader/core`), never by relative path.
3. **The content script does not use Yjs** and stays within **60 KB gzip**.
4. **The parser is `unified`/`remark`.** No other markdown parser.
5. **i18n.** Every user-visible string goes through the catalogs in `packages/ui/src/i18n/catalog`. Both `vi` and `en` are required; do not hardcode text in components.

## Commands

```bash
pnpm typecheck                     # all packages
pnpm test                          # all packages
pnpm --filter core test            # or ui / extension / api / web
pnpm --filter extension build
pnpm --filter extension e2e        # Playwright
```

CI runs typecheck, tests, the extension build and the e2e suite on every PR.

## Branches and commits

Branch from `main` (for example `fix-table-tab` or `feat-export-epub`). Commits follow Conventional Commits, as in `git log`: `feat(ui): ...`, `fix(i18n): ...`, `docs: ...`, `test(core): ...`, `chore: ...`. Keep one logical change per commit.

## Pull request checklist

- [ ] `pnpm typecheck` and `pnpm test` pass
- [ ] New behavior has tests
- [ ] New strings added in both `vi` and `en`
- [ ] No `chrome.*` outside `apps/extension`; no React/DOM in `packages/core`
- [ ] Screenshots for UI changes
- [ ] Docs updated if behavior changed

## Adding a translation

1. Copy the `en` catalog structure: each area file in `packages/ui/src/i18n/catalog/` (`common`, `shell`, `ext`, `live`, `present`, `settings`, `web`) holds per-locale messages.
2. Add your locale to the `Locale` type in `packages/ui/src/i18n/types.ts`, add its messages to each area, and register it in `catalogs` in `packages/ui/src/i18n/translate.ts`.
3. Add it to the language picker in Settings, then run `pnpm typecheck` and `pnpm test`; the type system flags missing keys.

## Self-hosting the sync server

See [`docs/SELF_HOST.md`](docs/SELF_HOST.md).

## Conduct and security

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues.
