import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, I18nProvider, resolveLocale } from '@md-reader/ui'
import 'katex/dist/katex.min.css'
import '@md-reader/ui/fonts.css'
import './web.css'
import { SharePage } from './SharePage'
import { tokenFromPath } from './share-client'

export function webLocale(search: string = location.search, langs: readonly string[] = navigator.languages) {
  const q = new URLSearchParams(search).get('lang')
  return resolveLocale(q === 'vi' || q === 'en' ? q : 'auto', langs)
}

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <I18nProvider locale={webLocale()}>
        <ThemeProvider mode="system">
          <SharePage token={tokenFromPath(location.pathname)} />
        </ThemeProvider>
      </I18nProvider>
    </React.StrictMode>
  )
}
