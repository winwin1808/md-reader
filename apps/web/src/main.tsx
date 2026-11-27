import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, I18nProvider, resolveLocale, isLocale, loadLocale } from '@md-reader/ui'
import { onMathLoaded } from '@md-reader/core/plugins'
import '@md-reader/ui/fonts.css'
import './web.css'
import { SharePage } from './SharePage'
import { tokenFromPath } from './share-client'

export function webLocale(search: string = location.search, langs: readonly string[] = navigator.languages) {
  const q = new URLSearchParams(search).get('lang')
  return resolveLocale(isLocale(q) ? q : 'auto', langs)
}

onMathLoaded(() => { void import('katex/dist/katex.min.css') })

const container = document.getElementById('root')
if (container) {
  const locale = webLocale()
  void loadLocale(locale).then(() => {
    document.documentElement.lang = locale
    createRoot(container).render(
      <React.StrictMode>
        <I18nProvider locale={locale}>
          <ThemeProvider mode="system">
            <SharePage token={tokenFromPath(location.pathname)} />
          </ThemeProvider>
        </I18nProvider>
      </React.StrictMode>
    )
  })
}
