import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@md-reader/ui'
import 'katex/dist/katex.min.css'
import '@md-reader/ui/fonts.css'
import { SharePage } from './SharePage'
import { tokenFromPath } from './share-client'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <ThemeProvider mode="system">
        <SharePage token={tokenFromPath(location.pathname)} />
      </ThemeProvider>
    </React.StrictMode>
  )
}
