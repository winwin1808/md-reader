import type { ShareRole, ShareLink, CreateRoomResponse, CreateLinkRequest } from '@md-reader/core'

export class RoomNotFoundError extends Error {}

export interface TokenStore {
  createRoom(): Promise<CreateRoomResponse>
  verifyOwner(roomId: string, ownerToken: string): Promise<boolean>
  createLink(roomId: string, req: CreateLinkRequest): Promise<ShareLink>
  listLinks(roomId: string): Promise<ShareLink[]>
  revoke(roomId: string, tokenPrefix: string): Promise<boolean>
  resolve(token: string): Promise<{ roomId: string; role: ShareRole } | null>
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
}

export class MemoryTokenStore implements TokenStore {
  // rooms: roomId -> ownerTokenHash ; links: tokenHash -> LinkRow
  readonly rooms = new Map<string, { ownerTokenHash: string; createdAt: number }>()
  readonly links = new Map<string, LinkRow>()

  constructor(private now: () => number = Date.now) {}

  async createRoom(): Promise<CreateRoomResponse> {
    const roomId = newRoomId()
    const ownerToken = newToken()
    this.rooms.set(roomId, { ownerTokenHash: await hashToken(ownerToken), createdAt: this.now() })
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
    }
    this.links.set(row.tokenHash, row)
    return this.toLink(row, token)
  }

  async listLinks(roomId: string): Promise<ShareLink[]> {
    return [...this.links.values()]
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => this.toLink(r, ''))
  }

  async revoke(roomId: string, prefix: string): Promise<boolean> {
    for (const r of this.links.values()) {
      if (r.roomId === roomId && r.tokenPrefix === prefix && r.revokedAt === null) {
        r.revokedAt = this.now()
        return true
      }
    }
    return false
  }

  async resolve(token: string): Promise<{ roomId: string; role: ShareRole } | null> {
    const h = await hashToken(token)
    for (const [roomId, room] of this.rooms) {
      if (room.ownerTokenHash === h) return { roomId, role: 'edit' }
    }
    const r = this.links.get(h)
    if (!r || r.revokedAt !== null) return null
    if (r.expiresAt !== null && r.expiresAt <= this.now()) return null
    return { roomId: r.roomId, role: r.role }
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
