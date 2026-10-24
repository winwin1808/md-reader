import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ExcalidrawBlock } from './ExcalidrawBlock'

describe('ExcalidrawBlock', () => {
  it('renders placeholder card when isAppPage is false', () => {
    render(
      <ExcalidrawBlock
        data={JSON.stringify({
          elements: [
            { type: 'rectangle', x: 0, y: 0, width: 100, height: 50 }
          ]
        })}
        isAppPage={false}
      />
    )

    expect(screen.getByText('Sơ đồ Excalidraw')).toBeDefined()
    expect(screen.getByText('Nhấn để mở trong MD Reader để xem và tương tác đầy đủ')).toBeDefined()
    expect(document.querySelector('.excalidraw-placeholder-card')).not.toBeNull()
  })

  it('renders corrupted or invalid JSON with error fallback without throwing', () => {
    render(<ExcalidrawBlock data="not-a-valid-json" />)
    expect(screen.getByText('Không thể đọc dữ liệu Excalidraw')).toBeDefined()

    render(<ExcalidrawBlock data="{}" />)
    expect(screen.getAllByText('Không thể đọc dữ liệu Excalidraw').length).toBeGreaterThan(0)
  })

  it('renders valid Excalidraw JSON into SVG shapes (rect, ellipse, text)', () => {
    const sceneData = JSON.stringify({
      elements: [
        {
          id: 'rect-1',
          type: 'rectangle',
          x: 10,
          y: 20,
          width: 120,
          height: 60,
          strokeColor: '#000000',
          backgroundColor: '#ffffff'
        },
        {
          id: 'ellipse-1',
          type: 'ellipse',
          x: 200,
          y: 100,
          width: 80,
          height: 80,
          strokeColor: '#ff0000'
        },
        {
          id: 'text-1',
          type: 'text',
          x: 50,
          y: 50,
          text: 'Hello Excalidraw',
          fontSize: 20,
          strokeColor: '#000000'
        }
      ]
    })

    const { container } = render(<ExcalidrawBlock data={sceneData} isAppPage={true} />)

    const svg = container.querySelector('svg.excalidraw-svg')
    expect(svg).not.toBeNull()

    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect?.getAttribute('x')).toBe('10')
    expect(rect?.getAttribute('y')).toBe('20')
    expect(rect?.getAttribute('width')).toBe('120')
    expect(rect?.getAttribute('height')).toBe('60')

    const ellipse = container.querySelector('ellipse')
    expect(ellipse).not.toBeNull()
    expect(ellipse?.getAttribute('cx')).toBe('240')
    expect(ellipse?.getAttribute('cy')).toBe('140')

    const text = container.querySelector('text')
    expect(text).not.toBeNull()
    expect(text?.textContent).toBe('Hello Excalidraw')

    // Floating mini action bar: Copy SVG, Download SVG
    expect(container.querySelector('.excalidraw-copy-btn')).not.toBeNull()
    expect(container.querySelector('.excalidraw-download-btn')).not.toBeNull()
  })

  it('renders diamond, line, arrow, and freedraw shapes', () => {
    const sceneData = JSON.stringify({
      elements: [
        {
          id: 'diamond-1',
          type: 'diamond',
          x: 0,
          y: 0,
          width: 50,
          height: 50
        },
        {
          id: 'line-1',
          type: 'line',
          x: 10,
          y: 10,
          points: [[0, 0], [40, 40]]
        },
        {
          id: 'arrow-1',
          type: 'arrow',
          x: 50,
          y: 50,
          points: [[0, 0], [50, 0]]
        },
        {
          id: 'freedraw-1',
          type: 'freedraw',
          x: 100,
          y: 100,
          points: [[0, 0], [10, 5], [20, 10]]
        },
        {
          id: 'deleted-1',
          type: 'rectangle',
          x: 200,
          y: 200,
          width: 20,
          height: 20,
          isDeleted: true
        }
      ]
    })

    const { container } = render(<ExcalidrawBlock data={sceneData} isAppPage={true} />)

    const polygon = container.querySelector('polygon')
    expect(polygon).not.toBeNull()

    const paths = container.querySelectorAll('path')
    // defs marker has one path, then line, arrow, freedraw = at least 4 paths
    expect(paths.length).toBeGreaterThanOrEqual(4)

    // Check arrow marker
    const arrowPath = Array.from(paths).find(p => p.getAttribute('marker-end')?.includes('excalidraw-arrow'))
    expect(arrowPath).toBeDefined()
  })

  it('maps colours to palette tokens', () => {
    const data = JSON.stringify({ elements: [
      { id: 'a', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, strokeColor: '#1E1E1E', backgroundColor: '#ffffff' },
      { id: 'b', type: 'rectangle', x: 20, y: 0, width: 10, height: 10, strokeColor: '#e03131', backgroundColor: '#ffc9c9' },
      { id: 'c', type: 'rectangle', x: 40, y: 0, width: 10, height: 10, strokeColor: '#123456', backgroundColor: 'transparent' },
    ] })
    const { container } = render(<ExcalidrawBlock data={data} isAppPage={true} />)
    const r = container.querySelectorAll('rect')
    expect(r[0]?.getAttribute('stroke')).toBe('var(--ink)')
    expect(r[0]?.getAttribute('fill')).toBe('none')
    expect(r[1]?.getAttribute('stroke')).toBe('var(--danger)')
    expect(r[1]?.getAttribute('fill')).toContain('color-mix')
    expect(r[2]?.getAttribute('stroke')).toBe('#123456')
    expect(r[2]?.getAttribute('fill')).toBe('none')
  })
})
