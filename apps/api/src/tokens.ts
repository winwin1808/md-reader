import type { ShareRole, ShareLink, CreateRoomResponse, CreateLinkRequest } from '@md-reader/core'

export class RoomNotFoundError extends Error {}

export interface ResolvedToken {
  roomId: string
  role: ShareRole
  prefix?: string
  expiresAt?: number | null
}

export interface TokenStore {
  createRoom(): Promise<CreateRoomResponse>
  verifyOwner(roomId: string, ownerToken: string): Promise<boolean>
  createLink(roomId: string, req: CreateLinkRequest): Promise<ShareLink>
  listLinks(roomId: string): Promise<ShareLink[]>
  revoke(roomId: string, tokenPrefix: string): Promise<boolean>
  revokeAll(roomId: string): Promise<number>
  resolve(token: string): Promise<ResolvedToken | null>
  deleteRoom(roomId: string): Promise<boolean>
  touchRoom(roomId: string): Promise<void>
  idleRooms(before: number, limit: number): Promise<string[]>
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function newToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)))
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 6)
}

export function newRoomId(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(16)))
}

interface LinkRow {
  tokenHash: string
  tokenPrefix: string
  roomId: string
  role: ShareRole
  label: string
  createdAt: number
  expiresAt: number | null
  revokedAt: number | null
  seq: number
}

export class MemoryTokenStore implements TokenStore {
  // rooms: roomId -> ownerTokenHash ; links: tokenHash -> LinkRow
  readonly rooms = new Map<string, { ownerTokenHash: string; createdAt: number; lastSeen: number | null }>()
  readonly links = new Map<string, LinkRow>()
  private seq = 0

  constructor(private now: () => number = Date.now) {}

  async createRoom(): Promise<CreateRoomResponse> {
    const roomId = newRoomId()
    const ownerToken = newToken()
    this.rooms.set(roomId, { ownerTokenHash: await hashToken(ownerToken), createdAt: this.now(), lastSeen: this.now() })
    return { roomId, ownerToken }
  }

  async verifyOwner(roomId: string, ownerToken: string): Promise<boolean> {
    const room = this.rooms.get(roomId)
    return !!room && room.ownerTokenHash === (await hashToken(ownerToken))
  }

  async createLink(roomId: string, req: CreateLinkRequest): Promise<ShareLink> {
    if (!this.rooms.has(roomId)) throw new RoomNotFoundError(roomId)
    const token = newToken()
    const createdAt = this.now()
    const row: LinkRow = {
      tokenHash: await hashToken(token),
      tokenPrefix: tokenPrefix(token),
      roomId,
      role: req.role,
      label: req.label ?? '',
      createdAt,
      expiresAt: req.expiresIn === null ? null : createdAt + req.expiresIn,
      revokedAt: null,
      seq: this.seq++,
    }
    this.links.set(row.tokenHash, row)
    return this.toLink(row, token)
  }

  async listLinks(roomId: string): Promise<ShareLink[]> {
    return [...this.links.values()]
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq)
      .map((r) => this.toLink(r, ''))
  }

  async revoke(roomId: string, prefix: string): Promise<boolean> {
    let first: LinkRow | null = null
    for (const r of this.links.values()) {
      if (r.roomId === roomId && r.tokenPrefix === prefix && r.revokedAt === null) {
        if (!first || r.createdAt < first.createdAt || (r.createdAt === first.createdAt && r.seq < first.seq)) first = r
      }
    }
    if (!first) return false
    first.revokedAt = this.now()
    return true
  }

  async revokeAll(roomId: string): Promise<number> {
    let n = 0
    const t = this.now()
    for (const r of this.links.values()) {
      if (r.roomId === roomId && r.revokedAt === null) {
        r.revokedAt = t
        n++
      }
    }
    return n
  }

  async resolve(token: string): Promise<ResolvedToken | null> {
    const h = await hashToken(token)
    for (const [roomId, room] of this.rooms) {
      if (room.ownerTokenHash === h) return { roomId, role: 'edit', expiresAt: null }
    }
    const r = this.links.get(h)
    if (!r || r.revokedAt !== null) return null
    if (r.expiresAt !== null && r.expiresAt <= this.now()) return null
    return { roomId: r.roomId, role: r.role, prefix: r.tokenPrefix, expiresAt: r.expiresAt }
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    for (const [h, r] of this.links) if (r.roomId === roomId) this.links.delete(h)
    return this.rooms.delete(roomId)
  }

  async touchRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId)
    const now = this.now()
    if (room && (room.lastSeen === null || room.lastSeen < now - 86_400_000)) room.lastSeen = now
  }

  async idleRooms(before: number, limit: number): Promise<string[]> {
    return [...this.rooms.entries()]
      .map(([id, r]) => ({ id, t: r.lastSeen ?? r.createdAt }))
      .filter((r) => r.t < before)
      .sort((a, b) => a.t - b.t)
      .slice(0, limit)
      .map((r) => r.id)
  }

  private toLink(r: LinkRow, token: string): ShareLink {
    return {
      token,
      tokenPrefix: r.tokenPrefix,
      roomId: r.roomId,
      role: r.role,
      label: r.label,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
    }
  }
}
