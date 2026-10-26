import { validateToolArgs } from '@md-reader/core/bridge'
import type { BridgeRequest, BridgeResponse, BridgeErrorCode, BridgeResultMap } from '@md-reader/core/bridge'
import type { createRecord, writeDocText, DocRecord } from '../app/doc-registry'
import { BRIDGE_EXEC_MSG, type ExecMsg } from '../shared/bridge-msg'

export interface RouteDeps {
  createRecord: typeof createRecord
  writeDocText: typeof writeDocText
  listRecent(limit: number): Promise<DocRecord[]>
  getRecord(docId: string): Promise<DocRecord | null>
  docUrl(docId: string): Promise<string>
  findTab(docId: string): Promise<number | null>
  openTab(url: string, active: boolean): Promise<number>
  closeTab(id: number): Promise<void>
  waitReady(docId: string, tabId: number, ms: number): Promise<boolean>
  sendToTab(tabId: number, msg: ExecMsg): Promise<BridgeResponse>
}

const ok = (id: string, result: unknown): BridgeResponse => ({ type: 'res', id, ok: true, result })
const fail = (id: string, code: BridgeErrorCode, message: string): BridgeResponse => ({ type: 'res', id, ok: false, error: { code, message } })

export function createExecuteInApp(deps: RouteDeps): (req: BridgeRequest) => Promise<BridgeResponse> {
  return async (req) => {
    const v = validateToolArgs(req.tool, req.args)
    if (!v.ok) return fail(req.id, 'INVALID_ARGS', v.message)

    if (req.tool === 'publish_doc') {
      const a = v.args as { title: string; markdown: string; open?: boolean }
      let docId: string
      try {
        const rec = await deps.createRecord({ title: a.title, originKind: 'drop', originPath: null })
        await deps.writeDocText(rec, a.markdown, 'replace')
        docId = rec.docId
      } catch (err) {
        return fail(req.id, 'INTERNAL', String((err as Error)?.message ?? err))
      }
      if (a.open !== false) {
        try { await deps.openTab(await deps.docUrl(docId), true) } catch { /* document is saved; opening is best effort */ }
      }
      const result: BridgeResultMap['publish_doc'] = { docId }
      return ok(req.id, result)
    }

    if (req.tool === 'list_docs') {
      try {
        const docs = (await deps.listRecent(200)).map((r) => ({ docId: r.docId, title: r.title, lastOpenedAt: r.lastOpenedAt, shared: !!r.room }))
        const result: BridgeResultMap['list_docs'] = { docs }
        return ok(req.id, result)
      } catch (err) {
        return fail(req.id, 'INTERNAL', String((err as Error)?.message ?? err))
      }
    }

    const docId = (v.args as { docId: string }).docId
    try {
      if (!(await deps.getRecord(docId))) return fail(req.id, 'NOT_FOUND', 'Document not found')
      let tab = await deps.findTab(docId)
      let opened = false
      try {
        if (tab === null) {
          tab = await deps.openTab(await deps.docUrl(docId), false)
          opened = true
          if (!(await deps.waitReady(docId, tab, 10_000))) return fail(req.id, 'TIMEOUT', 'MD Reader tab did not load the document in time')
        }
        return await deps.sendToTab(tab, { type: BRIDGE_EXEC_MSG, req })
      } catch (err) {
        return fail(req.id, 'INTERNAL', String((err as Error)?.message ?? err))
      } finally {
        if (opened && tab !== null && (req.tool === 'get_doc' || req.tool === 'list_links')) {
          try { await deps.closeTab(tab) } catch { /* ignore */ }
        }
      }
    } catch (err) {
      return fail(req.id, 'INTERNAL', String((err as Error)?.message ?? err))
    }
  }
}
