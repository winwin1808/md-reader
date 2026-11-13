# MD Reader local MCP

Vietnamese version: [MCP.md](MCP.md)

## 1. What local MCP is

`le-sach-mcp` is an MCP (Model Context Protocol) server that runs **on your own computer**. It talks to your AI client (Claude Desktop, Claude Code, Cursor, ...) over stdio, and reaches the MD Reader Chrome extension through a WebSocket bridge that listens only on `127.0.0.1`. There is no intermediate server: documents live in your Chrome and are not uploaded anywhere unless you share them yourself.

The bridge is **off by default**. The extension accepts connections only after you turn it on in Settings.

> Remote MCP and OAuth are **not available yet**; they are deferred. Only local MCP exists today.

## 2. Install

Requires Node >= 20. Nothing to install beforehand; your client runs `le-sach-mcp@1.3.3` with:

```
npx -y le-sach-mcp@1.3.3
```

## 3. Client configuration

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "md-reader": {
      "command": "npx",
      "args": ["-y", "le-sach-mcp@1.3.3"]
    }
  }
}
```

**Claude Code**:

```
claude mcp add md-reader -- npx -y le-sach-mcp@1.3.3
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "md-reader": {
      "command": "npx",
      "args": ["-y", "le-sach-mcp@1.3.3"]
    }
  }
}
```

Optional environment variables:

- `MDR_PAIR_FILE`: path of the pairing file (default `~/.config/md-reader/mcp.json`; on Windows `%APPDATA%\md-reader\mcp.json`; `XDG_CONFIG_HOME` is honored if set).
- `MDR_EXTENSION_ID`: extension ID allowed to connect (comma-separated for several). Defaults to both the Chrome Web Store extension ID (`eolclccibhickmpbpbdodbhopnddcdog`) and the build-from-source ID (`ojcemoafaibjfghljkbagnkbgljakbji`).

## 4. Enable and pair

1. Open Chrome with MD Reader (install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/md-reader/eolclccibhickmpbpbdodbhopnddcdog)), go to **Settings → AI connection** (Kết nối AI) and turn it on. Right below the switch you will find ready-made commands/JSON for Claude Code, Claude Desktop and Cursor to copy.
2. Start (or restart) the AI client. Within **10 minutes** of `le-sach-mcp` starting, the extension shows a **pairing dialog** with the client name (up to 40 characters) and an **identifier** like `ABCD-1234`. It must match the `le-sach-mcp: đã ghép cặp với MD Reader …` line in the AI client's log (printed after you click Allow). Choose Allow.
3. How it authenticates (protocol v2): `le-sach-mcp` and the extension each hold their own ECDSA P-256 key pair. On every connection each side signs the other's random nonce together with the port; no secret ever crosses the connection. The extension only runs commands from a server whose key you approved; `le-sach-mcp` only accepts the first extension that paired (pinned on first use, only within the first 10 minutes).
   The server key lives in `~/.config/md-reader/mcp.json` (mode 600). Do not share this file. To pair from scratch: delete it, restart the AI client, and approve again in the extension. A corrupt or old-version file is renamed to `mcp.json.bak-…` and a new key is created (the log says so).
   Remaining limit: another program on the same machine, running as the same user, that connects to `le-sach-mcp` before the extension within those 10 minutes can take the server-side pairing slot. The real extension is then refused (you will see pairing fail) — delete the pairing file and restart.
   Key pinning uses a file lock, so several `le-sach-mcp` processes starting at the same time (for example several client windows) are safe. Clicking Allow twice in a row in the pairing dialog does not break pairing either.
4. Revoke: revoke a client in Settings → AI connection. A revoked client that reconnects within 60 seconds is **not asked again**; to pair again, turn AI connection off and on after 60 seconds.

### One AI app, one Chrome profile

Each `le-sach-mcp` pairs with **one** extension, which means one Chrome profile. From extension 1.5.1 and `le-sach-mcp` 1.3.3:

- The pairing dialog opens by itself **at most once** per AI app in each profile. Denying, closing the tab or not answering is remembered; the extension does not ask again.
- A profile other than the paired one **opens no tab at all**. In Settings → AI connection, the **AI apps running on this machine** list shows the app with "Paired with another browser or Chrome profile". (With `le-sach-mcp` 1.3.2 and older the extension cannot tell where the server is paired, so it still asks once, then stops.)
- To connect later: open Settings → AI connection and press **Connect** next to an app marked "Not connected". The pairing dialog opens and you still have to click Allow.
- Clicking Allow always gives a result: it connects, or the dialog says why not (the AI app is paired elsewhere, more than 10 minutes have passed since it started, or it is no longer running).

**Moving an AI app to another profile:**

1. In the old profile: revoke that AI app in Settings → AI connection (or turn AI connection off). If you skip this, the old profile reconnects by itself and takes the pairing slot first.
2. Run `npx -y le-sach-mcp@1.3.3 unpair`. It removes the pinned extension key from the pairing file and **keeps the server key**, so the identifier stays the same. It prints one result line and exits.
3. Restart the AI app (the 10-minute pairing window starts when `le-sach-mcp` starts).
4. In the new profile: Settings → AI connection → **Connect** → Allow.

## 5. The seven tools

| Tool | What it does | Confirmation |
|---|---|---|
| `publish_doc` | Create a new document in MD Reader on this computer and open a tab (`open` optional). Returns `docId`. | No |
| `list_docs` | List documents (id, title, last opened, whether shared). | No |
| `get_doc` | Read the current Markdown, including collaborators' edits. Returns `markdown` and `hash`. | No |
| `update_doc` | Replace the document's Markdown; only changed parts are written. Needs `baseHash` from `get_doc`; if the document changed since, it fails with `CONFLICT` — call `get_doc` again and retry. History and blame attribute the change to the paired AI client's name (for example "Claude Code"), not a generic "AI"; all edits from the same client on the same machine share one author. The change stays inside MD Reader: it is **not written to the file on disk automatically** — the status bar shows "AI edited — unsaved" until you press Save (⌘S) or keep editing yourself. | No |
| `share_doc` | Ask to create a share link (`role`: `view` or `edit`, default `view`; `expiresInDays`: 7, 30 or `null`, default 7). Returns the URL. | **Always asks** |
| `list_links` | List a document's share links (prefix, role, expiry, revoked). | No |
| `revoke_link` | Ask to revoke a link by `tokenPrefix` (6 characters). | **Always asks** |

`share_doc` and `revoke_link` always show a confirmation dialog in MD Reader; nothing happens unless you click Allow. The dialog closes by itself after 100 seconds, which counts as a refusal.

## 6. Example prompts

- "Write these meeting notes up as a Markdown document and open it in MD Reader."
- "Read the 'Q4 plan' document in MD Reader and rewrite the risks section more clearly."
- "List the documents I opened recently."
- "Create a view-only link that expires in 7 days for this document."
- "Turn this document into a slide deck with one main point per slide."

**Writing Markdown for presenting.** MD Reader splits slides on `---` lines (when the document has them) or on headings. To break a slide at a specific place without adding a rule or a heading, the AI puts `<!-- slide-break -->` on its own line, with a blank line before and after; the line is invisible when reading and dropped from Word export. Speaker notes are written as `<!-- note: ... -->`. Slides that are too long are still split automatically when presenting and exporting to PDF, so manual breaks are not needed just to avoid overflow.

## 7. Limits and troubleshooting

Limits: Markdown up to 2,000,000 characters; for a shared document, each sync message is at most 16 MiB and each room at most 64 MiB; title 1-200 characters; at most 4 concurrent connections; the bridge uses a `127.0.0.1` port in the range 47821-47830 (first free one). Per-call timeout is 30 seconds, 120 seconds for `share_doc` and `revoke_link`; waiting for the extension to connect takes up to 35 seconds.

| Error | Cause / fix |
|---|---|
| `NOT_CONNECTED` | Chrome with MD Reader is not open, or AI connection is off. Open Chrome and turn on Settings → AI connection. |
| `NOT_PAIRED` | The client is not paired or was revoked. Accept the pairing dialog; if revoked, turn AI connection off and on after 60 seconds. |
| The "Allow an AI app to connect?" tab keeps reopening | Two Chrome profiles both have AI connection on, with an extension older than 1.5.1. Update the extension, or turn AI connection off in the profile you do not use. |
| `TIMEOUT` | The extension did not answer in time (or a confirmation dialog went unanswered). Retry. |
| `CONFLICT` | `update_doc` with a stale `baseHash`. Call `get_doc` again. |
| `INVALID_ARGS` | Bad arguments (for example `baseHash` must be 64 lowercase hex characters). |
| Port busy | All 10 ports 47821-47830 are taken: the server reports `no free port`. Stop the process holding them and run again. |

## 8. Privacy

Every read/write happens between the AI client on your computer and your own Chrome. Only when you click Allow on `share_doc` is that document's content sent to the sharing server, exactly as if you pressed Share in MD Reader. Your AI client still processes whatever it reads under its own provider's policy.
