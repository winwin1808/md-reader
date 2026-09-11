import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rasterizeSvg } from './rasterize'
import type { RasterizeOptions, RasterizedImage } from './rasterize'
import * as exportModule from './index'
import * as uiModule from '../index'

describe('rasterizeSvg', () => {
  let originalImage: typeof Image
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext
  let originalToBlob: typeof HTMLCanvasElement.prototype.toBlob

  beforeEach(() => {
    originalImage = window.Image
    originalGetContext = HTMLCanvasElement.prototype.getContext
    originalToBlob = HTMLCanvasElement.prototype.toBlob

    // Mock Image
    class MockImage {
      private _src = ''
      onload: (() => void) | null = null
      onerror: ((err: any) => void) | null = null

      get src() {
        return this._src
      }

      set src(val: string) {
        this._src = val
        setTimeout(() => {
          if (val.includes('error-trigger')) {
            this.onerror?.(new Error('Image decode error'))
          } else {
            this.onload?.()
          }
        }, 0)
      }
    }
    window.Image = MockImage as any

    // Mock Canvas 2D context
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
      if (contextId === '2d') {
        return {
          drawImage: vi.fn(),
          clearRect: vi.fn(),
          fillRect: vi.fn(),
        } as any
      }
      return null
    })

    // Mock Canvas toBlob
    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation(function (
      this: HTMLCanvasElement,
      callback: (blob: Blob | null) => void,
      type?: string
    ) {
      const dummyPng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
      const blob = new Blob([dummyPng], { type: type || 'image/png' })
      setTimeout(() => callback(blob), 0)
    })
  })

  afterEach(() => {
    window.Image = originalImage
    HTMLCanvasElement.prototype.getContext = originalGetContext
    HTMLCanvasElement.prototype.toBlob = originalToBlob
    vi.restoreAllMocks()
  })

  it('exports rasterizeSvg, RasterizeOptions, RasterizedImage from export/index and ui index', () => {
    expect(exportModule.rasterizeSvg).toBe(rasterizeSvg)
    expect(uiModule.rasterizeSvg).toBe(rasterizeSvg)
  })

  it('rasterizes SVG with explicit width and height (defaults scale to 2)', async () => {
    const svg = '<svg width="200" height="100"><rect width="200" height="100" fill="red"/></svg>'
    const result = await rasterizeSvg(svg)

    expect(result.width).toBe(400)
    expect(result.height).toBe(200)
    expect(result.buffer).toBeInstanceOf(ArrayBuffer)
    expect(result.buffer.byteLength).toBeGreaterThan(0)
  })

  it('rasterizes SVG with viewBox when width/height are missing', async () => {
    const svg = '<svg viewBox="0 0 300 150"><circle cx="50" cy="50" r="50"/></svg>'
    const result = await rasterizeSvg(svg, { scale: 1 })

    expect(result.width).toBe(300)
    expect(result.height).toBe(150)
    expect(result.buffer).toBeInstanceOf(ArrayBuffer)
  })

  it('defaults to 800x600 when neither width/height nor viewBox are provided', async () => {
    const svg = '<svg><path d="M0,0 L10,10"/></svg>'
    const result = await rasterizeSvg(svg, { scale: 2 })

    expect(result.width).toBe(1600)
    expect(result.height).toBe(1200)
    expect(result.buffer).toBeInstanceOf(ArrayBuffer)
  })

  it('uses custom width and height options when provided', async () => {
    const svg = '<svg width="200" height="100"><rect/></svg>'
    const result = await rasterizeSvg(svg, { width: 500, height: 400, scale: 1 })

    expect(result.width).toBe(500)
    expect(result.height).toBe(400)
    expect(result.buffer).toBeInstanceOf(ArrayBuffer)
  })

  it('rejects when image fails to load', async () => {
    const svg = '<svg>error-trigger</svg>'
    await expect(rasterizeSvg(svg)).rejects.toThrow('Image decode error')
  })

  it('rejects when getContext 2d fails', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null)
    const svg = '<svg width="100" height="100"></svg>'
    await expect(rasterizeSvg(svg)).rejects.toThrow(/Failed to get 2D context/i)
  })

  it('rejects when toBlob produces null', async () => {
    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((callback: any) => {
      setTimeout(() => callback(null), 0)
    })
    const svg = '<svg width="100" height="100"></svg>'
    await expect(rasterizeSvg(svg)).rejects.toThrow(/toBlob failed/i)
  })
})
