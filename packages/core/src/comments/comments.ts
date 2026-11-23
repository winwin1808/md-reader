import * as Y from 'yjs'

export const COMMENTS_ROOT = 'comments'
export const COMMENT_BODY_MAX = 4000
export const COMMENT_QUOTE_MAX = 300
export const COMMENT_AUTHOR_MAX = 40

export interface CommentAnchor {
  start: string
  end: string
  quote: string
}
export interface CommentEntry {
  v: 1
  thread: string | null
  author: string
  clientId: number
  ts: number
  body: string
  anchor?: CommentAnchor
}
export interface CommentState {
  resolved: boolean
  by: string
  clientId: number
  ts: number
}
export interface CommentReply {
  id: string
  author: string
  clientId: number
  ts: number
  body: string
}
export interface CommentThread {
  id: string
  author: string
  clientId: number
  ts: number
  body: string
  quote: string
  range: { from: number; to: number } | null
  resolved: boolean
  resolvedBy: string | null
  deleted: boolean
  replies: CommentReply[]
}

export function getComments(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(COMMENTS_ROOT)
}

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function rand8(): string {
  let s = ''
  while (s.length < 8) s += Math.random().toString(36).slice(2)
  return s.slice(0, 8)
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const C_KEY = /^c:(0|[1-9]\d{0,15}):[a-z0-9]{8}$/
const B64 = /^[A-Za-z0-9+/]+={0,2}$/

export function commentKeyClient(key: string): number | null {
  if (typeof key !== 'string') return null
  const k = key.startsWith('s:') ? key.slice(2) : key
  const m = C_KEY.exec(k)
  return m ? Number(m[1]) : null
}

function onlyKeys(o: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(o).every((k) => allowed.includes(k))
}

function isB64(v: unknown): boolean {
  return typeof v === 'string' && v.length <= 128 && B64.test(v)
}

export function validateCommentValue(key: string, value: unknown): string | null {
  try {
    if (typeof key !== 'string') return 'comment_key'
    if (key.startsWith('s:')) {
      if (!C_KEY.test(key.slice(2))) return 'comment_key'
      const v = value
      if (!isObj(v) || !onlyKeys(v, ['resolved', 'by', 'clientId', 'ts'])) return 'comment_shape'
      if (typeof v.resolved !== 'boolean') return 'comment_shape'
      if (typeof v.by !== 'string' || v.by.length > COMMENT_AUTHOR_MAX) return 'comment_shape'
      if (typeof v.clientId !== 'number' || !Number.isInteger(v.clientId) || v.clientId < 0) return 'comment_shape'
      if (typeof v.ts !== 'number' || !Number.isFinite(v.ts) || v.ts < 0) return 'comment_shape'
      return null
    }
    if (!C_KEY.test(key)) return 'comment_key'
    const v = value
    if (!isObj(v) || !onlyKeys(v, ['v', 'thread', 'author', 'body', 'ts', 'clientId', 'anchor'])) return 'comment_shape'
    if (v.v !== 1) return 'comment_shape'
    if (v.thread !== null && !(typeof v.thread === 'string' && C_KEY.test(v.thread))) return 'comment_shape'
    if (typeof v.author !== 'string' || v.author.length > COMMENT_AUTHOR_MAX) return 'comment_shape'
    if (typeof v.body !== 'string') return 'comment_shape'
    if (v.body.trim() === '' || v.body.length > COMMENT_BODY_MAX) return 'comment_body'
    if (typeof v.ts !== 'number' || !Number.isFinite(v.ts) || v.ts < 0) return 'comment_shape'
    if (typeof v.clientId !== 'number' || !Number.isInteger(v.clientId)) return 'comment_shape'
    if (v.clientId !== commentKeyClient(key)) return 'comment_client'
    const hasAnchor = Object.prototype.hasOwnProperty.call(v, 'anchor')
    if (hasAnchor !== (v.thread === null)) return 'comment_anchor'
    if (hasAnchor) {
      const a = v.anchor
      if (!isObj(a) || !onlyKeys(a, ['start', 'end', 'quote'])) return 'comment_anchor'
      if (!isB64(a.start) || !isB64(a.end)) return 'comment_anchor'
      if (typeof a.quote !== 'string' || a.quote.length > COMMENT_QUOTE_MAX) return 'comment_anchor'
    }
    return null
  } catch {
    return 'comment_shape'
  }
}

function isEntry(key: string, v: unknown): v is CommentEntry {
  return key.startsWith('c:') && validateCommentValue(key, v) === null
}

function isState(key: string, v: unknown): v is CommentState {
  return key.startsWith('s:') && validateCommentValue(key, v) === null
}

function newKey(doc: Y.Doc): string {
  return `c:${doc.clientID}:${rand8()}`
}

function requireBody(body: string): string {
  if (typeof body !== 'string') throw new RangeError('comment_empty')
  const cut = body.slice(0, COMMENT_BODY_MAX)
  if (cut.trim() === '') throw new RangeError('comment_empty')
  return cut
}

function hasRootThread(map: Y.Map<unknown>, threadId: string): boolean {
  if (!threadId.startsWith('c:')) return false
  const v = map.get(threadId)
  if (v === undefined) {
    // gốc đã xoá nhưng còn trả lời vẫn là thread hợp lệ
    for (const [k, e] of map.entries()) if (isEntry(k, e) && e.thread === threadId) return true
    return false
  }
  return isEntry(threadId, v) && v.thread === null
}

export function addComment(
  doc: Y.Doc,
  input: { author: string; body: string; from: number; to: number; now?: number },
): string {
  const source = doc.getText('source')
  const { from, to } = input
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= to || to > source.length) {
    throw new RangeError('comment_range')
  }
  const body = requireBody(input.body)
  const id = newKey(doc)
  const quote = source.toString().slice(from, to).slice(0, COMMENT_QUOTE_MAX)
  const entry: CommentEntry = {
    v: 1,
    thread: null,
    author: input.author.slice(0, COMMENT_AUTHOR_MAX),
    clientId: doc.clientID,
    ts: input.now ?? Date.now(),
    body,
    anchor: {
      start: toB64(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(source, from, 0))),
      end: toB64(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(source, to, -1))),
      quote,
    },
  }
  doc.transact(() => {
    getComments(doc).set(id, entry)
  })
  return id
}

export function replyComment(
  doc: Y.Doc,
  threadId: string,
  input: { author: string; body: string; now?: number },
): string {
  const map = getComments(doc)
  if (!hasRootThread(map, threadId)) throw new RangeError('comment_thread')
  const body = requireBody(input.body)
  const id = newKey(doc)
  const entry: CommentEntry = {
    v: 1,
    thread: threadId,
    author: input.author.slice(0, COMMENT_AUTHOR_MAX),
    clientId: doc.clientID,
    ts: input.now ?? Date.now(),
    body,
  }
  doc.transact(() => {
    map.set(id, entry)
  })
  return id
}

export function setResolved(doc: Y.Doc, threadId: string, resolved: boolean, by: string, now?: number): void {
  const map = getComments(doc)
  if (!hasRootThread(map, threadId)) throw new RangeError('comment_thread')
  const state: CommentState = {
    resolved,
    by: by.slice(0, COMMENT_AUTHOR_MAX),
    clientId: doc.clientID,
    ts: now ?? Date.now(),
  }
  doc.transact(() => {
    map.set(`s:${threadId}`, state)
  })
}

function hasReplies(map: Y.Map<unknown>, threadId: string, except?: string): boolean {
  for (const [k, e] of map.entries()) {
    if (k !== except && isEntry(k, e) && e.thread === threadId) return true
  }
  return false
}

export function deleteComment(doc: Y.Doc, id: string): void {
  const map = getComments(doc)
  const v = map.get(id)
  if (v === undefined) return
  doc.transact(() => {
    map.delete(id)
    if (!isEntry(id, v)) return
    if (v.thread === null) {
      if (!hasReplies(map, id)) map.delete(`s:${id}`)
    } else if (map.get(v.thread) === undefined && !hasReplies(map, v.thread)) {
      map.delete(`s:${v.thread}`)
    }
  })
}

function resolveRange(doc: Y.Doc, anchor: CommentAnchor): { from: number; to: number } | null {
  try {
    const a = Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(fromB64(anchor.start)), doc)
    const b = Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(fromB64(anchor.end)), doc)
    if (!a || !b || a.index >= b.index) return null
    return { from: a.index, to: b.index }
  } catch {
    return null
  }
}

export function listThreads(doc: Y.Doc): CommentThread[] {
  const map = getComments(doc)
  const roots = new Map<string, CommentEntry>()
  const replies = new Map<string, CommentReply[]>()
  for (const [key, val] of map.entries()) {
    if (!isEntry(key, val)) continue
    if (val.thread === null) {
      roots.set(key, val)
    } else {
      const list = replies.get(val.thread) ?? []
      list.push({ id: key, author: val.author, clientId: val.clientId, ts: val.ts, body: val.body })
      replies.set(val.thread, list)
    }
  }
  const ids = new Set<string>([...roots.keys(), ...replies.keys()])
  const threads: CommentThread[] = []
  for (const id of ids) {
    const rs = (replies.get(id) ?? []).sort((x, y) => x.ts - y.ts || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    const st = map.get(`s:${id}`)
    const state = isState(`s:${id}`, st) ? st : null
    const root = roots.get(id)
    const base = {
      resolved: state?.resolved ?? false,
      resolvedBy: state?.resolved ? state.by : null,
      replies: rs,
    }
    if (root) {
      threads.push({
        id,
        author: root.author,
        clientId: root.clientId,
        ts: root.ts,
        body: root.body,
        quote: root.anchor?.quote ?? '',
        range: root.anchor ? resolveRange(doc, root.anchor) : null,
        deleted: false,
        ...base,
      })
    } else {
      threads.push({
        id,
        author: '',
        clientId: 0,
        ts: rs[0]!.ts,
        body: '',
        quote: '',
        range: null,
        deleted: true,
        ...base,
      })
    }
  }
  threads.sort((x, y) => {
    const byId = x.id < y.id ? -1 : x.id > y.id ? 1 : 0
    if (x.range && y.range) return x.range.from - y.range.from || x.ts - y.ts || byId
    if (x.range) return -1
    if (y.range) return 1
    return x.ts - y.ts || byId
  })
  return threads
}
