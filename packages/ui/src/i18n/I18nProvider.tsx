import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Locale } from './types'
import { createT, type TFunction } from './translate'

interface Ctx {
  locale: Locale
  t: TFunction
}

const I18nContext = createContext<Ctx>({ locale: 'vi', t: createT('vi') })

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createT(locale) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Returns `t(key, params?)`. Without a provider it falls back to Vietnamese. */
export function useT(): TFunction {
  return useContext(I18nContext).t
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}
