import React, { useEffect, useRef } from 'react'
import './viewer.css'

export interface ViewerProps {
  /** HTML đã sanitize từ core/render. Viewer KHÔNG tự sanitize lại. */
  html: string
  className?: string
  /** Gọi khi heading đang đọc đổi, để Toc highlight. */
  onActiveHeadingChange?: (id: string | null) => void
}

export function Viewer(props: ViewerProps): React.JSX.Element {
  const { html, className = '', onActiveHeadingChange } = props
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onActiveHeadingChange) return
    if (typeof IntersectionObserver === 'undefined') return

    const container = containerRef.current
    if (!container) return

    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const headingsWithId = Array.from(headings).filter(h => h.id)

    if (headingsWithId.length === 0) return

    const observer = new IntersectionObserver((entries) => {
      const intersecting = entries.find(entry => entry.isIntersecting)
      if (intersecting) {
        onActiveHeadingChange(intersecting.target.id)
      }
    }, {
      rootMargin: '0px 0px -80% 0px'
    })

    headingsWithId.forEach(h => observer.observe(h))

    return () => {
      observer.disconnect()
    }
  }, [html, onActiveHeadingChange])

  return (
    <div
      ref={containerRef}
      className={`md-viewer ${className}`.trim()}
      // This HTML is assumed to be sanitized by core/render using sanitizeSchema
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
