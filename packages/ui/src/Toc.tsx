import React from 'react'
import type { TocEntry } from '@md-reader/core'

export interface TocProps {
  entries: TocEntry[]
  activeId?: string | null
  onSelect?: (id: string) => void
}

export function Toc(props: TocProps): React.JSX.Element | null {
  const { entries, activeId, onSelect } = props

  if (!entries || entries.length === 0) {
    return null
  }

  const renderEntries = (nodes: TocEntry[]) => {
    if (!nodes || nodes.length === 0) return null
    return (
      <ul>
        {nodes.map(node => {
          const depth = typeof node.depth === 'number' ? node.depth : 1
          return (
            <li key={node.id}>
              <a
                href={`#${node.id}`}
                aria-current={activeId === node.id ? 'true' : undefined}
                style={{ paddingLeft: `${(depth - 1) * 12 + 8}px` }}
                onClick={(e) => {
                  if (onSelect) {
                    e.preventDefault()
                    onSelect(node.id)
                  }
                }}
              >
                {node.text}
              </a>
              {node.children && node.children.length > 0 && renderEntries(node.children)}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <nav className="md-toc">
      <div className="md-toc-title">Mục lục</div>
      {renderEntries(entries)}
    </nav>
  )
}
