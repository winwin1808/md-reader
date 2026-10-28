import * as Y from 'yjs'
import { applyTextChange } from './apply.js'
import { registerActor } from './checkpoint.js'
import { getSource } from './doc.js'

/** Áp `next` vào source của `doc` như một client khác (clientID mới, ngẫu nhiên do Yjs cấp), ghi `actor` vào meta.actors
 *  cho clientID đó, rồi đưa đúng phần cập nhật về `doc` bằng `Y.applyUpdate(doc, update, origin)`. Trả false nếu text không đổi. */
export function applyTextChangeAsActor(doc: Y.Doc, next: string, actor: string, origin?: unknown): boolean {
  const fork = new Y.Doc({ gc: false })
  try {
    Y.applyUpdate(fork, Y.encodeStateAsUpdate(doc))
    const sv = Y.encodeStateVector(doc)
    if (getSource(fork).toString() === next) return false
    const meta = fork.getMap('meta')
    const mcp = meta.get('mcpActors')
    const prior = mcp instanceof Y.Map ? (mcp.get(actor) as string | undefined) : undefined
    const known = meta.get('actors')
    // Chỉ tái dùng clientID mà chính đường này đã tạo (có trong mcpActors) và vẫn ánh xạ đúng tên.
    if (prior && /^\d+$/.test(prior) && Number(prior) !== doc.clientID && known instanceof Y.Map && known.get(prior) === actor) {
      fork.clientID = Number(prior)
    } else {
      fork.transact(() => {
        const m = mcp instanceof Y.Map ? (mcp as Y.Map<string>) : new Y.Map<string>()
        if (!(mcp instanceof Y.Map)) meta.set('mcpActors', m)
        m.set(actor, String(fork.clientID))
      })
    }
    registerActor(fork, actor)
    applyTextChange(getSource(fork), next)
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(fork, sv), origin)
    return true
  } finally {
    fork.destroy()
  }
}
