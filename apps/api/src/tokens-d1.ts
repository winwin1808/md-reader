import type { ShareRole, ShareLink, CreateRoomResponse, CreateLinkRequest } from '@md-reader/core'
import {
  RoomNotFoundError,
  hashToken,
  newRoomId,
  newToken,
  tokenPrefix,
  type TokenStore,
} from './tokens.js'

interface LinkRow {
  token_prefix: string
  room_id: string
  role: ShareRole
  label: string
  created_at: number
  expires_at: number | null
  revoked_at: number | null
}

function toLink(r: LinkRow, token: string): ShareLink {
  return {
    token,
    tokenPrefix: r.token_prefix,
    roomId: r.room_id,
    role: r.role,
    label: r.label,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
  }
}

export class D1TokenStore implements TokenStore {
  constructor(
    private db: D1Database,
    private now: () => number = Date.now,
  ) {}

  async createRoom(): Promise<CreateRoomResponse> {
    const roomId = newRoomId()
    const ownerToken = newToken()
    await this.db
      .prepare('INSERT INTO rooms (id, owner_token_hash, title, created_at) VALUES (?, ?, ?, ?)')
      .bind(roomId, await hashToken(ownerToken), '', this.now())
      .run()
    return { roomId, ownerToken }
  }

  async verifyOwner(roomId: string, ownerToken: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS ok FROM rooms WHERE id = ? AND owner_token_hash = ?')
      .bind(roomId, await hashToken(ownerToken))
      .first()
    return row !== null
  }

  async createLink(roomId: string, req: CreateLinkRequest): Promise<ShareLink> {
    const room = await this.db.prepare('SELECT 1 AS ok FROM rooms WHERE id = ?').bind(roomId).first()
    if (!room) throw new RoomNotFoundError(roomId)
    const token = newToken()
    const createdAt = this.now()
    const row: LinkRow = {
      token_prefix: tokenPrefix(token),
      room_id: roomId,
      role: req.role,
      label: req.label ?? '',
      created_at: createdAt,
      expires_at: req.expiresIn === null ? null : createdAt + req.expiresIn,
      revoked_at: null,
    }
    await this.db
      .prepare(
        'INSERT INTO links (token_hash, token_prefix, room_id, role, label, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
      )
      .bind(
        await hashToken(token),
        row.token_prefix,
        row.room_id,
        row.role,
        row.label,
        row.created_at,
        row.expires_at,
      )
      .run()
    return toLink(row, token)
  }

  async listLinks(roomId: string): Promise<ShareLink[]> {
    const res = await this.db
      .prepare(
        'SELECT token_prefix, room_id, role, label, created_at, expires_at, revoked_at FROM links WHERE room_id = ? ORDER BY created_at DESC',
      )
      .bind(roomId)
      .all<LinkRow>()
    return res.results.map((r) => toLink(r, ''))
  }

  async revoke(roomId: string, prefix: string): Promise<boolean> {
    const res = await this.db
      .prepare(
        'UPDATE links SET revoked_at = ? WHERE room_id = ? AND token_prefix = ? AND revoked_at IS NULL',
      )
      .bind(this.now(), roomId, prefix)
      .run()
    return (res.meta.changes ?? 0) > 0
  }

  async resolve(token: string): Promise<{ roomId: string; role: ShareRole } | null> {
    const h = await hashToken(token)
    const owner = await this.db
      .prepare('SELECT id FROM rooms WHERE owner_token_hash = ?')
      .bind(h)
      .first<{ id: string }>()
    if (owner) return { roomId: owner.id, role: 'edit' }
    const link = await this.db
      .prepare(
        'SELECT room_id, role FROM links WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)',
      )
      .bind(h, this.now())
      .first<{ room_id: string; role: ShareRole }>()
    return link ? { roomId: link.room_id, role: link.role } : null
  }
}
