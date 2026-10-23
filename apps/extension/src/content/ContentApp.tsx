import React, { useState } from 'react'
import { makeCacheEntry } from '../shared/md-url'

export interface ContentAppProps {
  markdown: string
}

export function ContentApp({ markdown }: ContentAppProps) {
  const [isOpening, setIsOpening] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const FAIL_TEXT = 'Không mở được MD Reader. Thử bấm biểu tượng MD Reader trên thanh công cụ.'

  const handleOpen = (replace = true) => {
    setIsOpening(true)
    setErrorMsg(null)

    const fileUrl = window.location.href
    const fail = () => {
      setErrorMsg(FAIL_TEXT)
      setIsOpening(false)
    }

    // Cache page text only because the user asked to open it in the app
    try {
      chrome.storage?.local?.set?.({
        ['file_content_' + fileUrl]: makeCacheEntry(markdown),
      })
    } catch (e) {
      console.warn('Failed to cache file content:', e)
    }

    try {
      if (!chrome.runtime?.sendMessage) {
        fail()
        return
      }
      chrome.runtime.sendMessage(
        { action: 'openApp', fileUrl, content: markdown, replace },
        (response) => {
          if (chrome.runtime.lastError || (response && !response.success)) fail()
        }
      )
    } catch (e) {
      console.warn('sendMessage failed', e)
      fail()
    }
  }

  if (isMinimized) {
    return (
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 2147483647 }}>
        <button
          onClick={() => setIsMinimized(false)}
          title="Mở bảng điều khiển MD Reader"
          aria-label="Mở bảng điều khiển MD Reader"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: '#0f172a',
            color: '#38bdf8',
            border: '2px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            cursor: 'pointer',
            fontSize: '20px',
            transition: 'transform 0.2s ease',
          }}
        >
          📖
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 2147483647,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          maxWidth: '400px',
        }}
      >
        <div style={{ fontSize: '22px', lineHeight: 1 }}>📖</div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc', whiteSpace: 'nowrap' }}>
            MD Reader
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {errorMsg ? (
              <span style={{ color: '#f87171' }}>{errorMsg}</span>
            ) : (
              'Đọc đẹp, trình chiếu, mindmap & soạn thảo'
            )}
          </div>
        </div>

        <button
          onClick={() => handleOpen(true)}
          disabled={isOpening}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isOpening ? 'wait' : 'pointer',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
            transition: 'background-color 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          title="Mở file này trong giao diện MD Reader"
        >
          {isOpening ? 'Đang mở...' : 'Open in MD Reader'}
        </button>

        <button
          onClick={() => setIsMinimized(true)}
          title="Thu nhỏ widget"
          aria-label="Thu nhỏ widget"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            padding: 0,
            backgroundColor: 'transparent',
            color: '#64748b',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
