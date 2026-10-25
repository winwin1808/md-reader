/**
 * Source of truth for message keys. Each area lives in catalog/<area>.ts and
 * exports `vi` and `en`; en.ts is typed against the key set built here.
 * Key naming: <area>.<thing>, e.g. 'settings.tab.display'.
 */

import { vi as commonVi } from './catalog/common'
import { vi as settingsVi } from './catalog/settings'
import { vi as presentVi } from './catalog/present'
import { vi as shellVi } from './catalog/shell'
import { vi as liveVi } from './catalog/live'
import { vi as extVi } from './catalog/ext'
import { vi as webVi } from './catalog/web'

export const vi = {
  ...commonVi,
  ...settingsVi,
  ...presentVi,
  ...shellVi,
  ...liveVi,
  ...extVi,
  ...webVi,
} as const

export type MessageKey = keyof typeof vi
export type Messages = Record<MessageKey, string>
