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
    registerActor(fork, actor)
    applyTextChange(getSource(fork), next)
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(fork, sv), origin)
    return true
  } finally {
    fork.destroy()
  }
}
