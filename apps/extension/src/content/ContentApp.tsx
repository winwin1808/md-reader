import React, { useEffect, useState } from 'react'
import { makeCacheEntry } from '../shared/md-url'

export const FAIL_TEXT = 'Không mở được MD Reader. Thử bấm biểu tượng MD Reader trên thanh công cụ.'

/** Cache page text only while an open is in flight; a failed open removes it. */
export async function openInApp(markdown: string, replace = true): Promise<boolean> {
  const fileUrl = window.location.href
  const key = 'file_content_' + fileUrl
  const fail = (): false => {
    try {
      Promise.resolve(chrome.storage?.local?.remove?.(key)).catch(() => {})
    } catch {
      /* ignore */
    }
    return false
  }
  try {
    await chrome.storage?.local?.set?.({ [key]: makeCacheEntry(markdown) })
    if (!chrome.runtime?.sendMessage) return fail()
    const ok = await new Promise<boolean>((resolve) => {
      try {
        const r: any = chrome.runtime.sendMessage(
          { action: 'openApp', fileUrl, content: markdown, replace },
          (response: any) => {
            resolve(!chrome.runtime.lastError && !(response && response.success === false))
          }
        )
        if (r && typeof r.then === 'function') r.catch(() => resolve(false))
      } catch {
        resolve(false)
      }
    })
    return ok ? true : fail()
  } catch (e) {
    console.warn('MD Reader open failed:', e)
    return fail()
  }
}

export interface ContentAppProps {
  markdown: string
  initialError?: string | null
}

const COLLAPSED_KEY = 'mdr.widget.collapsed'

function BookIcon() {
  return (
    <svg className="book" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" />
    </svg>
  )
}

export function ContentApp({ markdown, initialError = null }: ContentAppProps) {
  const [isOpening, setIsOpening] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError)

  useEffect(() => {
    let live = true
    try {
      Promise.resolve(chrome.storage?.local?.get?.(COLLAPSED_KEY))
        .then((r: any) => {
          if (live) setCollapsed(!!(r && r[COLLAPSED_KEY] === true))
        })
        .catch(() => {
          if (live) setCollapsed(false)
        })
    } catch {
      setCollapsed(false)
    }
    return () => {
      live = false
    }
  }, [])

  const toggle = (next: boolean) => {
    setCollapsed(next)
    try {
      Promise.resolve(chrome.storage?.local?.set?.({ [COLLAPSED_KEY]: next })).catch(() => {})
    } catch {
      /* ignore */
    }
  }

  const handleOpen = async (replace = true) => {
    setIsOpening(true)
    setErrorMsg(null)
    const ok = await openInApp(markdown, replace)
    if (!ok) {
      setErrorMsg(FAIL_TEXT)
      setIsOpening(false)
    }
  }

  if (collapsed === null) return null

  if (collapsed) {
    return (
      <div className="tab strip">
        <button type="button" className="strip-btn" onClick={() => toggle(false)} title="Mở MD Reader" aria-label="Mở MD Reader">
          <BookIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="tab">
      <BookIcon />
      <div className="body">
        <button type="button" className="open" onClick={() => handleOpen(true)} disabled={isOpening}>
          {isOpening ? 'Đang mở...' : 'Đọc trong MD Reader'}
        </button>
        {errorMsg ? <div className="err" role="alert">{errorMsg}</div> : null}
      </div>
      <button type="button" className="hide" onClick={() => toggle(true)}>Ẩn</button>
    </div>
  )
}
