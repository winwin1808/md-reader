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
})

describe('exportMindmapToPng', () => {
  let originalImage: typeof Image
  let originalCreateElement: typeof document.createElement

  beforeEach(() => {
    originalImage = global.Image
    originalCreateElement = document.createElement.bind(document)
  })

  afterEach(() => {
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
  it('creates temporary object URL and anchor download link, clicks it, and revokes URL', () => {
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
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/uuid')
  })
})
