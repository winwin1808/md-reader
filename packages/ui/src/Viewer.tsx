import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { MermaidBlock } from './components/MermaidBlock'
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
  
  // Use a ref to store onActiveHeadingChange to avoid re-triggering observer on every render
  const onChangeRef = useRef(onActiveHeadingChange)
  useEffect(() => {
    onChangeRef.current = onActiveHeadingChange
  }, [onActiveHeadingChange])

  useEffect(() => {
    if (!onChangeRef.current) return
    if (typeof IntersectionObserver === 'undefined') return

    const container = containerRef.current
    if (!container) return

    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const headingsWithId = Array.from(headings).filter(h => h.id)

    if (headingsWithId.length === 0) return

    let activeId: string | null = null
    const observer = new IntersectionObserver((entries) => {
      let newActiveId = activeId
      let changed = false

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          newActiveId = entry.target.id
          changed = true
        } else if (entry.target.id === activeId && entry.boundingClientRect.top > 0) {
          // Scrolled up, heading exited downwards
          const idx = headingsWithId.findIndex(h => h.id === activeId)
          if (idx > 0) {
            const prev = headingsWithId[idx - 1]; if (prev) newActiveId = prev.id
            changed = true
          } else {
            newActiveId = null
            changed = true
          }
        }
      })

      if (changed) {
        activeId = newActiveId
        if (onChangeRef.current) {
          onChangeRef.current(activeId)
        }
      }
    }, {
      rootMargin: '0px 0px -80% 0px'
    })

    headingsWithId.forEach(h => observer.observe(h))

    return () => {
      observer.disconnect()
    }
  }, [html])

  // Mermaid
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const mermaidCodes = container.querySelectorAll('code.language-mermaid')
    const roots: { root: Root, node: HTMLDivElement, pre: HTMLElement }[] = []

    mermaidCodes.forEach((codeEl) => {
      const pre = codeEl.parentElement
      if (pre && pre.tagName.toLowerCase() === 'pre') {
        const codeContent = codeEl.textContent || ''
        
        const wrapper = document.createElement('div')
        pre.parentNode?.insertBefore(wrapper, pre.nextSibling)
        pre.style.display = 'none'

        const root = createRoot(wrapper)
        root.render(<MermaidBlock code={codeContent} />)

        roots.push({ root, node: wrapper, pre })
      }
    })

    return () => {
      roots.forEach(({ root, node, pre }) => {
        setTimeout(() => root.unmount(), 0)
        node.remove()
        pre.style.display = ''
      })
    }
  }, [html])

  return (
    <div
      ref={containerRef}
      className={`md-viewer ${className}`.trim()}
      // This HTML is assumed to be sanitized by core/render using sanitizeSchema
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
