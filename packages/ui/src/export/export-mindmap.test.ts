import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exportMindmapToSvg,
  exportMindmapToPng,
  downloadBlob,
} from './export-mindmap'

describe('exportMindmapToSvg', () => {
  it('produces valid XML string with xmlns attribute', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '800')
    svg.setAttribute('height', '600')
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.textContent = 'Mindmap Title'
    svg.appendChild(text)

    const result = exportMindmapToSvg(svg, 'My Document')
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(result).toContain('Mindmap Title')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('puts a background rect first and leaves no var(-- in the output', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('class', 'mindmap-node')
    g.setAttribute('transform', 'translate(10, 10)')
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('width', '100')
    rect.setAttribute('height', '32')
    rect.setAttribute('fill', 'color-mix(in srgb, var(--accent) 12%, var(--paper))')
    rect.setAttribute('stroke', 'var(--accent)')
    g.appendChild(rect)
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('style', 'color: var(--ink)')
    g.appendChild(line)
    svg.appendChild(g)

    const result = exportMindmapToSvg(svg, 'T')
    expect(result).not.toContain('var(--')
    const doc = new DOMParser().parseFromString(result, 'image/svg+xml')
    const first = doc.documentElement.firstElementChild!
    expect(first.tagName).toBe('rect')
    expect(first.getAttribute('width')).toBe('100%')
    expect(first.getAttribute('height')).toBe('100%')
  })

  it('resets inner zoom transform and computes fitted viewBox with padding even when pan/zoom is applied', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '800')
    svg.setAttribute('height', '600')

    const viewportG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    viewportG.setAttribute('class', 'mindmap-viewport')
    viewportG.setAttribute('transform', 'translate(150, -80) scale(1.75)')

    // Node 1: translate(100, 50), width 120, height 32
    // bounds: x: 100..220, y: 50..82
    const node1 = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    node1.setAttribute('class', 'mindmap-node')
    node1.setAttribute('transform', 'translate(100, 50)')
    const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect1.setAttribute('x', '0')
    rect1.setAttribute('y', '0')
    rect1.setAttribute('width', '120')
    rect1.setAttribute('height', '32')
    node1.appendChild(rect1)
    viewportG.appendChild(node1)

    // Node 2: translate(300, 200), width 150, height 32
    // bounds: x: 300..450, y: 200..232
    const node2 = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    node2.setAttribute('class', 'mindmap-node')
    node2.setAttribute('transform', 'translate(300, 200)')
    const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect2.setAttribute('x', '0')
    rect2.setAttribute('y', '0')
    rect2.setAttribute('width', '150')
    rect2.setAttribute('height', '32')
    node2.appendChild(rect2)
    viewportG.appendChild(node2)

    svg.appendChild(viewportG)

    const result = exportMindmapToSvg(svg, 'Exported Mindmap')

    const parser = new DOMParser()
    const doc = parser.parseFromString(result, 'image/svg+xml')
    const exportedSvg = doc.querySelector('svg')!
    const exportedViewport = doc.querySelector('.mindmap-viewport') || doc.querySelector('g')!

    // Zoom transform on viewport container must be reset
    expect(exportedViewport.getAttribute('transform')).toBeNull()

    // Bounding box: minX = 100, minY = 50, maxX = 450, maxY = 232
    // With 40px padding:
    // fittedX = 100 - 40 = 60
    // fittedY = 50 - 40 = 10
    // fittedWidth = 450 - 100 + 80 = 430
    // fittedHeight = 232 - 50 + 80 = 262
    expect(exportedSvg.getAttribute('viewBox')).toBe('60 10 430 262')
    expect(exportedSvg.getAttribute('width')).toBe('430')
    expect(exportedSvg.getAttribute('height')).toBe('262')
  })
})

describe('exportMindmapToPng', () => {
  let originalImage: typeof Image
  let originalCreateElement: typeof document.createElement

  beforeEach(() => {
    originalImage = global.Image
    originalCreateElement = document.createElement.bind(document)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.Image = originalImage
    document.createElement = originalCreateElement
  })

  it('calls canvas.toBlob or creates image correctly', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '400')
    svg.setAttribute('height', '300')

    const mockBlob = new Blob(['png-bytes'], { type: 'image/png' })

    // Mock HTMLCanvasElement toBlob and getContext
    const mockCtx = {
      drawImage: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    }
    const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(mockBlob)
    })

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: any) => {
      if (tagName.toLowerCase() === 'canvas') {
        const canvas = originalCreateElement('canvas')
        canvas.getContext = vi.fn().mockReturnValue(mockCtx) as any
        canvas.toBlob = mockToBlob as any
        return canvas
      }
      return originalCreateElement(tagName, options)
    })

    // Mock Image to immediately trigger onload
    class MockImage {
      onload: (() => void) | null = null
      onerror: ((err: any) => void) | null = null
      private _src = ''
      set src(value: string) {
        this._src = value
        setTimeout(() => {
          this.onload?.()
        }, 0)
      }
      get src() {
        return this._src
      }
    }
    // @ts-ignore
    global.Image = MockImage

    const blob = await exportMindmapToPng(svg, 'Mindmap Test', 2)
    expect(blob).toBe(mockBlob)
  })
})

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })


  it('creates temporary object URL and anchor download link, clicks it, and revokes URL asynchronously', () => {
    vi.useFakeTimers()
    try {
      const mockBlob = new Blob(['data'], { type: 'text/plain' })
      const createObjectURLSpy = vi.fn().mockReturnValue('blob:http://localhost/uuid')
      const revokeObjectURLSpy = vi.fn()
      window.URL.createObjectURL = createObjectURLSpy
      window.URL.revokeObjectURL = revokeObjectURLSpy

      const clickSpy = vi.fn()
      const origCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName)
        if (tagName.toLowerCase() === 'a') {
          el.click = clickSpy
        }
        return el
      })

      downloadBlob(mockBlob, 'test-mindmap.png')

      expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob)
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURLSpy).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/uuid')
    } finally {
      vi.useRealTimers()
    }
  })
})
