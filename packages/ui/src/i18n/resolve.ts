import type { Locale, LocalePref } from './types'

/** 'auto' → vi when the first browser language starts with "vi", else en. */
export function resolveLocale(
  pref: LocalePref | undefined,
  navigatorLanguages: readonly string[] | undefined,
): Locale {
  if (pref === 'vi' || pref === 'en') return pref
  const first = (navigatorLanguages ?? [])[0]
  return first && first.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}
