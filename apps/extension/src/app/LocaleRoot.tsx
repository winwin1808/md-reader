import { useEffect, useState, type ReactNode } from 'react'
import { I18nProvider, resolveLocale, type LocalePref } from '@md-reader/ui'

function asPref(v: unknown): LocalePref {
  return v === 'vi' || v === 'en' ? v : 'auto'
}

/** Reads the `uiLanguage` setting (local wins over sync) and keeps it live. */
export function LocaleRoot({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<LocalePref>('auto')

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const local = typeof chrome.storage?.local?.get === 'function' ? await chrome.storage.local.get('uiLanguage') : {}
        const sync = typeof chrome.storage?.sync?.get === 'function' ? await chrome.storage.sync.get('uiLanguage') : {}
        if (live) setPref(asPref(local?.uiLanguage ?? sync?.uiLanguage))
      } catch {
        /* keep auto */
      }
    }
    void load()
    const onChanged = (changes: Record<string, { newValue?: unknown }>) => {
      if ('uiLanguage' in changes) void load()
    }
    chrome.storage?.onChanged?.addListener?.(onChanged)
    return () => {
      live = false
      chrome.storage?.onChanged?.removeListener?.(onChanged)
    }
  }, [])

  const locale = resolveLocale(pref, navigator.languages)
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <I18nProvider locale={locale}>{children}</I18nProvider>
}
