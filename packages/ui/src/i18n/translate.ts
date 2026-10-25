import type { Locale, TParams } from './types'
import type { MessageKey, Messages } from './vi'
import { vi } from './vi'
import { en } from './en'

export const catalogs: Record<Locale, Messages> = { vi, en }

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
  const msgs = catalogs[locale]
  return (key, params) => format(msgs[key] ?? vi[key] ?? key, params)
}
