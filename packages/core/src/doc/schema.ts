import * as Y from 'yjs'

export const FORMAT_VERSION = 1

export const DOC_KEYS = {
  source: 'source',
  meta: 'meta',
  history: 'history',
} as const

export interface DocMeta {
  title: string
  formatVersion: number
  originPath: string | null
  /** SHA-256 hex của nội dung file lúc import. null khi doc chưa từng từ file. */
  originHash: string | null
  createdAt: number
  /** clientID → tên tự khai. Rỗng ở phase 1; §2.3 cần chỗ bám. */
  actors: Record<string, string>
}

export interface HistoryEntry {
  id: string
  actor: string
  ts: number
  label: string
  clientIds: number[]
}

export class UnsupportedFormatVersionError extends Error {
  constructor(public readonly foundVersion: number, public readonly maxSupportedVersion: number) {
    super(`Unsupported formatVersion: ${foundVersion} (max supported: ${maxSupportedVersion})`)
    this.name = 'UnsupportedFormatVersionError'
  }
}
