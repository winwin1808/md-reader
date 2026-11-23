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

function isEntry(v: unknown): v is CommentEntry {
  if (!isObj(v)) return false
  if (v.thread !== null && typeof v.thread !== 'string') return false
  if (typeof v.author !== 'string' || typeof v.body !== 'string') return false
  if (typeof v.ts !== 'number' || typeof v.clientId !== 'number') return false
  if (v.thread === null) {
    const a = v.anchor
    if (!isObj(a) || typeof a.start !== 'string' || typeof a.end !== 'string' || typeof a.quote !== 'string') {
      return false
    }
  }
  return true
}

function isState(v: unknown): v is CommentState {
  return isObj(v) && typeof v.resolved === 'boolean' && typeof v.by === 'string'
}

function newKey(doc: Y.Doc): string {
  return `c:${doc.clientID}:${rand8()}`
}

function requireBody(body: string): string {
  if (typeof body !== 'string' || body.trim() === '') throw new RangeError('comment_empty')
  return body.slice(0, COMMENT_BODY_MAX)
}

function hasRootThread(map: Y.Map<unknown>, threadId: string): boolean {
  if (!threadId.startsWith('c:')) return false
  const v = map.get(threadId)
  if (v === undefined) {
    // gốc đã xoá nhưng còn trả lời vẫn là thread hợp lệ
    for (const [, e] of map.entries()) if (isEntry(e) && e.thread === threadId) return true
    return false
  }
  return isEntry(v) && v.thread === null
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
    if (k !== except && isEntry(e) && e.thread === threadId) return true
  }
  return false
}

export function deleteComment(doc: Y.Doc, id: string): void {
  const map = getComments(doc)
  const v = map.get(id)
  if (v === undefined) return
  doc.transact(() => {
    map.delete(id)
    if (!isEntry(v)) return
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
    if (!key.startsWith('c:') || !isEntry(val)) continue
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
    const state = isState(st) ? st : null
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
    if (x.range && y.range) return x.range.from - y.range.from || x.ts - y.ts
    if (x.range) return -1
    if (y.range) return 1
    return x.ts - y.ts
  })
  return threads
}
