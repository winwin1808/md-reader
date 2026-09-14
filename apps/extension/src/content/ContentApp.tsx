import React from 'react'

export function ContentApp({ markdown }: { markdown: string }) {
  const handleOpen = () => {
    try {
      chrome.storage?.local?.set?.({
        ['file_content_' + window.location.href]: markdown,
      })
    } catch (e) {
      console.warn('Failed to cache file content:', e)
    }
    window.open(chrome.runtime.getURL('app.html?file=' + encodeURIComponent(window.location.href)))
  }

  return (
    <button
      onClick={handleOpen}
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
  )
}
