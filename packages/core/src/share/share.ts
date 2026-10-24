export type ShareRole = 'view' | 'edit'

export interface ShareLink {
  token: string
  tokenPrefix: string
  roomId: string
  role: ShareRole
  label: string
  createdAt: number
  expiresAt: number | null
  revokedAt: number | null
}

export interface RoomBinding {
  serverUrl: string
  roomId: string
  ownerToken: string
}

export const SHARE_EXPIRY_PRESETS: Record<'7d' | '30d' | 'never', number | null> = {
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  never: null,
}

export interface CreateRoomResponse {
  roomId: string
  ownerToken: string
}

export interface CreateLinkRequest {
  role: ShareRole
  label?: string
  expiresIn: number | null
}

export interface ResolveTokenResponse {
  roomId: string
  role: ShareRole
  title: string | null
}

export function normalizeServerUrl(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) s = `https://${s}`
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u.origin
  return null
}

export function buildShareUrl(serverUrl: string, token: string): string {
  return `${serverUrl}/s/${token}`
}

export function parseShareUrl(url: string): { serverUrl: string; token: string } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const m = /^\/s\/([^/]+)$/.exec(u.pathname)
  const token = m?.[1]
  if (!token || !/^[A-Za-z0-9_-]{16,}$/.test(token)) return null
  return { serverUrl: u.origin, token }
}

export function wsHost(serverUrl: string): string {
  return new URL(serverUrl).host
}

export const API_PATHS = {
  rooms: '/api/rooms',
  links: (roomId: string) => `/api/rooms/${roomId}/links`,
  revoke: (roomId: string, prefix: string) => `/api/rooms/${roomId}/links/${prefix}`,
  resolve: (token: string) => `/api/s/${token}`,
  snapshot: (token: string) => `/api/s/${token}/snapshot`,
  party: 'doc-room',
} as const
