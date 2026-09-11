import React from 'react'
import { parseMarkdown, renderToHtml } from '@md-reader/core'
import { ThemeProvider, Viewer, Toc } from '@md-reader/ui'

export function ContentApp({ markdown }: { markdown: string }) {
  const parsed = parseMarkdown(markdown)
  const { html, toc } = renderToHtml(parsed)

  return (
    <ThemeProvider mode="system">
      <div className="md-extension-container" style={{ display: 'flex', position: 'relative', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Viewer html={html} />
        </div>
        {toc && toc.length > 0 && (
          <div style={{ width: '250px', flexShrink: 0, paddingLeft: '20px', position: 'sticky', top: '20px', maxHeight: '100vh', overflowY: 'auto' }}>
            <Toc entries={toc} />
          </div>
        )}
        <button
          onClick={() => window.open(chrome.runtime.getURL('app.html?file=' + encodeURIComponent(window.location.href)))}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '10px 16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)',
            fontWeight: 500
          }}
        >
          Open in MD Reader
        </button>
      </div>
    </ThemeProvider>
  )
}
