import type { Locale, LocalePref } from './types'
import { isLocale } from './types'

/** Explicit pref wins; otherwise the first browser language we support, else en. */
export function resolveLocale(
  pref: LocalePref | undefined,
  navigatorLanguages: readonly string[] | undefined,
): Locale {
  if (isLocale(pref)) return pref
  for (const lang of navigatorLanguages ?? []) {
    const primary = lang.split('-')[0]?.toLowerCase()
    if (isLocale(primary)) return primary
  }
  return 'en'
}
