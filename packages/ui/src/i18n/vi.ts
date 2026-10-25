/**
 * Source of truth for message keys. Each area lives in catalog/<area>.ts and
 * exports `vi` and `en`; en.ts is typed against the key set built here.
 */
import { vi as common } from './catalog/common'

export const vi = {
  ...common,
} as const

export type MessageKey = keyof typeof vi
export type Messages = Record<MessageKey, string>
