import type * as Y from 'yjs'
import { applyTextChangeAsActor, buildShareUrl, type CheckpointTracker, type CreateLinkRequest, type ShareLink } from '@md-reader/core'
import type { ConfirmRequest } from '@md-reader/ui'
import { textHash, validateToolArgs, type BridgeRequest, type BridgeResponse, type BridgeErrorCode } from '@md-reader/core/bridge'

export const ORIGIN_MCP = 'mcp'
export const AI_CHECKPOINT_LABEL = 'AI: cập nhật'
export const DAY_MS = 86_400_000
export interface ExecShare {
  serverUrl: string
  enable(): Promise<unknown>
  createLink(req: CreateLinkRequest): Promise<ShareLink>
  revoke(prefix: string): Promise<void>
  refresh(): Promise<unknown>
  links(): ShareLink[]
  bound(): boolean
}
export interface ExecSession {
  docId: string; title: string; yText: Y.Text; shared: boolean; synced: boolean; checkpoints: CheckpointTracker | null; persisted: (() => Promise<void>) | null
  share: ExecShare | null
  confirm: ((c: ConfirmRequest, client: string) => Promise<boolean>) | null
}

const fail = (id: string, code: BridgeErrorCode, message: string): BridgeResponse => ({ type: 'res', id, ok: false, error: { code, message } })

export function createBridgeExecutor(
  get: () => ExecSession | null,
  opts: { waitMs?: number; pollMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): (req: BridgeRequest, client: string) => Promise<BridgeResponse> {
  const waitMs = opts.waitMs ?? 8000
  const pollMs = opts.pollMs ?? 100
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  return async (req, client) => {
    const v = validateToolArgs(req.tool, req.args)
    if (!v.ok) return fail(req.id, 'INVALID_ARGS', v.message)
    const docId = (v.args as { docId?: string }).docId
    const NOT_OPEN = 'document is not open in this tab'
    let s = get()
    if (s && s.docId !== docId) return fail(req.id, 'NOT_FOUND', NOT_OPEN)
    let waited = 0
    const ready = (x: ExecSession | null) => !!x && x.synced && (req.tool !== 'update_doc' || x.checkpoints !== null)
    while (!s || !ready(s)) {
      if (waited >= waitMs) return s ? fail(req.id, 'TIMEOUT', 'document is still loading') : fail(req.id, 'NOT_FOUND', NOT_OPEN)
      await sleep(pollMs)
      waited += pollMs
      s = get()
      if (s && s.docId !== docId) return fail(req.id, 'NOT_FOUND', NOT_OPEN)
    }
    if (req.tool === 'get_doc') {
      const markdown = s.yText.toString()
      return { type: 'res', id: req.id, ok: true, result: { docId: s.docId, title: s.title, markdown, hash: await textHash(markdown), shared: s.shared } } as BridgeResponse
    }
    if (req.tool === 'update_doc') {
      const { markdown, baseHash } = v.args as { markdown: string; baseHash: string }
      const cur = s.yText.toString()
      const curHash = await textHash(cur)
      if (curHash !== baseHash) return fail(req.id, 'CONFLICT', `document changed since baseHash; current hash ${curHash}`)
      if (s.yText.toString() !== cur) return fail(req.id, 'CONFLICT', `document changed since baseHash; current hash ${await textHash(s.yText.toString())}`)
      const doc = s.yText.doc
      if (!doc) return fail(req.id, 'INTERNAL', 'document has no Y.Doc')
      s.checkpoints?.flush('auto', 'Bạn')
      const changed = applyTextChangeAsActor(doc, markdown, 'AI', ORIGIN_MCP)
      if (changed) s.checkpoints?.flush(AI_CHECKPOINT_LABEL, 'AI', { force: true })
      const yText = s.yText
      await Promise.race([s.persisted?.() ?? Promise.resolve(), sleep(2000)])
      return { type: 'res', id: req.id, ok: true, result: { hash: await textHash(yText.toString()) } } as BridgeResponse
    }
    if (req.tool === 'share_doc' || req.tool === 'list_links' || req.tool === 'revoke_link') {
      const { share, confirm } = s
      if (!share || !confirm) return fail(req.id, 'INTERNAL', 'sharing unavailable')
      const CHANGED = 'document changed in tab before approval'
      const ok = (result: unknown) => ({ type: 'res', id: req.id, ok: true, result }) as BridgeResponse
      const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
      const ask = async (c: ConfirmRequest): Promise<BridgeResponse | null> => {
        try {
          return (await confirm(c, client)) ? null : fail(req.id, 'DENIED', 'user declined')
        } catch (e) {
          if (msg(e) === 'busy') return fail(req.id, 'DENIED', 'another request is waiting for the user')
          return msg(e) === 'timeout' ? fail(req.id, 'TIMEOUT', 'no answer from user') : fail(req.id, 'INTERNAL', msg(e))
        }
      }
      if (req.tool === 'list_links') {
        if (!share.bound()) return ok({ links: [] })
        try { await share.refresh() } catch (e) { return fail(req.id, 'SHARE_FAILED', msg(e)) }
        return ok({ links: share.links().map((l) => ({ tokenPrefix: l.tokenPrefix, role: l.role, label: l.label, expiresAt: l.expiresAt, revokedAt: l.revokedAt })) })
      }
      if (req.tool === 'share_doc') {
        const { role, expiresInDays } = v.args as { role: 'view' | 'edit'; expiresInDays: 7 | 30 | null }
        const denied = await ask({ kind: 'share', docTitle: s.title, role, expiresInDays })
        if (denied) return denied
        const s2 = get()
        if (!s2 || s2.docId !== s.docId || !s2.share) return fail(req.id, 'NOT_FOUND', CHANGED)
        const share2 = s2.share
        try {
          await share2.enable()
          const l = await share2.createLink({ role, expiresIn: expiresInDays === null ? null : expiresInDays * DAY_MS, label: `AI · ${client}`.slice(0, 60) })
          if (!l.token) return fail(req.id, 'SHARE_FAILED', 'no token returned')
          return ok({ url: buildShareUrl(share2.serverUrl, l.token), tokenPrefix: l.tokenPrefix, expiresAt: l.expiresAt })
        } catch (e) { return fail(req.id, 'SHARE_FAILED', msg(e)) }
      }
      const { tokenPrefix } = v.args as { tokenPrefix: string }
      const NOT_SHARED = 'document is not shared'
      if (!share.bound()) return fail(req.id, 'NOT_FOUND', NOT_SHARED)
      try { await share.refresh() } catch (e) { return fail(req.id, 'SHARE_FAILED', msg(e)) }
      if (!share.links().some((l) => l.tokenPrefix === tokenPrefix && !l.revokedAt)) return fail(req.id, 'NOT_FOUND', 'link not found')
      const denied = await ask({ kind: 'revoke', docTitle: s.title, tokenPrefix })
      if (denied) return denied
      const s2 = get()
      if (!s2 || s2.docId !== s.docId || !s2.share || !s2.share.bound()) return fail(req.id, 'NOT_FOUND', CHANGED)
      try { await s2.share.revoke(tokenPrefix) } catch (e) { return fail(req.id, 'SHARE_FAILED', msg(e)) }
      return ok({ revoked: true })
    }
    return fail(req.id, 'INTERNAL', 'not implemented yet')
  }
}
