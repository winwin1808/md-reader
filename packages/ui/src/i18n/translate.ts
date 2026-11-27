import type { Locale, TParams } from './types'
import type { MessageKey, Messages } from './vi'
import { vi } from './vi'
import { en } from './en'

export type PartialMessages = Partial<Messages>

export const catalogs: Partial<Record<Locale, PartialMessages>> = { vi, en }

export type TFunction = (key: MessageKey, params?: TParams) => string

/**
 * `{name}` interpolation. Simple plural: `{count|item|items}` picks the first
 * form when `count` is 1, the second otherwise.
 */
export function format(template: string, params?: TParams): string {
  if (!params) return template
  return template
    .replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (m, name: string, one: string, other: string) =>
      name in params ? (Number(params[name]) === 1 ? one : other) : m,
    )
    .replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m))
}

export function createT(locale: Locale): TFunction {
  return (key, params) =>
    format(catalogs[locale]?.[key] ?? en[key] ?? vi[key] ?? key, params)
}

const pending: Partial<Record<Locale, Promise<void>>> = {}

export function isLocaleLoaded(locale: Locale): boolean {
  return catalogs[locale] !== undefined
}

export function loadLocale(locale: Locale): Promise<void> {
  if (isLocaleLoaded(locale)) return Promise.resolve()
  const existing = pending[locale]
  if (existing) return existing
  let p: Promise<{ default: PartialMessages }>
  switch (locale) {
    case 'it':
      p = import('./locales/it')
      break
    case 'fr':
      p = import('./locales/fr')
      break
    case 'de':
      p = import('./locales/de')
      break
    default:
      return Promise.resolve()
  }
  const result = p.then(
    (mod) => {
      catalogs[locale] = mod.default
    },
    (err) => {
      console.warn(`[i18n] failed to load locale ${locale}`, err)
      delete pending[locale]
    },
  )
  pending[locale] = result
  return result
}
