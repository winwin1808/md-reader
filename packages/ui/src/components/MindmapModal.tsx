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
  lines: string[]
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

const TONES = ['--accent', '--ok', '--danger', '--pencil']
const ROOT_TONE = 'var(--ink)'
const toneVar = (i: number): string => `var(${TONES[i % TONES.length]})`

const DY = 42
const NODE_HEIGHT = 32
const NODE_HEIGHT_2 = 48
const MAX_LABEL_W = 220
const PAD_X = 24
const FALLBACK_CHAR_W = 8.2
const LABEL_FONT = '500 14px "IBM Plex Sans", system-ui, sans-serif'

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx
  try {
    if (typeof document === 'undefined') return null
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx && typeof ctx.measureText === 'function') {
      ctx.font = LABEL_FONT
      measureCtx = ctx
      return ctx
    }
  } catch {
    /* canvas unavailable (jsdom) */
  }
  return null
}

function measure(text: string): number {
  const ctx = getMeasureCtx()
  if (ctx) return ctx.measureText(text).width
  return text.length * FALLBACK_CHAR_W
}

function fitChars(text: string, ellipsis: boolean): string {
  if (measure(text) <= MAX_LABEL_W) return text
  let end = text.length
  while (end > 1 && measure(text.slice(0, end) + (ellipsis ? '\u2026' : '')) > MAX_LABEL_W) end--
  return text.slice(0, end) + (ellipsis ? '\u2026' : '')
}

export function layoutLabel(text: string): { lines: string[]; width: number } {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  const words = clean.split(' ').filter(Boolean)
  let line1 = ''
  let i = 0
  for (; i < words.length; i++) {
    const w = words[i] as string
    const next = line1 ? `${line1} ${w}` : w
    if (measure(next) <= MAX_LABEL_W) {
      line1 = next
    } else {
      break
    }
  }
  let lines: string[]
  if (i >= words.length) {
    lines = [line1]
  } else if (!line1) {
    // first word alone is too long: cut it, continue on line 2
    const first = words[0] as string
    const cut = fitChars(first, false)
    const rest = (first.slice(cut.length) + ' ' + words.slice(1).join(' ')).trim()
    lines = [cut, fitChars(rest, true)]
  } else {
    lines = [line1, fitChars(words.slice(i).join(' '), true)]
  }
  const width = Math.max(...lines.map(measure)) + PAD_X
  return { lines, width: Math.round(width) }
}

function computeTreeLayout(
  root: MindNode,
  collapsedIds: Set<string>
): {
  nodes: LayoutNode[]
  edges: Edge[]
  bounds: Bounds
} {
  let lastBottom = 14
  const nodes: LayoutNode[] = []
  const edges: Edge[] = []

  function assignY(
    node: MindNode,
    depth: number,
    branchColor: string,
    toned = false
  ): LayoutNode {
    const isRoot = depth === 0
    const label = layoutLabel(node.text)
    const width = label.width
    const lines = label.lines
    const height = lines.length > 1 ? NODE_HEIGHT_2 : NODE_HEIGHT
    const layoutChildren: LayoutNode[] = []

    const isCollapsed = collapsedIds.has(node.id)
    const rawChildren = isCollapsed ? [] : node.children || []
    if (rawChildren.length === 0) {
      const y = lastBottom + (DY - NODE_HEIGHT) + height / 2
      lastBottom = y + height / 2
      return {
        node,
        x: 0,
        y,
        width,
        height,
        color: branchColor,
        lines,
        depth,
        children: [],
      }
    }

    for (let i = 0; i < rawChildren.length; i++) {
      const child = rawChildren[i]
      if (!child) continue
      const fork = !toned && rawChildren.length > 1
      const childColor = fork ? toneVar(i) : branchColor
      layoutChildren.push(assignY(child, depth + 1, childColor, toned || fork))
    }

    const firstChild = layoutChildren[0]
    const lastChild = layoutChildren[layoutChildren.length - 1]
    const y =
      firstChild && lastChild
        ? (firstChild.y + lastChild.y) / 2
        : lastBottom

    return {
      node,
      x: 0,
      y,
      width,
      height,
      color: branchColor,
      lines,
      depth,
      children: layoutChildren,
    }
  }

  const rootLayout = assignY(root, 0, ROOT_TONE)

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
  const downPosRef = useRef({ x: 0, y: 0 })
  const movedRef = useRef(false)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; scale: number; x: number; y: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string>(root?.id ?? '')
  const [keyboardMode, setKeyboardMode] = useState(false)
  const focusPendingRef = useRef(false)

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

  const selected = nodes.find((n) => n.node.id === selectedId) ?? nodes[0]
  const effectiveSelectedId = selected?.node.id

  useEffect(() => {
    if (!focusPendingRef.current || !selected) return
    focusPendingRef.current = false
    const svgEl = svgRef.current
    const el = svgEl?.querySelector<SVGGElement>('g.mindmap-node[tabindex="0"]')
    el?.focus?.()
    // keep the selected node in view (pan just enough)
    const w = svgEl?.clientWidth || 800
    const h = svgEl?.clientHeight || 600
    setTransform((t) => {
      const left = t.x + selected.x * t.scale
      const right = t.x + (selected.x + selected.width) * t.scale
      const top = t.y + (selected.y - selected.height / 2) * t.scale
      const bottom = t.y + (selected.y + selected.height / 2) * t.scale
      const m = 24
      let dx = 0
      let dy = 0
      if (left < m) dx = m - left
      else if (right > w - m) dx = w - m - right
      if (top < m) dy = m - top
      else if (bottom > h - m) dy = h - m - bottom
      if (dx === 0 && dy === 0) return t
      return { ...t, x: Number((t.x + dx).toFixed(1)), y: Number((t.y + dy).toFixed(1)) }
    })
  }, [selected])

  const toggleCollapse = useCallback((id: string) => {
    if (root) {
      const find = (n: MindNode): MindNode | undefined =>
        n.id === id ? n : n.children?.map(find).find(Boolean)
      const hasDesc = (n: MindNode, target: string): boolean =>
        (n.children ?? []).some((c) => c.id === target || hasDesc(c, target))
      const target = find(root)
      setSelectedId((cur) => (target && !collapsedIds.has(id) && hasDesc(target, cur) ? id : cur))
    }
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [root, collapsedIds])

  const handleExpandAll = useCallback(() => {
    setCollapsedIds(new Set())
  }, [])

  const handleCollapseAll = useCallback(() => {
    if (!root) return
    setSelectedId(root.id)
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

  const setSizeOf = (id: string) => {
    const sibs = nodes.find((p) => p.children.some((c) => c.node.id === id))?.children
    if (!sibs) return { size: 1, pos: 1 }
    return { size: sibs.length, pos: sibs.findIndex((c) => c.node.id === id) + 1 }
  }

  const handleTreeKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (!selected || e.ctrlKey || e.metaKey || e.altKey) return
    const parentOf = (id: string): LayoutNode | undefined =>
      nodes.find((p) => p.children.some((c) => c.node.id === id))
    const go = (n: LayoutNode | undefined) => {
      if (!n || n.node.id === selected.node.id) return
      focusPendingRef.current = true
      setSelectedId(n.node.id)
    }
    const hasKids = (selected.node.children?.length ?? 0) > 0
    const isCollapsed = collapsedIds.has(selected.node.id)
    const sibs = parentOf(selected.node.id)?.children ?? [selected]
    const idx = sibs.findIndex((c) => c.node.id === selected.node.id)
    let handled = true
    switch (e.key) {
      case 'ArrowDown':
        go(sibs[idx + 1])
        break
      case 'ArrowUp':
        go(sibs[idx - 1])
        break
      case 'ArrowRight':
        if (hasKids && isCollapsed) toggleCollapse(selected.node.id)
        else go(selected.children[0])
        break
      case 'ArrowLeft':
        if (hasKids && !isCollapsed) toggleCollapse(selected.node.id)
        else go(parentOf(selected.node.id))
        break
      case 'Home':
        go(nodes[0])
        break
      case 'End':
        go(nodes[nodes.length - 1])
        break
      case 'Enter':
        onNodeClick?.(selected.node)
        break
      case ' ':
        if (hasKids) toggleCollapse(selected.node.id)
        break
      case '+':
      case '=':
        handleZoomIn()
        break
      case '-':
        handleZoomOut()
        break
      case '0':
        fitToScreen()
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
      setKeyboardMode(true)
    }
  }

  const pinchStart = () => {
    const pts = Array.from(pointersRef.current.values())
    const a = pts[0]
    const b = pts[1]
    if (!a || !b) return
    pinchRef.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      scale: transform.scale,
      x: transform.x,
      y: transform.y,
    }
    isDraggingRef.current = false
    movedRef.current = true
  }

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    setKeyboardMode(false)
    pointersRef.current.set(e.pointerId ?? 0, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      pinchStart()
      return
    }
    isDraggingRef.current = true
    movedRef.current = false
    downPosRef.current = { x: e.clientX, y: e.clientY }
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* synthetic pointer */
    }
    dragStartRef.current = {
      x: e.clientX - transform.x,
      y: e.clientY - transform.y,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const id = e.pointerId ?? 0
    if (pointersRef.current.has(id)) pointersRef.current.set(id, { x: e.clientX, y: e.clientY })
    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values()) as [
        { x: number; y: number },
        { x: number; y: number },
      ]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const scale = Math.min(3, Math.max(0.2, Number((pinch.scale * (dist / pinch.dist)).toFixed(2))))
      const rect = svgRef.current?.getBoundingClientRect()
      const mx = (a.x + b.x) / 2 - (rect?.left ?? 0)
      const my = (a.y + b.y) / 2 - (rect?.top ?? 0)
      const ratio = scale / pinch.scale
      setTransform({
        x: Number((mx - (mx - pinch.x) * ratio).toFixed(1)),
        y: Number((my - (my - pinch.y) * ratio).toFixed(1)),
        scale,
      })
      return
    }
    if (!isDraggingRef.current) return
    if (
      !movedRef.current &&
      Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y) > 4
    ) {
      movedRef.current = true
    }
    if (!movedRef.current) return
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    }))
  }

  const handlePointerUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e?.pointerId ?? 0)
    if (pointersRef.current.size < 2) pinchRef.current = null
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
          aria-label="Đóng"
          title="Đóng"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <svg
        className="mindmap-svg"
        ref={svgRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
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
          <g role="tree" aria-label="Sơ đồ tư duy" onKeyDown={handleTreeKeyDown}>
          {nodes.map((n) => {
            const isRoot = n.depth === 0
            const hasChildren = Boolean(n.node.children && n.node.children.length > 0)
            const isCollapsed = collapsedIds.has(n.node.id)
            return (
              <g
                key={n.node.id}
                className="mindmap-node"
                role="treeitem"
                aria-level={n.depth + 1}
                aria-setsize={setSizeOf(n.node.id).size}
                aria-posinset={setSizeOf(n.node.id).pos}
                aria-expanded={hasChildren ? !isCollapsed : undefined}
                aria-selected={n.node.id === effectiveSelectedId}
                aria-label={n.node.text}
                tabIndex={n.node.id === effectiveSelectedId ? 0 : -1}
                onFocus={(e) => {
                  if (e.target === e.currentTarget) setSelectedId(n.node.id)
                }}
                transform={`translate(${n.x}, ${n.y - n.height / 2})`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (movedRef.current) return
                  onNodeClick?.(n.node)
                }}
              >
                {keyboardMode && n.node.id === effectiveSelectedId && (
                  <rect
                    className="mindmap-focus-ring"
                    x={-3}
                    y={-3}
                    width={n.width + 6}
                    height={n.height + 6}
                    rx={9}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2}
                  />
                )}
                <rect
                  className="mindmap-node-rect"
                  x={0}
                  y={0}
                  width={n.width}
                  height={n.height}
                  rx={isRoot ? 8 : 6}
                  fill={`color-mix(in srgb, ${n.color} 12%, var(--paper))`}
                  stroke={n.color}
                  strokeWidth={isRoot ? 2.5 : 1.5}
                />
                <text
                  className="mindmap-node-text"
                  x={n.width / 2}
                  y={n.height / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--ink)"
                >
                  {n.lines.map((ln, li) => (
                    <tspan
                      key={li}
                      x={n.width / 2}
                      y={n.height / 2 + (li - (n.lines.length - 1) / 2) * 18}
                    >
                      {ln}
                    </tspan>
                  ))}
                </text>

                {hasChildren && (
                  <g
                    className="mindmap-collapse-handle"
                    role="button"
                    aria-label={isCollapsed ? `Expand ${n.node.text}` : `Collapse ${n.node.text}`}
                    transform={`translate(${n.width + 14}, ${n.height / 2})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (movedRef.current) return
                      toggleCollapse(n.node.id)
                    }}
                  >
                    <circle
                      r={isCollapsed ? (n.node.children.length > 9 ? 11 : 9) : 8}
                      fill={isCollapsed ? n.color : 'var(--paper)'}
                      stroke={n.color}
                      strokeWidth={1.5}
                    />
                    {isCollapsed ? (
                      <text
                        className="mindmap-collapsed-badge"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="var(--paper)"
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
                        stroke={n.color}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                )}
              </g>
            )
          })}
          </g>
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
      </div>
    </div>
  )
}
