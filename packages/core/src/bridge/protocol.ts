export const BRIDGE_PROTOCOL = 1
export const BRIDGE_PORTS: readonly number[] = Array.from({ length: 10 }, (_, i) => 47821 + i)
export const BRIDGE_MAX_MARKDOWN = 2_000_000
export const BRIDGE_MAX_TITLE = 200

export type BridgeTool = 'publish_doc' | 'list_docs' | 'get_doc' | 'update_doc' | 'share_doc' | 'list_links' | 'revoke_link'
export const BRIDGE_TOOLS: readonly BridgeTool[] = ['publish_doc', 'list_docs', 'get_doc', 'update_doc', 'share_doc', 'list_links', 'revoke_link']

export type BridgeErrorCode = 'NOT_CONNECTED' | 'NOT_PAIRED' | 'DENIED' | 'TIMEOUT' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID_ARGS' | 'SHARE_FAILED' | 'INTERNAL'
const ERROR_CODES: readonly string[] = ['NOT_CONNECTED', 'NOT_PAIRED', 'DENIED', 'TIMEOUT', 'NOT_FOUND', 'CONFLICT', 'INVALID_ARGS', 'SHARE_FAILED', 'INTERNAL']

export interface PublishDocArgs { title: string; markdown: string; open?: boolean }
export interface PublishDocResult { docId: string }
export interface ListDocsResult { docs: Array<{ docId: string; title: string; lastOpenedAt: number; shared: boolean }> }
export interface GetDocArgs { docId: string }
export interface GetDocResult { docId: string; title: string; markdown: string; hash: string; shared: boolean }
export interface UpdateDocArgs { docId: string; markdown: string; baseHash: string }
export interface UpdateDocResult { hash: string }
export interface ShareDocArgs { docId: string; role: 'view' | 'edit'; expiresInDays: 7 | 30 | null }
export interface ShareDocResult { url: string; tokenPrefix: string; expiresAt: number | null }
export interface ListLinksArgs { docId: string }
export interface ListLinksResult { links: Array<{ tokenPrefix: string; role: 'view' | 'edit'; label: string; expiresAt: number | null; revokedAt: number | null }> }
export interface RevokeLinkArgs { docId: string; tokenPrefix: string }
export interface RevokeLinkResult { revoked: boolean }
export interface BridgeArgsMap { publish_doc: PublishDocArgs; list_docs: Record<string, never>; get_doc: GetDocArgs; update_doc: UpdateDocArgs; share_doc: ShareDocArgs; list_links: ListLinksArgs; revoke_link: RevokeLinkArgs }
export interface BridgeResultMap { publish_doc: PublishDocResult; list_docs: ListDocsResult; get_doc: GetDocResult; update_doc: UpdateDocResult; share_doc: ShareDocResult; list_links: ListLinksResult; revoke_link: RevokeLinkResult }

export interface BridgeHello { type: 'hello'; protocol: 1; client: string; pairKey: string }
export interface BridgeRequest { type: 'req'; id: string; tool: BridgeTool; args: unknown }
export interface BridgeWelcome { type: 'welcome'; paired: boolean }
export interface BridgeReject { type: 'reject'; code: 'DENIED' | 'PROTOCOL' }
export interface BridgePing { type: 'ping' }
export type BridgeResponse =
  | { type: 'res'; id: string; ok: true; result: unknown }
  | { type: 'res'; id: string; ok: false; error: { code: BridgeErrorCode; message: string } }
export type BridgeMessage = BridgeHello | BridgeRequest | BridgeWelcome | BridgeReject | BridgeResponse | BridgePing

function str(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.length >= min && v.length <= max
}

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  let v: unknown
  try { v = JSON.parse(raw) } catch { return null }
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  switch (o.type) {
    case 'hello':
      if (o.protocol !== 1 || !str(o.client, 1, 100) || !str(o.pairKey, 16, 200)) return null
      return { type: 'hello', protocol: 1, client: o.client, pairKey: o.pairKey }
    case 'req':
      if (!str(o.id, 1, 64) || !BRIDGE_TOOLS.includes(o.tool as BridgeTool) || !('args' in o)) return null
      return { type: 'req', id: o.id, tool: o.tool as BridgeTool, args: o.args }
    case 'welcome':
      if (typeof o.paired !== 'boolean') return null
      return { type: 'welcome', paired: o.paired }
    case 'reject':
      if (o.code !== 'DENIED' && o.code !== 'PROTOCOL') return null
      return { type: 'reject', code: o.code }
    case 'ping':
      return { type: 'ping' }
    case 'res': {
      if (typeof o.id !== 'string' || typeof o.ok !== 'boolean') return null
      if (o.ok) {
        if (!('result' in o)) return null
        return { type: 'res', id: o.id, ok: true, result: o.result }
      }
      const e = o.error
      if (typeof e !== 'object' || e === null) return null
      const { code, message } = e as Record<string, unknown>
      if (typeof code !== 'string' || !ERROR_CODES.includes(code) || typeof message !== 'string') return null
      return { type: 'res', id: o.id, ok: false, error: { code: code as BridgeErrorCode, message } }
    }
    default:
      return null
  }
}
