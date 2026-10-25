import { en as common } from './catalog/common'
import type { Messages } from './vi'

// Typed as Messages: a key missing from any area is a TS error.
export const en: Messages = {
  ...common,
}
