import type * as Y from 'yjs'
import { textHash, validateToolArgs, type BridgeRequest, type BridgeResponse, type BridgeErrorCode } from '@md-reader/core/bridge'

export interface ExecSession { docId: string; title: string; yText: Y.Text; shared: boolean }

const fail = (id: string, code: BridgeErrorCode, message: string): BridgeResponse => ({ type: 'res', id, ok: false, error: { code, message } })

export function createBridgeExecutor(get: () => ExecSession | null): (req: BridgeRequest) => Promise<BridgeResponse> {
  return async (req) => {
    const v = validateToolArgs(req.tool, req.args)
    if (!v.ok) return fail(req.id, 'INVALID_ARGS', v.message)
    const docId = (v.args as { docId?: string }).docId
    const s = get()
    if (!s || s.docId !== docId) return fail(req.id, 'NOT_FOUND', 'document is not open in this tab')
    if (req.tool === 'get_doc') {
      const markdown = s.yText.toString()
      return { type: 'res', id: req.id, ok: true, result: { docId: s.docId, title: s.title, markdown, hash: await textHash(markdown), shared: s.shared } } as BridgeResponse
    }
    return fail(req.id, 'INTERNAL', 'not implemented yet')
  }
}
