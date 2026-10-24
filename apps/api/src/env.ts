import type { DocRoom } from './room.js'

export interface Env {
  DOC_ROOM: DurableObjectNamespace<DocRoom>
  DB: D1Database
  // ASSETS: Fetcher (8b4) — chưa khai báo ở đây
}
