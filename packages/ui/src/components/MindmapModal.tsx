import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Icon } from './Icon'
import type { MindNode } from '@md-reader/core'
import {
  exportMindmapToSvg,
  exportMindmapToPng,
  downloadBlob,
} from '../export/export-mindmap'

export interface MindmapModalProps {
  root: MindNode
  isOpen: boolean
  onClose: () => void
  onNodeClick?: (node: MindNode) => void
  title?: string
}

interface LayoutNode {
  node: MindNode
  x: number
  y: number
  width: number
  height: number
  color: string
  depth: number
  children: LayoutNode[]
}

interface Edge {
  id: string
  parent: LayoutNode
  child: LayoutNode
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const BRANCH_COLORS = [
  '#2563eb',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#f97316',
]

const DY = 42
const NODE_HEIGHT = 32

function estimateWidth(text: string, isRoot: boolean): number {
  const charWidth = 7.5
  const padding = 28
  const estimated = Math.round((text || '').length * charWidth + padding)
  return Math.max(isRoot ? 110 : 80, Math.min(260, estimated))
}

function computeTreeLayout(
  root: MindNode,
  collapsedIds: Set<string>
): {
  nodes: LayoutNode[]
  edges: Edge[]
  bounds: Bounds
} {
  let leafY = 40
  const nodes: LayoutNode[] = []
  const edges: Edge[] = []

  function assignY(node: MindNode, depth: number, branchColor: string): LayoutNode {
    const isRoot = depth === 0
    const width = estimateWidth(node.text, isRoot)
    const height = NODE_HEIGHT
    const layoutChildren: LayoutNode[] = []

    const isCollapsed = collapsedIds.has(node.id)
    const rawChildren = isCollapsed ? [] : node.children || []
    if (rawChildren.length === 0) {
      const y = leafY
      leafY += DY
      return {
        node,
        x: 0,
        y,
        width,
        height,
        color: branchColor,
        depth,
        children: [],
      }
    }

    for (let i = 0; i < rawChildren.length; i++) {
      const child = rawChildren[i]
      if (!child) continue
      const childColor = isRoot
        ? BRANCH_COLORS[i % BRANCH_COLORS.length] ?? '#2563eb'
        : branchColor
      layoutChildren.push(assignY(child, depth + 1, childColor))
    }

    const firstChild = layoutChildren[0]
    const lastChild = layoutChildren[layoutChildren.length - 1]
    const y =
      firstChild && lastChild
        ? (firstChild.y + lastChild.y) / 2
        : leafY

    return {
      node,
      x: 0,
      y,
      width,
      height,
      color: branchColor,
      depth,
      children: layoutChildren,
    }
  }

  const rootLayout = assignY(root, 0, '#2563eb')

  const maxLevelWidth: Record<number, number> = {}
  function measureLevels(item: LayoutNode) {
    maxLevelWidth[item.depth] = Math.max(maxLevelWidth[item.depth] || 0, item.width)
    for (const child of item.children) {
      measureLevels(child)
    }
  }
  measureLevels(rootLayout)

  const levelX: Record<number, number> = { 0: 60 }
  const maxDepth = Math.max(0, ...Object.keys(maxLevelWidth).map(Number))
  for (let d = 1; d <= maxDepth; d++) {
    const prevWidth = maxLevelWidth[d - 1] || 120
    const dx = Math.max(180, prevWidth + 48)
    const prevX = levelX[d - 1] ?? 60
    levelX[d] = prevX + dx
  }

  function assignX(item: LayoutNode) {
    item.x = levelX[item.depth] ?? 60
    nodes.push(item)
    for (const child of item.children) {
      edges.push({
        id: `${item.node.id}->${child.node.id}`,
        parent: item,
        child,
      })
      assignX(child)
    }
  }
  assignX(rootLayout)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.x + n.width > maxX) maxX = n.x + n.width
    if (n.y - n.height / 2 < minY) minY = n.y - n.height / 2
    if (n.y + n.height / 2 > maxY) maxY = n.y + n.height / 2
  }

  if (nodes.length === 0) {
    minX = 0
    minY = 0
    maxX = 400
    maxY = 300
  }

  return {
    nodes,
    edges,
    bounds: { minX, minY, maxX, maxY },
  }
}

export function MindmapModal({
  root,
  isOpen,
  onClose,
  onNodeClick,
  title,
}: MindmapModalProps): React.JSX.Element | null {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const svgRef = useRef<SVGSVGElement | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  const { nodes, edges, bounds } = useMemo(() => {
    if (!root) {
      return {
        nodes: [],
        edges: [],
        bounds: { minX: 0, minY: 0, maxX: 400, maxY: 300 },
      }
    }
    return computeTreeLayout(root, collapsedIds)
  }, [root, collapsedIds])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    setCollapsedIds(new Set())
  }, [])

  const handleCollapseAll = useCallback(() => {
    if (!root) return
    const ids = new Set<string>()
    function traverse(n: MindNode, isRoot: boolean) {
      if (n.children && n.children.length > 0) {
        if (!isRoot) {
          ids.add(n.id)
        }
        for (const child of n.children) {
          traverse(child, false)
        }
      }
    }
    traverse(root, true)
    setCollapsedIds(ids)
  }, [root])

  const fitToScreen = useCallback(() => {
    const svgEl = svgRef.current
    const viewportWidth =
      svgEl?.clientWidth ||
      (typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 800)
    const viewportHeight =
      svgEl?.clientHeight ||
      (typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 600)

    const treeW = bounds.maxX - bounds.minX
    const treeH = bounds.maxY - bounds.minY
    const padding = 80

    const availableW = Math.max(100, viewportWidth - padding * 2)
    const availableH = Math.max(100, viewportHeight - padding * 2)

    const scaleW = availableW / Math.max(treeW, 100)
    const scaleH = availableH / Math.max(treeH, 100)
    const rawScale = Math.min(scaleW, scaleH)
    const scale = Math.min(1.5, Math.max(0.2, Number(rawScale.toFixed(2))))

    const treeCenterX = (bounds.minX + bounds.maxX) / 2
    const treeCenterY = (bounds.minY + bounds.maxY) / 2

    const x = Number((viewportWidth / 2 - treeCenterX * scale).toFixed(1))
    const y = Number((viewportHeight / 2 - treeCenterY * scale).toFixed(1))

    setTransform({ x, y, scale })
  }, [bounds])

  // Reset and fit when opened or root changes
  useEffect(() => {
    if (isOpen) {
      fitToScreen()
    }
  }, [isOpen, fitToScreen])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleExportSvg = useCallback(() => {
    if (!svgRef.current) return
    const svgStr = exportMindmapToSvg(svgRef.current, title)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const baseName = (title || root?.text || 'mindmap').trim().replace(/[/\\?%*:|"<>]/g, '-')
    downloadBlob(blob, `${baseName}.svg`)
  }, [title, root?.text])

  const handleExportPng = useCallback(async () => {
    if (!svgRef.current) return
    try {
      const blob = await exportMindmapToPng(svgRef.current, title, 2)
      const baseName = (title || root?.text || 'mindmap').trim().replace(/[/\\?%*:|"<>]/g, '-')
      downloadBlob(blob, `${baseName}.png`)
    } catch (err) {
      console.error('Failed to export PNG', err)
    }
  }, [title, root?.text])

  if (!isOpen) {
    return null
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    dragStartRef.current = {
      x: e.clientX - transform.x,
      y: e.clientY - transform.y,
    }
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    }))
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
  }

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.min(
      3.0,
      Math.max(0.2, Number((transform.scale * zoomFactor).toFixed(2)))
    )

    const rect = svgRef.current?.getBoundingClientRect()
    const mouseX = rect ? e.clientX - rect.left : 400
    const mouseY = rect ? e.clientY - rect.top : 300

    const ratio = newScale / transform.scale
    const newX = mouseX - (mouseX - transform.x) * ratio
    const newY = mouseY - (mouseY - transform.y) * ratio

    setTransform({
      x: Number(newX.toFixed(1)),
      y: Number(newY.toFixed(1)),
      scale: newScale,
    })
  }

  const handleZoomIn = () => {
    setTransform((prev) => {
      const newScale = Math.min(3.0, Number((prev.scale * 1.2).toFixed(2)))
      const svgEl = svgRef.current
      const w = svgEl?.clientWidth || 800
      const h = svgEl?.clientHeight || 600
      const ratio = newScale / prev.scale
      return {
        x: Number((w / 2 - (w / 2 - prev.x) * ratio).toFixed(1)),
        y: Number((h / 2 - (h / 2 - prev.y) * ratio).toFixed(1)),
        scale: newScale,
      }
    })
  }

  const handleZoomOut = () => {
    setTransform((prev) => {
      const newScale = Math.max(0.2, Number((prev.scale / 1.2).toFixed(2)))
      const svgEl = svgRef.current
      const w = svgEl?.clientWidth || 800
      const h = svgEl?.clientHeight || 600
      const ratio = newScale / prev.scale
      return {
        x: Number((w / 2 - (w / 2 - prev.x) * ratio).toFixed(1)),
        y: Number((h / 2 - (h / 2 - prev.y) * ratio).toFixed(1)),
        scale: newScale,
      }
    })
  }

  return (
    <div
      className="mindmap-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Sơ đồ tư duy'}
    >
      <div className="mindmap-modal-header">
        <h2 className="mindmap-modal-title">{title || 'Sơ đồ tư duy'}</h2>
        <button
          type="button"
          className="mindmap-close-btn"
          onClick={onClose}
          aria-label="Đóng sơ đồ tư duy" title="Đóng sơ đồ tư duy"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <svg
        className="mindmap-svg"
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g
          className="mindmap-viewport"
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
        >
          {/* Bézier branch paths */}
          {edges.map((edge) => {
            const parentRightX = edge.parent.x + edge.parent.width
            const parentY = edge.parent.y
            const childLeftX = edge.child.x
            const childY = edge.child.y
            const midX = (parentRightX + childLeftX) / 2
            const d = `M ${parentRightX} ${parentY} C ${midX} ${parentY}, ${midX} ${childY}, ${childLeftX} ${childY}`

            return (
              <path
                key={edge.id}
                className="mindmap-branch"
                d={d}
                stroke={edge.child.color}
                strokeWidth={2}
              />
            )
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const isRoot = n.depth === 0
            const hasChildren = Boolean(n.node.children && n.node.children.length > 0)
            const isCollapsed = collapsedIds.has(n.node.id)
            return (
              <g
                key={n.node.id}
                className="mindmap-node"
                transform={`translate(${n.x}, ${n.y - n.height / 2})`}
                onClick={(e) => {
                  e.stopPropagation()
                  onNodeClick?.(n.node)
                }}
              >
                <rect
                  className="mindmap-node-rect"
                  x={0}
                  y={0}
                  width={n.width}
                  height={n.height}
                  rx={isRoot ? 8 : 6}
                  fill="var(--md-bg-card, #ffffff)"
                  stroke={n.color}
                  strokeWidth={isRoot ? 2.5 : 1.5}
                />
                <text
                  className="mindmap-node-text"
                  x={n.width / 2}
                  y={n.height / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--md-fg, #0f172a)"
                >
                  {n.node.text}
                </text>

                {hasChildren && (
                  <g
                    className="mindmap-collapse-handle"
                    role="button"
                    aria-label={isCollapsed ? `Expand ${n.node.text}` : `Collapse ${n.node.text}`}
                    transform={`translate(${n.width}, ${n.height / 2})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCollapse(n.node.id)
                    }}
                  >
                    <circle
                      r={isCollapsed ? (n.node.children.length > 9 ? 11 : 9) : 8}
                      fill={isCollapsed ? n.color : 'var(--md-bg-card, #ffffff)'}
                      stroke={n.color}
                      strokeWidth={1.5}
                    />
                    {isCollapsed ? (
                      <text
                        className="mindmap-collapsed-badge"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize={9}
                        fontWeight="bold"
                      >
                        {`+${n.node.children.length}`}
                      </text>
                    ) : (
                      <line
                        x1={-4}
                        x2={4}
                        y1={0}
                        y2={0}
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        style={{ color: n.color }}
                      />
                    )}
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="mindmap-controls" role="toolbar" aria-label="Điều khiển sơ đồ tư duy">
        <button
          type="button"
          className="mindmap-btn"
          onClick={handleExportSvg}
          aria-label="Tải SVG"
          title="Tải SVG"
        >
          SVG
        </button>
        <button
          type="button"
          className="mindmap-btn"
          onClick={handleExportPng}
          aria-label="Tải PNG"
          title="Tải PNG"
        >
          PNG
        </button>
        <button
          type="button"
          className="mindmap-btn"
          onClick={handleZoomIn}
          aria-label="Phóng to"
          title="Phóng to"
        >
          <Icon name="zoom-in" size={20} />
        </button>
        <button
          type="button"
          className="mindmap-btn"
          onClick={handleZoomOut}
          aria-label="Thu nhỏ"
          title="Thu nhỏ"
        >
          <Icon name="zoom-out" size={20} />
        </button>
        <button
          type="button"
          className="mindmap-btn"
          onClick={fitToScreen}
          aria-label="Toàn màn hình"
          title="Toàn màn hình"
        >
          <Icon name="fullscreen" size={20} />
        </button>
        <button
          type="button"
          className="mindmap-btn"
          onClick={handleCollapseAll}
          aria-label="Gập tất cả nhánh"
          title="Gập tất cả nhánh"
        >
          <Icon name="collapse-all" size={20} />
        </button>
        <button
          type="button"
          className="mindmap-btn"
          onClick={handleExpandAll}
          aria-label="Mở tất cả nhánh"
          title="Mở tất cả nhánh"
        >
          <Icon name="expand-all" size={20} />
        </button>
        <button
          type="button"
          className="mindmap-btn"
          onClick={onClose}
          aria-label="Đóng"
          title="Đóng"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
    </div>
  )
}
