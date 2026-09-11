import React, { useEffect, useRef, useState, useCallback } from 'react'

export interface DocumentSearchProps {
  isOpen: boolean
  onClose: () => void
  containerRef: React.RefObject<HTMLElement | null>
}

function clearMarks(container: HTMLElement) {
  const marks = Array.from(container.querySelectorAll('mark.md-search-highlight'))
  const parents = new Set<Node>()
  for (const mark of marks) {
    const parent = mark.parentNode
    if (parent) {
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark)
      }
      parent.removeChild(mark)
      parents.add(parent)
    }
  }
  parents.forEach((parent) => parent.normalize())
}

function collectTextNodes(node: Node, result: Text[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    result.push(node as Text)
    return
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement
    const tagName = el.tagName.toUpperCase()
    if (['SCRIPT', 'STYLE', 'MARK', 'BUTTON', 'INPUT', 'TEXTAREA'].includes(tagName)) {
      return
    }
    for (let child = el.firstChild; child; child = child.nextSibling) {
      collectTextNodes(child, result)
    }
  }
}

function highlightText(container: HTMLElement, query: string): HTMLElement[] {
  const marks: HTMLElement[] = []
  const textNodes: Text[] = []
  collectTextNodes(container, textNodes)

  const lowerQuery = query.toLowerCase()
  const queryLen = query.length

  for (const node of textNodes) {
    const text = node.nodeValue || ''
    if (!text) continue

    const lowerText = text.toLowerCase()
    let index = lowerText.indexOf(lowerQuery)
    if (index === -1) continue

    const parent = node.parentNode
    if (!parent) continue

    const frag = document.createDocumentFragment()
    let lastIndex = 0

    while (index !== -1) {
      if (index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, index)))
      }
      const mark = document.createElement('mark')
      mark.className = 'md-search-highlight'
      mark.textContent = text.slice(index, index + queryLen)
      frag.appendChild(mark)
      marks.push(mark)

      lastIndex = index + queryLen
      index = lowerText.indexOf(lowerQuery, lastIndex)
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)))
    }

    parent.replaceChild(frag, node)
  }

  return marks
}

export function DocumentSearch(props: DocumentSearchProps): React.JSX.Element | null {
  const { isOpen, onClose, containerRef } = props

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [matchCount, setMatchCount] = useState(0)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const marksRef = useRef<HTMLElement[]>([])

  const updateActiveMark = useCallback((newIndex: number) => {
    const marks = marksRef.current
    marks.forEach((m, idx) => {
      if (idx === newIndex) {
        m.classList.add('md-search-active')
        m.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      } else {
        m.classList.remove('md-search-active')
      }
    })
    setActiveIndex(newIndex)
  }, [])

  const handleNext = useCallback(() => {
    const total = marksRef.current.length
    if (total === 0) return
    const next = (activeIndex + 1) % total
    updateActiveMark(next)
  }, [activeIndex, updateActiveMark])

  const handlePrev = useCallback(() => {
    const total = marksRef.current.length
    if (total === 0) return
    const prev = (activeIndex - 1 + total) % total
    updateActiveMark(prev)
  }, [activeIndex, updateActiveMark])

  // Clean up marks and focus input on mount / when isOpen changes
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    } else {
      if (containerRef.current) {
        clearMarks(containerRef.current)
        marksRef.current = []
      }
      setQuery('')
      setMatchCount(0)
      setActiveIndex(-1)
    }
  }, [isOpen, containerRef])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        clearMarks(containerRef.current)
        marksRef.current = []
      }
    }
  }, [containerRef])

  // Perform search & highlight when query changes
  useEffect(() => {
    const container = containerRef.current
    if (!container || !isOpen) return

    clearMarks(container)
    marksRef.current = []

    const trimmed = query.trim()
    if (!trimmed) {
      setMatchCount(0)
      setActiveIndex(-1)
      return
    }

    const newMarks = highlightText(container, trimmed)
    marksRef.current = newMarks
    setMatchCount(newMarks.length)

    if (newMarks.length > 0) {
      updateActiveMark(0)
    } else {
      setActiveIndex(-1)
    }
  }, [query, isOpen, containerRef, updateActiveMark])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handlePrev()
      } else {
        handleNext()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) {
    return null
  }

  const countDisplay = query.trim()
    ? matchCount > 0
      ? `${activeIndex + 1} / ${matchCount}`
      : '0 / 0'
    : ''

  return (
    <div
      className="md-no-print"
      style={{
        position: 'fixed',
        top: '12px',
        right: '120px',
        zIndex: 95,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'var(--md-bg)',
        color: 'var(--md-fg)',
        border: '1px solid var(--md-border)',
        borderRadius: '10px',
        padding: '6px 12px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      <input
        ref={inputRef}
        autoFocus
        type="text"
        placeholder="Tìm trong tài liệu..."
        aria-label="Tìm trong tài liệu"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'inherit',
          fontSize: '13px',
          width: '180px',
        }}
      />

      <span
        style={{
          fontSize: '12px',
          opacity: 0.7,
          whiteSpace: 'nowrap',
          minWidth: countDisplay ? '40px' : '0px',
          textAlign: 'center',
        }}
      >
        {countDisplay}
      </span>

      <button
        type="button"
        aria-label="Trước"
        title="Trước (Shift+Enter)"
        onClick={handlePrev}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '14px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.8,
        }}
      >
        ↑
      </button>

      <button
        type="button"
        aria-label="Kế tiếp"
        title="Kế tiếp (Enter)"
        onClick={handleNext}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '14px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.8,
        }}
      >
        ↓
      </button>

      <button
        type="button"
        aria-label="Đóng"
        title="Đóng (Esc)"
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '14px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.8,
        }}
      >
        ✕
      </button>
    </div>
  )
}
