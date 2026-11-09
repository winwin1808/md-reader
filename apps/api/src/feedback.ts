export const FEEDBACK_KINDS = ['uninstall', 'bug', 'idea'] as const
export const UNINSTALL_REASONS = ['not_needed', 'missing_feature', 'bugs', 'hard_to_use', 'privacy', 'switched', 'other'] as const
export const MAX_FEEDBACK_MESSAGE = 2000
export const MAX_FEEDBACK_BODY = 8192
export const FEEDBACK_TTL_MS = 180 * 86_400_000
export const FEEDBACK_PRUNE_BATCH = 500

export interface FeedbackInput {
  kind: (typeof FEEDBACK_KINDS)[number]
  reason: (typeof UNINSTALL_REASONS)[number] | null
  message: string
  email: string | null
  version: string | null
  browser: string | null
  locale: 'vi' | 'en' | null
}
export interface FeedbackRow extends FeedbackInput { id: number; createdAt: number }

const has = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v)

function short(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = Array.from(v.replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, 64).join('')
  return s === '' ? null : s
}

export function parseFeedback(body: unknown): FeedbackInput | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  if (!has(FEEDBACK_KINDS, b.kind)) return null
  const kind = b.kind

  let reason: FeedbackInput['reason'] = null
  if (kind === 'uninstall') {
    if (!has(UNINSTALL_REASONS, b.reason)) return null
    reason = b.reason
  } else if (b.reason !== undefined && b.reason !== null) {
    if (!has(UNINSTALL_REASONS, b.reason)) return null
    reason = b.reason
  }

  let message = ''
  if (b.message !== undefined) {
    if (typeof b.message !== 'string') return null
    message = b.message.trim()
  }
  if (message.length > MAX_FEEDBACK_MESSAGE) return null
  if (message === '' && kind !== 'uninstall') return null

  let email: string | null = null
  if (b.email !== undefined && b.email !== null) {
    if (typeof b.email !== 'string') return null
    const e = b.email.trim()
    if (e !== '') {
      if (!e.includes('@') || e.length > 254 || /[\s\u0000-\u001f\u007f]/.test(e)) return null
      email = e
    }
  }

  return {
    kind, reason, message, email,
    version: short(b.version),
    browser: short(b.browser),
    locale: b.locale === 'vi' || b.locale === 'en' ? b.locale : null,
  }
}

export interface FeedbackStore {
  add(f: FeedbackInput): Promise<void>
  list(opts: { limit: number; before?: number }): Promise<FeedbackRow[]>
  prune(beforeMs: number): Promise<number>
}

export class MemoryFeedbackStore implements FeedbackStore {
  private rows: FeedbackRow[] = []
  private seq = 0
  constructor(private now: () => number = Date.now) {}
  async add(f: FeedbackInput): Promise<void> {
    this.rows.push({ ...f, id: ++this.seq, createdAt: this.now() })
  }
  async list(opts: { limit: number; before?: number }): Promise<FeedbackRow[]> {
    const { before } = opts
    return this.rows
      .filter((r) => before === undefined || r.id < before)
      .sort((a, b) => b.id - a.id)
      .slice(0, opts.limit)
  }
  async prune(beforeMs: number): Promise<number> {
    const old = this.rows
      .filter((r) => r.createdAt < beforeMs)
      .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
      .slice(0, FEEDBACK_PRUNE_BATCH)
    const ids = new Set(old.map((r) => r.id))
    this.rows = this.rows.filter((r) => !ids.has(r.id))
    return old.length
  }
}

interface Row {
  id: number; kind: FeedbackRow['kind']; reason: FeedbackRow['reason']; message: string
  email: string | null; version: string | null; browser: string | null
  locale: FeedbackRow['locale']; created_at: number
}

export class D1FeedbackStore implements FeedbackStore {
  constructor(private db: D1Database, private now: () => number = Date.now) {}
  async add(f: FeedbackInput): Promise<void> {
    await this.db
      .prepare('INSERT INTO feedback (kind, reason, message, email, version, browser, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(f.kind, f.reason, f.message, f.email, f.version, f.browser, f.locale, this.now())
      .run()
  }
  async list(opts: { limit: number; before?: number }): Promise<FeedbackRow[]> {
    const cols = 'id, kind, reason, message, email, version, browser, locale, created_at'
    const res = opts.before === undefined
      ? await this.db.prepare(`SELECT ${cols} FROM feedback ORDER BY id DESC LIMIT ?`).bind(opts.limit).all<Row>()
      : await this.db.prepare(`SELECT ${cols} FROM feedback WHERE id < ? ORDER BY id DESC LIMIT ?`).bind(opts.before, opts.limit).all<Row>()
    return (res.results ?? []).map((r) => ({
      id: r.id, kind: r.kind, reason: r.reason, message: r.message, email: r.email,
      version: r.version, browser: r.browser, locale: r.locale, createdAt: r.created_at,
    }))
  }
  async prune(beforeMs: number): Promise<number> {
    const r = await this.db
      .prepare('DELETE FROM feedback WHERE id IN (SELECT id FROM feedback WHERE created_at < ? ORDER BY created_at LIMIT ?)')
      .bind(beforeMs, FEEDBACK_PRUNE_BATCH)
      .run()
    return r.meta.changes ?? 0
  }
}
