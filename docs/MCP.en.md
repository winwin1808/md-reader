# MD Reader local MCP

Vietnamese version: [MCP.md](MCP.md)

## 1. What local MCP is

`le-sach-mcp` is an MCP (Model Context Protocol) server that runs **on your own computer**. It talks to your AI client (Claude Desktop, Claude Code, Cursor, ...) over stdio, and reaches the MD Reader Chrome extension through a WebSocket bridge that listens only on `127.0.0.1`. There is no intermediate server: documents live in your Chrome and are not uploaded anywhere unless you share them yourself.

The bridge is **off by default**. The extension accepts connections only after you turn it on in Settings.

> Remote MCP and OAuth are **not available yet**; they are deferred. Only local MCP exists today.

## 2. Install

Requires Node >= 20. Nothing to install beforehand; your client runs:

```
npx -y le-sach-mcp
```

## 3. Client configuration

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "md-reader": {
      "command": "npx",
      "args": ["-y", "le-sach-mcp"]
    }
  }
}
```

**Claude Code**:

```
claude mcp add md-reader -- npx -y le-sach-mcp
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "md-reader": {
      "command": "npx",
      "args": ["-y", "le-sach-mcp"]
    }
  }
}
```

Optional environment variables:

- `MDR_PAIR_FILE`: path of the pairing file (default `~/.config/md-reader/mcp.json`; on Windows `%APPDATA%\md-reader\mcp.json`; `XDG_CONFIG_HOME` is honored if set).
- `MDR_EXTENSION_ID`: extension ID allowed to connect (comma-separated for several). Defaults to the released extension ID.

## 4. Enable and pair

1. Open Chrome with MD Reader, go to **Settings → AI connection** (Kết nối AI) and turn it on.
2. The first time an AI client connects, the extension shows a **pairing dialog** asking whether to allow that client (shown by client name, up to 40 characters). Choose Allow.
3. The pairing key is stored in `~/.config/md-reader/mcp.json` (mode 600). Do not share this file.
4. Revoke: revoke a client in Settings → AI connection. A revoked client that reconnects within 60 seconds is **not asked again**; to pair again, turn AI connection off and on after 60 seconds.

## 5. The seven tools

| Tool | What it does | Confirmation |
|---|---|---|
| `publish_doc` | Create a new document in MD Reader on this computer and open a tab (`open` optional). Returns `docId`. | No |
| `list_docs` | List documents (id, title, last opened, whether shared). | No |
| `get_doc` | Read the current Markdown, including collaborators' edits. Returns `markdown` and `hash`. | No |
| `update_doc` | Replace the document's Markdown; only changed parts are written. Needs `baseHash` from `get_doc`; if the document changed since, it fails with `CONFLICT` — call `get_doc` again and retry. History shows "AI: cập nhật". | No |
| `share_doc` | Ask to create a share link (`role`: `view` or `edit`, default `view`; `expiresInDays`: 7, 30 or `null`, default 7). Returns the URL. | **Always asks** |
| `list_links` | List a document's share links (prefix, role, expiry, revoked). | No |
| `revoke_link` | Ask to revoke a link by `tokenPrefix` (6 characters). | **Always asks** |

`share_doc` and `revoke_link` always show a confirmation dialog in MD Reader; nothing happens unless you click Allow. The dialog closes by itself after 100 seconds, which counts as a refusal.

## 6. Example prompts

- "Write these meeting notes up as a Markdown document and open it in MD Reader."
- "Read the 'Q4 plan' document in MD Reader and rewrite the risks section more clearly."
- "List the documents I opened recently."
- "Create a view-only link that expires in 7 days for this document."

## 7. Limits and troubleshooting

Limits: Markdown up to 2,000,000 characters; title 1-200 characters; at most 4 concurrent connections; the bridge uses a `127.0.0.1` port in the range 47821-47830 (first free one). Per-call timeout is 30 seconds, 120 seconds for `share_doc` and `revoke_link`; waiting for the extension to connect takes up to 35 seconds.

| Error | Cause / fix |
|---|---|
| `NOT_CONNECTED` | Chrome with MD Reader is not open, or AI connection is off. Open Chrome and turn on Settings → AI connection. |
| `NOT_PAIRED` | The client is not paired or was revoked. Accept the pairing dialog; if revoked, turn AI connection off and on after 60 seconds. |
| `TIMEOUT` | The extension did not answer in time (or a confirmation dialog went unanswered). Retry. |
| `CONFLICT` | `update_doc` with a stale `baseHash`. Call `get_doc` again. |
| `INVALID_ARGS` | Bad arguments (for example `baseHash` must be 64 lowercase hex characters). |
| Port busy | All 10 ports 47821-47830 are taken: the server reports `no free port`. Stop the process holding them and run again. |

## 8. Privacy

Every read/write happens between the AI client on your computer and your own Chrome. Only when you click Allow on `share_doc` is that document's content sent to the sharing server, exactly as if you pressed Share in MD Reader. Your AI client still processes whatever it reads under its own provider's policy.
