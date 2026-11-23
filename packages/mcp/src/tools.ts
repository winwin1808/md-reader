import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { validateToolArgs, BRIDGE_MAX_TITLE, BRIDGE_MAX_MARKDOWN, BRIDGE_MAX_COMMENT, type BridgeTool } from '@md-reader/core/bridge'
import { BridgeCallError, type BridgeServer } from './bridge-server'

export type BridgeLike = Pick<BridgeServer, 'call'>

type ToolResult = { isError?: true; content: Array<{ type: 'text'; text: string }> }

const text = (t: string, isError?: true): ToolResult =>
  isError ? { isError, content: [{ type: 'text', text: t }] } : { content: [{ type: 'text', text: t }] }

const COMMENT_TOOLS = new Set<BridgeTool>(['list_comments', 'reply_comment', 'resolve_comment'])
const COMMENT_TIMEOUT_HINT =
  'No answer from MD Reader. Comment tools need MD Reader extension 1.6.0 or newer — update the extension (chrome://extensions → Update) and try again.'

async function run(bridge: BridgeLike, tool: BridgeTool, args: unknown): Promise<ToolResult> {
  try {
    const v = validateToolArgs(tool, args)
    if (!v.ok) return text(`INVALID_ARGS: ${v.message}`, true)
    const result = await bridge.call(tool, v.args as never)
    return text(JSON.stringify(result, null, 2))
  } catch (e) {
    if (e instanceof BridgeCallError && e.code === 'TIMEOUT' && COMMENT_TOOLS.has(tool)) return text(`TIMEOUT: ${COMMENT_TIMEOUT_HINT}`, true)
    if (e instanceof BridgeCallError) return text(`${e.code}: ${e.message}`, true)
    return text(`INTERNAL: ${e instanceof Error ? e.message : String(e)}`, true)
  }
}

export function registerTools(server: McpServer, bridge: BridgeLike): void {
  const docId = z.string().min(1).max(64)
  const def = (tool: BridgeTool, description: string, inputSchema: z.ZodRawShape) =>
    server.registerTool(tool, { description, inputSchema }, (args: unknown) => run(bridge, tool, args))

  def(
    'publish_doc',
    'Create a new document in the MD Reader Chrome extension on this computer and open it in a tab. The document stays on this computer; nothing is uploaded. Returns docId.',
    { title: z.string().min(1).max(BRIDGE_MAX_TITLE), markdown: z.string().max(BRIDGE_MAX_MARKDOWN), open: z.boolean().optional() },
  )
  def('list_docs', 'List documents stored in MD Reader on this computer (id, title, last opened, whether shared).', {})
  def(
    'get_doc',
    'Read the current Markdown of a document, including edits made by collaborators. The document lives on this computer. Returns markdown and a hash to pass to update_doc.',
    { docId },
  )
  def(
    'update_doc',
    "Replace the document's Markdown. Pass baseHash from get_doc; if the document changed since, the call fails with CONFLICT — call get_doc again and retry. Only the changed parts are written.",
    { docId, markdown: z.string().max(BRIDGE_MAX_MARKDOWN), baseHash: z.string() },
  )
  def(
    'share_doc',
    'Ask the user to create a share link. MD Reader shows a confirmation dialog; nothing is shared unless the user clicks Allow. Returns the link URL.',
    {
      docId,
      role: z.enum(['view', 'edit']).optional(),
      expiresInDays: z.union([z.literal(7), z.literal(30), z.null()]).optional(),
    },
  )
  def('list_links', 'List share links of a document (prefix, role, expiry, revoked).', { docId })
  def(
    'revoke_link',
    'Ask the user to revoke a share link (confirmation dialog in MD Reader); nothing is revoked unless the user clicks Allow.',
    { docId, tokenPrefix: z.string().length(6) },
  )
  def(
    'list_comments',
    'List reviewer comments on a document (open ones by default). Each has quote (text when commented), currentText and line (where that text is now; null if it was deleted), body and replies. Typical flow: list_comments → fix the text with get_doc + update_doc → resolve_comment with a short reply saying what you changed.',
    { docId, status: z.enum(['open', 'all']).optional() },
  )
  def(
    'reply_comment',
    'Reply to a comment thread without resolving it. Use to ask a question or explain why you did not change something.',
    { docId, threadId: z.string().min(1).max(64), body: z.string().min(1).max(BRIDGE_MAX_COMMENT) },
  )
  def(
    'resolve_comment',
    'Mark a comment thread resolved after you addressed it. Pass reply to leave a short note of what you changed (posted before resolving).',
    { docId, threadId: z.string().min(1).max(64), reply: z.string().min(1).max(BRIDGE_MAX_COMMENT).optional() },
  )
}
