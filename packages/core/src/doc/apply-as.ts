import * as Y from 'yjs'
import { applyTextChange } from './apply.js'
import { registerActor } from './checkpoint.js'
import { getSource } from './doc.js'

/** Áp `next` vào source của `doc` như một client khác (clientID ngẫu nhiên do Yjs cấp, hoặc `opts.reuseClientId` do caller
 *  giữ cục bộ theo máy), ghi `actor` vào meta.actors, rồi đưa đúng phần cập nhật về `doc`. Trả false nếu text không đổi,
 *  ngược lại trả clientID đã dùng. Chỉ tái dùng id khi != doc.clientID và meta.actors[id] === actor. */
export function applyTextChangeAsActor(doc: Y.Doc, next: string, actor: string, origin?: unknown, opts?: { reuseClientId?: number }): false | number {
  const fork = new Y.Doc({ gc: false })
  try {
    Y.applyUpdate(fork, Y.encodeStateAsUpdate(doc))
    const sv = Y.encodeStateVector(doc)
    if (getSource(fork).toString() === next) return false
    const known = fork.getMap('meta').get('actors')
    const prior = opts?.reuseClientId
    if (typeof prior === 'number' && Number.isInteger(prior) && prior > 0 && prior !== doc.clientID && known instanceof Y.Map && known.get(String(prior)) === actor) {
      fork.clientID = prior
    }
    registerActor(fork, actor)
    applyTextChange(getSource(fork), next)
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(fork, sv), origin)
    return fork.clientID
  } finally {
    fork.destroy()
  }
}
