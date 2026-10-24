import type { DocRoom } from './room.js'

export interface Env {
  DOC_ROOM: DurableObjectNamespace<DocRoom>
  // DB: D1Database (8a2) · SNAPSHOTS: R2Bucket (8a3) · ASSETS: Fetcher (8b4) — chưa khai báo ở đây
}
