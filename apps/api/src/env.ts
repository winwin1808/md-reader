import type { DocRoom } from './room.js'

export interface Env {
  DOC_ROOM: DurableObjectNamespace<DocRoom>
  DB: D1Database
  ADMIN_SECRET?: string
  // ASSETS: Fetcher (8b4) — chưa khai báo ở đây
}
