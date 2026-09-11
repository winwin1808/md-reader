import React, { useState, useMemo } from 'react'
import type { TocEntry } from '@md-reader/core'

export interface TocProps {
  entries: TocEntry[]
  activeId?: string | null
  onSelect?: (id: string) => void
}

interface TocNode {
  id: string
  text: string
  depth: number
  children: TocNode[]
}

function buildTree(entries: TocEntry[]): TocNode[] {
  if (!entries || entries.length === 0) return []

  const hasNestedChildren = entries.some(e => e.children && e.children.length > 0)
  if (hasNestedChildren) {
    return entries.map(e => ({
      id: e.id,
      text: e.text,
      depth: typeof e.depth === 'number' ? e.depth : 1,
      children: e.children ? buildTree(e.children) : [],
    }))
  }

  const root: TocNode[] = []
  const stack: TocNode[] = []

  for (const entry of entries) {
    const depth = typeof entry.depth === 'number' ? entry.depth : 1
    const node: TocNode = {
      id: entry.id,
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

  const tree = useMemo(() => buildTree(entries), [entries])

  if (!entries || entries.length === 0) {
    return null
  }

  const renderEntries = (nodes: TocNode[]) => {
    if (!nodes || nodes.length === 0) return null
    return (
      <ul>
        {nodes.map(node => {
          const depth = typeof node.depth === 'number' ? node.depth : 1
          const hasChildren = Boolean(node.children && node.children.length > 0)
          const isCollapsed = Boolean(collapsed[node.id])

          return (
            <li key={node.id}>
              {hasChildren && (
                <button
                  type="button"
                  aria-label="Thu gọn / Mở rộng mục"
                  onClick={() => {
                    setCollapsed(prev => ({
                      ...prev,
                      [node.id]: !prev[node.id],
                    }))
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginRight: '4px',
                    color: 'inherit',
                    fontSize: '10px',
                  }}
                >
                  {isCollapsed ? '▶' : '▼'}
                </button>
              )}
              <a
                href={`#${node.id}`}
                title={node.text}
                aria-current={activeId === node.id ? 'true' : undefined}
                style={{
                  paddingLeft: `${(depth - 1) * 12 + 8}px`,
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
                onClick={(e) => {
                  if (onSelect) {
                    e.preventDefault()
                    onSelect(node.id)
                  }
                }}
              >
                {node.text}
              </a>
              {hasChildren && !isCollapsed && renderEntries(node.children!)}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <nav className="md-toc">
      <div className="md-toc-title">Mục lục</div>
      {renderEntries(tree)}
    </nav>
  )
}

