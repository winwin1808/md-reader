# le-sach-mcp

MCP server for **MD Reader (Lề sách)** — lets AI apps (Claude Desktop, Claude Code, Cursor…) publish, read and edit Markdown documents in the MD Reader Chrome extension **on this machine**.

- Runs locally over stdio; talks to the extension through a WebSocket bridge on `127.0.0.1:47821–47830`.
- The bridge is **off by default** in the extension (Settings → AI connection) and each AI app is paired once.
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
