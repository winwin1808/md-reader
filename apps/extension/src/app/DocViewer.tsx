import React, { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { parseMarkdown, renderToHtml } from '@md-reader/core'
import { Viewer, Toc } from '@md-reader/ui'

export function DocViewer({ doc }: { doc: Y.Doc }) {
  const [content, setContent] = useState(doc.getText('source').toString())

  useEffect(() => {
    const text = doc.getText('source')
    const observer = () => setContent(text.toString())
    text.observe(observer)
    return () => text.unobserve(observer)
  }, [doc])

  if (!content) return null

  const parsed = parseMarkdown(content)
  const { html, toc } = renderToHtml(parsed)

  return (
    <div style={{ display: 'flex', position: 'relative', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Viewer html={html} />
      </div>
      {toc && toc.length > 0 && (
        <div style={{ width: '250px', flexShrink: 0, paddingLeft: '20px', position: 'sticky', top: '20px', maxHeight: '100vh', overflowY: 'auto' }}>
          <Toc entries={toc} />
        </div>
      )}
    </div>
  )
}
