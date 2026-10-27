# le-sach-mcp

MCP server for **MD Reader (Lề sách)** — lets AI apps (Claude Desktop, Claude Code, Cursor…) publish, read and edit Markdown documents in the MD Reader Chrome extension **on this machine**.

- Runs locally over stdio; talks to the extension through a WebSocket bridge on `127.0.0.1:47821–47830`.
- The bridge is **off by default** in the extension (Settings → AI connection) and each AI app is paired once: within 10 minutes of starting, approve the pairing dialog and check its identifier (`ABCD-1234`) matches the `đã ghép cặp` line in your AI app's log.
- Pairing uses ECDSA P-256 keys on both sides (protocol v2); no secret crosses the loopback connection. The server key lives in `~/.config/md-reader/mcp.json` (mode 600); delete it to pair again from scratch.
- `update_doc` changes the document inside MD Reader only; it is written to your file on disk only when you press Save.
- Sharing a document (`share_doc`) or revoking a link (`revoke_link`) always asks you in the browser first.

```bash
npx -y le-sach-mcp
```

Claude Code: `claude mcp add md-reader -- npx -y le-sach-mcp`

Claude Desktop / Cursor:

```json
{ "mcpServers": { "md-reader": { "command": "npx", "args": ["-y", "le-sach-mcp"] } } }
```

Tools: `publish_doc`, `list_docs`, `get_doc`, `update_doc`, `share_doc`, `list_links`, `revoke_link`.

Full guide: https://github.com/winwin1808/md-reader/blob/main/docs/MCP.en.md · Requires Node ≥ 20. License: MIT.
