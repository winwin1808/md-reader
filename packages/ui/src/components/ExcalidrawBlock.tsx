import React, { useRef, useState } from 'react'

export interface ExcalidrawBlockProps {
  data: string // JSON string of Excalidraw scene ({ elements: [...] })
  title?: string
  isAppPage?: boolean
}

interface ExcalidrawElement {
  id?: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  strokeColor?: string
  backgroundColor?: string
  strokeWidth?: number
  roundness?: any
  points?: [number, number][]
  text?: string
  fontSize?: number
  isDeleted?: boolean
}

const mix = (tone: string) => `color-mix(in srgb, var(${tone}) 20%, transparent)`
const STROKE_MAP: Record<string, string> = {
  '#000000': 'var(--ink)', '#000': 'var(--ink)', '#1e1e1e': 'var(--ink)', black: 'var(--ink)',
  '#e03131': 'var(--danger)', '#2f9e44': 'var(--ok)', '#1971c2': 'var(--accent)', '#868e96': 'var(--pencil)',
}
const FILL_MAP: Record<string, string> = {
  '#ffffff': 'none', '#fff': 'none', white: 'none', transparent: 'none',
  '#ffc9c9': mix('--danger'), '#b2f2bb': mix('--ok'), '#a5d8ff': mix('--accent'),
  '#e03131': 'var(--danger)', '#2f9e44': 'var(--ok)', '#1971c2': 'var(--accent)', '#868e96': 'var(--pencil)',
}
export function mapStroke(c?: string): string {
  if (!c) return 'var(--ink)'
  return STROKE_MAP[c.trim().toLowerCase()] ?? c
}
export function mapFill(c?: string): string {
  if (!c) return 'none'
  return FILL_MAP[c.trim().toLowerCase()] ?? c
}

function pointsToSvgPath(points: [number, number][] | undefined, baseX: number, baseY: number): string {
  if (!points || points.length === 0) return ''
  const [first, ...rest] = points
  if (!first) return ''
  let d = `M ${baseX + first[0]} ${baseY + first[1]}`
  for (const pt of rest) {
    d += ` L ${baseX + pt[0]} ${baseY + pt[1]}`
  }
  return d
}

function parseExcalidrawElements(data: string): ExcalidrawElement[] | null {
  try {
    let parsed = JSON.parse(data)
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed)
      } catch {
        // ignore
      }
    }
    if (Array.isArray(parsed)) {
      return parsed
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.elements)) {
      return parsed.elements
    }
    return null
  } catch {
    return null
  }
}

export function ExcalidrawBlock(props: ExcalidrawBlockProps): React.JSX.Element {
  const { data, title, isAppPage } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const [copied, setCopied] = useState(false)

  if (isAppPage === false) {
    return (
      <div className="excalidraw-placeholder-card">
        <span className="excalidraw-placeholder-icon">🎨</span>
        <div className="excalidraw-placeholder-body">
          <div className="excalidraw-placeholder-title">Sơ đồ Excalidraw</div>
          <div className="excalidraw-placeholder-hint">
            Nhấn để mở trong MD Reader để xem và tương tác đầy đủ
          </div>
        </div>
      </div>
    )
  }

  const rawElements = parseExcalidrawElements(data)
  if (!rawElements || rawElements.length === 0) {
    return (
      <div className="excalidraw-container excalidraw-error-card">
        <span className="excalidraw-error-icon">⚠️</span>
        <span className="excalidraw-error-text">Không thể đọc dữ liệu Excalidraw</span>
      </div>
    )
  }

  const elements = rawElements.filter(el => !el.isDeleted)
  if (elements.length === 0) {
    return (
      <div className="excalidraw-container excalidraw-error-card">
        <span className="excalidraw-error-icon">⚠️</span>
        <span className="excalidraw-error-text">Không thể đọc dữ liệu Excalidraw</span>
      </div>
    )
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const el of elements) {
    if (el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow') {
      if (Array.isArray(el.points) && el.points.length > 0) {
        for (const [px, py] of el.points) {
          minX = Math.min(minX, el.x + px)
          maxX = Math.max(maxX, el.x + px)
          minY = Math.min(minY, el.y + py)
          maxY = Math.max(maxY, el.y + py)
        }
      } else {
        const w = el.width || 0
        const h = el.height || 0
        minX = Math.min(minX, el.x, el.x + w)
        maxX = Math.max(maxX, el.x, el.x + w)
        minY = Math.min(minY, el.y, el.y + h)
        maxY = Math.max(maxY, el.y, el.y + h)
      }
    } else if (el.type === 'text') {
      const fs = el.fontSize || 16
      const tw = el.width || (el.text ? el.text.length * fs * 0.6 : 50)
      const th = el.height || fs * 1.5
      minX = Math.min(minX, el.x)
      maxX = Math.max(maxX, el.x + tw)
      minY = Math.min(minY, el.y)
      maxY = Math.max(maxY, el.y + th)
    } else {
      const w = el.width || 0
      const h = el.height || 0
      minX = Math.min(minX, el.x, el.x + w)
      maxX = Math.max(maxX, el.x, el.x + w)
      minY = Math.min(minY, el.y, el.y + h)
      maxY = Math.max(maxY, el.y, el.y + h)
    }
  }

  if (minX === Infinity || maxX === -Infinity) {
    return (
      <div className="excalidraw-container excalidraw-error-card">
        <span className="excalidraw-error-icon">⚠️</span>
        <span className="excalidraw-error-text">Không thể đọc dữ liệu Excalidraw</span>
      </div>
    )
  }

  const padding = 24
  const vbX = Math.round(minX - padding)
  const vbY = Math.round(minY - padding)
  const vbW = Math.max(Math.round(maxX - minX + padding * 2), 10)
  const vbH = Math.max(Math.round(maxY - minY + padding * 2), 10)
  const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`

  const handleCopySvg = async () => {
    if (!svgRef.current) return
    const svgStr = new XMLSerializer().serializeToString(svgRef.current)
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(svgStr)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy SVG:', err)
    }
  }

  const handleDownloadSvg = () => {
    if (!svgRef.current) return
    const svgStr = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'excalidraw'}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="excalidraw-container">
      <div className="excalidraw-action-bar md-no-print">
        <button
          type="button"
          className="excalidraw-btn excalidraw-copy-btn"
          title="Sao chép SVG"
          aria-label="Sao chép SVG"
          onClick={handleCopySvg}
        >
          {copied ? 'Đã chép ✓' : 'Sao chép SVG'}
        </button>
        <button
          type="button"
          className="excalidraw-btn excalidraw-download-btn"
          title="Tải SVG"
          aria-label="Tải SVG"
          onClick={handleDownloadSvg}
        >
          Tải SVG
        </button>
      </div>

      <svg
        ref={svgRef}
        className="excalidraw-svg"
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="excalidraw-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" />
          </marker>
        </defs>

        {elements.map((el, idx) => {
          const key = el.id || `el-${idx}`
          const stroke = mapStroke(el.strokeColor)
          const fill = mapFill(el.backgroundColor)
          const strokeWidth = el.strokeWidth || 1.5

          switch (el.type) {
            case 'rectangle':
              return (
                <rect
                  key={key}
                  x={el.x}
                  y={el.y}
                  width={el.width || 0}
                  height={el.height || 0}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                  rx={el.roundness ? 6 : 0}
                />
              )

            case 'ellipse':
              return (
                <ellipse
                  key={key}
                  cx={el.x + (el.width || 0) / 2}
                  cy={el.y + (el.height || 0) / 2}
                  rx={Math.abs(el.width || 0) / 2}
                  ry={Math.abs(el.height || 0) / 2}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                />
              )

            case 'diamond': {
              const w = el.width || 0
              const h = el.height || 0
              const midX = el.x + w / 2
              const midY = el.y + h / 2
              const points = `${midX},${el.y} ${el.x + w},${midY} ${midX},${el.y + h} ${el.x},${midY}`
              return (
                <polygon
                  key={key}
                  points={points}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                />
              )
            }

            case 'line':
            case 'arrow': {
              let d = ''
              if (Array.isArray(el.points) && el.points.length >= 2 && el.points[0]) {
                const [first, ...rest] = el.points
                d = `M ${el.x + first![0]} ${el.y + first![1]}`
                for (const p of rest) {
                  if (p) d += ` L ${el.x + p[0]} ${el.y + p[1]}`
                }
              } else {
                d = `M ${el.x} ${el.y} L ${el.x + (el.width || 0)} ${el.y + (el.height || 0)}`
              }
              return (
                <path
                  key={key}
                  d={d}
                  stroke={stroke}
                  fill="none"
                  strokeWidth={strokeWidth}
                  markerEnd={el.type === 'arrow' ? 'url(#excalidraw-arrow)' : undefined}
                />
              )
            }

            case 'text':
              return (
                <text
                  key={key}
                  x={el.x}
                  y={el.y + (el.fontSize || 16)}
                  fontSize={el.fontSize || 16}
                  fill={stroke}
                  fontFamily="var(--font-ui)"
                >
                  {el.text}
                </text>
              )

            case 'freedraw':
              return (
                <path
                  key={key}
                  d={pointsToSvgPath(el.points, el.x, el.y)}
                  stroke={stroke}
                  fill="none"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )

            default:
              return null
          }
        })}
      </svg>
    </div>
  )
}
