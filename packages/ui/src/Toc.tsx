import React, { useState, useMemo } from 'react'
import type { TocEntry } from '@md-reader/core'

export interface TocProps {
  entries: TocEntry[]
  activeId?: string | null
  onSelect?: (id: string) => void
}

interface TocNode {
  id: string
  slug: string
  text: string
  depth: number
  children: TocNode[]
}

function buildTree(entries: TocEntry[]): TocNode[] {
  if (!entries || entries.length === 0) return []

  const hasNestedChildren = entries.some(e => e.children && e.children.length > 0)
  if (hasNestedChildren) {
    return entries.map(e => {
      const slug = (e as any).slug || e.id
      return {
        id: e.id || slug,
        slug,
        text: e.text,
        depth: typeof e.depth === 'number' ? e.depth : 1,
        children: e.children ? buildTree(e.children) : [],
      }
    })
  }

  const root: TocNode[] = []
  const stack: TocNode[] = []

  for (const entry of entries) {
    const depth = typeof entry.depth === 'number' ? entry.depth : 1
    const slug = (entry as any).slug || entry.id
    const node: TocNode = {
      id: entry.id || slug,
      slug,
      text: entry.text,
      depth,
      children: [],
    }

    while (stack.length > 0) {
      const top = stack[stack.length - 1]!
      const topDepth = typeof top.depth === 'number' ? top.depth : 1
      if (topDepth < depth) {
        break
      }
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    } else {
      const parent = stack[stack.length - 1]!
      parent.children.push(node)
    }
    stack.push(node)
  }

  return root
}

export function Toc(props: TocProps): React.JSX.Element | null {
  const { entries, activeId, onSelect } = props
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleCollapse = (slug: string) => {
    setCollapsed(prev => ({
      ...prev,
      [slug]: !prev[slug],
    }))
  }

  const tree = useMemo(() => buildTree(entries), [entries])

  if (!entries || entries.length === 0) {
    return null
  }

  const renderEntries = (nodes: TocNode[]): React.ReactNode => {
    if (!nodes || nodes.length === 0) return null
    return nodes.map(entry => {
      const hasChildren = Boolean(entry.children && entry.children.length > 0)
      const isCollapsed = Boolean(collapsed[entry.slug])
      const isActive = activeId === entry.slug || activeId === entry.id

      return (
        <React.Fragment key={entry.slug}>
          <li
            key={entry.slug}
            className={`md-toc-item depth-${entry.depth}${isActive ? ' active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingLeft: `${(entry.depth - 1) * 12}px`,
            }}
          >
            {hasChildren ? (
              <button
                type="button"
                className="toc-collapse-btn"
                aria-label={`Thu gọn hoặc mở rộng ${entry.text}`}
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapse(entry.slug)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  marginRight: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  color: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
            ) : (
              <span style={{ width: '16px', display: 'inline-block' }} />
            )}
            <a
              href={`#${entry.slug}`}
              title={entry.text}
              aria-current={isActive ? 'true' : undefined}
              className="md-toc-link"
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onClick={(e) => {
                if (onSelect) {
                  e.preventDefault()
                  onSelect(entry.slug)
                }
              }}
            >
              {entry.text}
            </a>
          </li>
          {hasChildren && !isCollapsed && renderEntries(entry.children)}
        </React.Fragment>
      )
    })
  }

  return (
    <nav className="md-toc">
      <div className="md-toc-title">Mục lục</div>
      <ul>
        {renderEntries(tree)}
      </ul>
    </nav>
  )
}

