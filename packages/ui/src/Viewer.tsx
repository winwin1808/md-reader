import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { MermaidBlock } from './components/MermaidBlock'
import { ExcalidrawBlock } from './components/ExcalidrawBlock'
import './viewer.css'

export interface ViewerProps {
  /** HTML đã sanitize từ core/render. Viewer KHÔNG tự sanitize lại. */
  html: string
  className?: string
  /** Gọi khi heading đang đọc đổi, để Toc highlight. */
  onActiveHeadingChange?: (id: string | null) => void
  isAppPage?: boolean
  /** Dựng sơ đồ mermaid cho code.language-mermaid (mặc định true). */
  mermaid?: boolean
}

const esc = (v: string) =>
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(v)
    : v.replace(/([^a-zA-Z0-9_-])/g, '\\$1')

function decode(v: string): string {
  try { return decodeURIComponent(v) } catch { return v }
}

function findAnchor(container: HTMLElement, raw: string): Element | null {
  const hash = decode(raw)
  return (
    container.querySelector(`#${esc(hash)}`) ??
    container.querySelector(`#${esc('user-content-' + hash)}`)
  )
}

export function Viewer(props: ViewerProps): React.JSX.Element {
  const { html, className = '', onActiveHeadingChange, isAppPage = true, mermaid = true } = props
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
    if (!mermaid) return
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
  }, [html, mermaid])

  // In-page anchor clicks: resolve against prefixed ids
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]')
      if (!a || !container.contains(a)) return
      const raw = (a.getAttribute('href') ?? '').slice(1)
      if (!raw) return
      const target = findAnchor(container, raw)
      if (!target) return
      e.preventDefault()
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      history.replaceState(null, '', '#' + raw)
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [html])

  // Initial location.hash: scroll to prefixed target when the raw one is absent
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof location === 'undefined' || !location.hash || location.hash.length < 2) return
    const hash = decode(location.hash.slice(1))
    if (container.querySelector(`#${esc(hash)}`)) return
    const target = container.querySelector(`#${esc('user-content-' + hash)}`)
    target?.scrollIntoView?.({ block: 'start' })
  }, [html])

  // Excalidraw
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const excalidrawCodes = container.querySelectorAll('code.language-excalidraw')
    const roots: { root: Root; node: HTMLDivElement; pre: HTMLElement }[] = []

    excalidrawCodes.forEach((codeEl) => {
      const pre = codeEl.parentElement
      if (pre && pre.tagName.toLowerCase() === 'pre') {
        const codeContent = codeEl.textContent || ''

        const wrapper = document.createElement('div')
        pre.parentNode?.insertBefore(wrapper, pre.nextSibling)
        pre.style.display = 'none'

        const root = createRoot(wrapper)
        root.render(<ExcalidrawBlock data={codeContent} isAppPage={isAppPage} />)

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
  }, [html, isAppPage])

  // Code block header with copy button
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const pres = container.querySelectorAll('pre')
    const timeouts: ReturnType<typeof setTimeout>[] = []

    pres.forEach((pre) => {
      if (pre.classList.contains('mermaid-block') || pre.querySelector('.code-block-header')) {
        return
      }
      const code = pre.querySelector('code')
      if (!code) return
      if (code.classList.contains('language-mermaid') || code.classList.contains('language-excalidraw')) return

      // Extract language
      let lang = 'text'
      const match = code.className.match(/language-([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        lang = match[1]
      } else {
        const classes = typeof code.className === 'string' ? code.className.split(/\s+/) : []
        for (const cls of classes) {
          if (cls && cls !== 'hljs' && !cls.startsWith('hljs-')) {
            lang = cls
            break
          }
        }
      }

      const header = document.createElement('div')
      header.className = 'code-block-header md-no-print'
      header.innerHTML = `<span class="code-lang-badge">${lang}</span><button class="code-copy-btn" title="Sao chép mã nguồn" aria-label="Sao chép mã nguồn">Copy</button>`

      const copyBtn = header.querySelector<HTMLButtonElement>('.code-copy-btn')
      if (copyBtn) {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        copyBtn.addEventListener('click', async () => {
          const codeText = code.textContent || ''
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(codeText)
              copyBtn.textContent = 'Copied ✓'
              copyBtn.classList.add('copied')
              if (timeoutId) {
                clearTimeout(timeoutId)
              }
              timeoutId = setTimeout(() => {
                copyBtn.textContent = 'Copy'
                copyBtn.classList.remove('copied')
                timeoutId = null
              }, 1500)
              timeouts.push(timeoutId)
            }
          } catch (err) {
            console.error('Failed to copy code:', err)
          }
        })
      }

      pre.insertBefore(header, pre.firstChild)
    })

    return () => {
      timeouts.forEach(t => clearTimeout(t))
    }
  }, [html])

  // Table wrapper for full-width 2-margin alignment and responsive overflow
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const tables = container.querySelectorAll('table')
    tables.forEach((table) => {
      const parent = table.parentElement
      if (parent && !parent.classList.contains('table-wrapper')) {
        const wrapper = document.createElement('div')
        wrapper.className = 'table-wrapper'
        parent.insertBefore(wrapper, table)
        wrapper.appendChild(table)
      }
    })
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
