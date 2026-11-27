export type Locale = 'vi' | 'en' | 'it' | 'fr' | 'de'
export type LocalePref = 'auto' | Locale
export type TParams = Record<string, string | number>

export const SUPPORTED_LOCALES: readonly Locale[] = ['vi', 'en', 'it', 'fr', 'de']

export const LOCALE_NAMES: Record<Locale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v)
}

const TAGS: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US', it: 'it-IT', fr: 'fr-FR', de: 'de-DE' }

export function localeTag(l: Locale): string {
  return TAGS[l]
}
