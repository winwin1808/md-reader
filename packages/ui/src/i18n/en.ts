import type { Messages } from './vi'

import { en as commonEn } from './catalog/common'
import { en as settingsEn } from './catalog/settings'
import { en as presentEn } from './catalog/present'
import { en as shellEn } from './catalog/shell'
import { en as liveEn } from './catalog/live'
import { en as extEn } from './catalog/ext'
import { en as webEn } from './catalog/web'

// Typed as Messages: a key missing from any area is a TS error.
export const en: Messages = {
  ...commonEn,
  ...settingsEn,
  ...presentEn,
  ...shellEn,
  ...liveEn,
  ...extEn,
  ...webEn,
}
