import { hashText } from '../doc/hash.js'
export const BRIDGE_PROTOCOL = 1
export const BRIDGE_PROTOCOL_V2 = 2
export const BRIDGE_PORTS: readonly number[] = Array.from({ length: 10 }, (_, i) => 47821 + i)
export const BRIDGE_MAX_MARKDOWN = 2_000_000
export const BRIDGE_MAX_TITLE = 200
export const BRIDGE_MAX_CLIENT = 40
export const BRIDGE_MAX_PAYLOAD = 16 * 1024 * 1024
export const BRIDGE_MAX_CONNECTIONS = 4
export const KNOWN_EXTENSION_IDS: readonly string[] = ['ojcemoafaibjfghljkbagnkbgljakbji'] // ID store thêm ở 10o

export function isAllowedExtensionOrigin(origin: string, ids: readonly string[] = KNOWN_EXTENSION_IDS): boolean {
  return ids.some((id) => origin === `chrome-extension://${id}`)
}

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
export interface BridgeHelloV2 { type: 'hello'; protocol: 2; client: string; serverKey: string; nonce: string }
export interface BridgeAuth { type: 'auth'; extKey: string; nonce: string; sig: string }
export interface BridgeAuthOk { type: 'auth-ok'; sig: string }
export interface BridgeRequest { type: 'req'; id: string; tool: BridgeTool; args: unknown }
export interface BridgeWelcome { type: 'welcome'; paired: boolean }
export interface BridgeReject { type: 'reject'; code: 'DENIED' | 'PROTOCOL' }
export interface BridgePing { type: 'ping' }
export type BridgeResponse =
  | { type: 'res'; id: string; ok: true; result: unknown }
  | { type: 'res'; id: string; ok: false; error: { code: BridgeErrorCode; message: string } }
export type BridgeMessage = BridgeHello | BridgeRequest | BridgeWelcome | BridgeReject | BridgeResponse | BridgePing | BridgeHelloV2 | BridgeAuth | BridgeAuthOk

function b64u(v: unknown, min: number, max: number): v is string {
  return str(v, min, max) && /^[A-Za-z0-9_-]+$/.test(v)
}

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
      if (o.protocol === 2) {
        if (!str(o.client, 1, 100) || !b64u(o.serverKey, 80, 200) || !b64u(o.nonce, 43, 43)) return null
        return { type: 'hello', protocol: 2, client: o.client, serverKey: o.serverKey, nonce: o.nonce }
      }
      if (o.protocol !== 1 || !str(o.client, 1, 100) || !str(o.pairKey, 16, 200)) return null
      return { type: 'hello', protocol: 1, client: o.client, pairKey: o.pairKey }
    case 'auth':
      if (!b64u(o.extKey, 80, 200) || !b64u(o.nonce, 43, 43) || !b64u(o.sig, 80, 100)) return null
      return { type: 'auth', extKey: o.extKey, nonce: o.nonce, sig: o.sig }
    case 'auth-ok':
      if (!b64u(o.sig, 80, 100)) return null
      return { type: 'auth-ok', sig: o.sig }
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

type Validated<T extends BridgeTool> = { ok: true; args: BridgeArgsMap[T] } | { ok: false; message: string }

export function textHash(text: string): Promise<string> {
  return hashText(text)
}

export function validateToolArgs<T extends BridgeTool>(tool: T, args: unknown): Validated<T> {
  const fail = (message: string): Validated<T> => ({ ok: false, message })
  const ok = (a: unknown): Validated<T> => ({ ok: true, args: a as BridgeArgsMap[T] })
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return fail('args must be an object')
  const o = args as Record<string, unknown>
  const docIdOk = str(o.docId, 1, 64)
  const mdOk = str(o.markdown, 0, BRIDGE_MAX_MARKDOWN)
  switch (tool) {
    case 'publish_doc': {
      if (typeof o.title !== 'string' || !str(o.title.trim(), 1, BRIDGE_MAX_TITLE)) return fail(`title must be 1..${BRIDGE_MAX_TITLE} characters`)
      if (!mdOk) return fail(`markdown must be a string up to ${BRIDGE_MAX_MARKDOWN} characters`)
      if (o.open !== undefined && typeof o.open !== 'boolean') return fail('open must be a boolean')
      const r: PublishDocArgs = { title: o.title.trim(), markdown: o.markdown as string }
      if (o.open !== undefined) r.open = o.open
      return ok(r)
    }
    case 'list_docs':
      return ok({})
    case 'get_doc':
    case 'list_links':
      if (!docIdOk) return fail('docId must be 1..64 characters')
      return ok({ docId: o.docId })
    case 'update_doc':
      if (!docIdOk) return fail('docId must be 1..64 characters')
      if (!mdOk) return fail(`markdown must be a string up to ${BRIDGE_MAX_MARKDOWN} characters`)
      if (typeof o.baseHash !== 'string' || !/^[0-9a-f]{64}$/.test(o.baseHash)) return fail('baseHash must be 64 lowercase hex characters')
      return ok({ docId: o.docId, markdown: o.markdown, baseHash: o.baseHash })
    case 'share_doc': {
      if (!docIdOk) return fail('docId must be 1..64 characters')
      const role = o.role === undefined ? 'view' : o.role
      if (role !== 'view' && role !== 'edit') return fail("role must be 'view' or 'edit'")
      const exp = o.expiresInDays === undefined ? 7 : o.expiresInDays
      if (exp !== 7 && exp !== 30 && exp !== null) return fail('expiresInDays must be 7, 30 or null')
      return ok({ docId: o.docId, role, expiresInDays: exp })
    }
    case 'revoke_link':
      if (!docIdOk) return fail('docId must be 1..64 characters')
      if (!str(o.tokenPrefix, 6, 6)) return fail('tokenPrefix must be 6 characters')
      return ok({ docId: o.docId, tokenPrefix: o.tokenPrefix })
    default:
      return fail('unknown tool')
  }
}

/** Tên client là dữ liệu không tin cậy: bỏ ký tự điều khiển/bidi/zero-width, gộp khoảng trắng, cắt 40 code point. */
export function sanitizeClientName(raw: unknown): string {
  if (typeof raw !== 'string') return 'AI'
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const cut = Array.from(cleaned).slice(0, BRIDGE_MAX_CLIENT).join('').trim()
  return cut || 'AI'
}
