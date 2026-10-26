import type * as Y from 'yjs'
import { textHash, validateToolArgs, type BridgeRequest, type BridgeResponse, type BridgeErrorCode } from '@md-reader/core/bridge'

export interface ExecSession { docId: string; title: string; yText: Y.Text; shared: boolean; synced: boolean }

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
    let s = get()
    if (!s || s.docId !== docId) return fail(req.id, 'NOT_FOUND', 'document is not open in this tab')
    let waited = 0
    while (!s.synced) {
      if (waited >= waitMs) return fail(req.id, 'TIMEOUT', 'document is still loading')
      await sleep(pollMs)
      waited += pollMs
      s = get()
      if (!s || s.docId !== docId) return fail(req.id, 'NOT_FOUND', 'document is not open in this tab')
    }
    if (req.tool === 'get_doc') {
      const markdown = s.yText.toString()
      return { type: 'res', id: req.id, ok: true, result: { docId: s.docId, title: s.title, markdown, hash: await textHash(markdown), shared: s.shared } } as BridgeResponse
    }
    return fail(req.id, 'INTERNAL', 'not implemented yet')
  }
}
