import type * as Y from 'yjs'
import { applyTextChange, type CheckpointTracker } from '@md-reader/core'
import { textHash, validateToolArgs, type BridgeRequest, type BridgeResponse, type BridgeErrorCode } from '@md-reader/core/bridge'

export const ORIGIN_MCP = 'mcp'
export const AI_CHECKPOINT_LABEL = 'AI: cập nhật'
export interface ExecSession { docId: string; title: string; yText: Y.Text; shared: boolean; synced: boolean; checkpoints: CheckpointTracker | null }

const fail = (id: string, code: BridgeErrorCode, message: string): BridgeResponse => ({ type: 'res', id, ok: false, error: { code, message } })

export function createBridgeExecutor(
  get: () => ExecSession | null,
  opts: { waitMs?: number; pollMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): (req: BridgeRequest) => Promise<BridgeResponse> {
  const waitMs = opts.waitMs ?? 8000
  const pollMs = opts.pollMs ?? 100
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  return async (req) => {
    const v = validateToolArgs(req.tool, req.args)
    if (!v.ok) return fail(req.id, 'INVALID_ARGS', v.message)
    const docId = (v.args as { docId?: string }).docId
    const NOT_OPEN = 'document is not open in this tab'
    let s = get()
    if (s && s.docId !== docId) return fail(req.id, 'NOT_FOUND', NOT_OPEN)
    let waited = 0
    while (!s || !s.synced) {
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
      s.checkpoints?.flush('auto', 'Bạn')
      const changed = applyTextChange(s.yText, markdown, ORIGIN_MCP)
      if (changed) s.checkpoints?.flush(AI_CHECKPOINT_LABEL, 'AI', { force: true })
      return { type: 'res', id: req.id, ok: true, result: { hash: await textHash(s.yText.toString()) } } as BridgeResponse
    }
    return fail(req.id, 'INTERNAL', 'not implemented yet')
  }
}
