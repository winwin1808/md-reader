import * as Y from 'yjs'
import { applyTextChange } from './apply.js'
import { registerActor } from './checkpoint.js'
import { getSource } from './doc.js'

/** Áp `next` vào source của `doc` như một client khác (clientID ngẫu nhiên do Yjs cấp, hoặc `opts.reuseClientId` do caller
 *  giữ cục bộ theo máy), ghi `actor` vào meta.actors, rồi đưa đúng phần cập nhật về `doc`. Trả false nếu text không đổi,
 *  ngược lại trả clientID đã dùng. Chỉ tái dùng id khi != doc.clientID và meta.actors[id] === actor. */
function forkAsActor(doc: Y.Doc, actor: string, reuse?: number): Y.Doc {
  const fork = new Y.Doc({ gc: false })
  Y.applyUpdate(fork, Y.encodeStateAsUpdate(doc))
  const known = fork.getMap('meta').get('actors')
  if (typeof reuse === 'number' && Number.isInteger(reuse) && reuse > 0 && reuse !== doc.clientID && known instanceof Y.Map && known.get(String(reuse)) === actor) {
    fork.clientID = reuse
  }
  return fork
}

export function applyTextChangeAsActor(doc: Y.Doc, next: string, actor: string, origin?: unknown, opts?: { reuseClientId?: number }): false | number {
  const fork = forkAsActor(doc, actor, opts?.reuseClientId)
  try {
    const sv = Y.encodeStateVector(doc)
    if (getSource(fork).toString() === next) return false
    registerActor(fork, actor)
    applyTextChange(getSource(fork), next)
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(fork, sv), origin)
    return fork.clientID
  } finally {
    fork.destroy()
  }
}

/** Chạy `fn` trên fork mang clientID tác giả; chỉ khi `fn` xong mới áp phần cập nhật về `doc`. */
export function commentAsActor<T>(
  doc: Y.Doc, actor: string, fn: (d: Y.Doc) => T, origin?: unknown, opts?: { reuseClientId?: number },
): { result: T; clientId: number } {
  const fork = forkAsActor(doc, actor, opts?.reuseClientId)
  try {
    const sv = Y.encodeStateVector(doc)
    registerActor(fork, actor)
    const result = fn(fork)
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(fork, sv), origin)
    return { result, clientId: fork.clientID }
  } finally {
    fork.destroy()
  }
}
