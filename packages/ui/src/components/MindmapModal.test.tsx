import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { MindNode } from '@md-reader/core'
import { MindmapModal } from './MindmapModal'

describe('MindmapModal', () => {
  afterEach(() => {
    cleanup()
  })

  const sampleTree: MindNode = {
    id: 'node-root',
    text: 'Root Document',
    depth: 0,
    children: [
      {
        id: 'node-1',
        text: 'Section 1',
        depth: 1,
        children: [
          {
            id: 'node-1-1',
            text: 'Subsection 1.1',
            depth: 2,
            children: [],
          },
        ],
      },
      {
        id: 'node-2',
        text: 'Section 2',
        depth: 1,
        children: [],
      },
    ],
  }

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <MindmapModal root={sampleTree} isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal overlay, title, SVG nodes and paths when isOpen is true', () => {
    render(
      <MindmapModal
        root={sampleTree}
        isOpen={true}
        onClose={vi.fn()}
        title="My Document Mindmap"
      />
    )

    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('My Document Mindmap')).toBeDefined()
    expect(screen.getByText('Root Document')).toBeDefined()
    expect(screen.getByText('Section 1')).toBeDefined()
    expect(screen.getByText('Subsection 1.1')).toBeDefined()
    expect(screen.getByText('Section 2')).toBeDefined()

    // SVG paths connecting nodes should exist
    const paths = document.querySelectorAll('path.mindmap-branch')
    expect(paths.length).toBe(3) // 3 connections: root->sec1, root->sec2, sec1->subsec1.1
  })

  it('assigns branch colors to branches and descendants inherit ancestor branch color', () => {
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)

    const paths = document.querySelectorAll('path.mindmap-branch')
    // root -> sec1
    expect(paths[0]?.getAttribute('stroke')).toBe('#2563eb')
    // sec1 -> subsec1.1 (inherits #2563eb)
    expect(paths[1]?.getAttribute('stroke')).toBe('#2563eb')
    // root -> sec2 (2nd top-level branch gets #10b981)
    expect(paths[2]?.getAttribute('stroke')).toBe('#10b981')
  })

  it('calls onClose when header close button or floating close button is clicked', () => {
    const onClose = vi.fn()
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={onClose} />)

    const headerCloseBtn = screen.getByRole('button', { name: /^đóng sơ đồ tư duy$/i })
    fireEvent.click(headerCloseBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    const floatingCloseBtn = screen.getByRole('button', { name: /^đóng$/i })
    fireEvent.click(floatingCloseBtn)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onNodeClick when a node text is clicked', () => {
    const onNodeClick = vi.fn()
    render(
      <MindmapModal
        root={sampleTree}
        isOpen={true}
        onClose={vi.fn()}
        onNodeClick={onNodeClick}
      />
    )

    const nodeElem = screen.getByText('Section 1')
    fireEvent.click(nodeElem)
    expect(onNodeClick).toHaveBeenCalledWith(sampleTree.children[0])
  })

  it('handles zoom and fit controls changing transform state', () => {
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)

    const zoomGroup = document.querySelector('g.mindmap-viewport')
    expect(zoomGroup).toBeDefined()
    const initialTransform = zoomGroup?.getAttribute('transform')

    const zoomInBtn = screen.getByRole('button', { name: /phóng to/i })
    fireEvent.click(zoomInBtn)
    const afterZoomInTransform = zoomGroup?.getAttribute('transform')
    expect(afterZoomInTransform).not.toEqual(initialTransform)

    const zoomOutBtn = screen.getByRole('button', { name: /thu nhỏ/i })
    fireEvent.click(zoomOutBtn)

    const fitBtn = screen.getByRole('button', { name: /toàn màn hình/i })
    fireEvent.click(fitBtn)
    const afterFitTransform = zoomGroup?.getAttribute('transform')
    expect(afterFitTransform).toBeDefined()
  })

  it('handles mouse drag panning on SVG canvas', () => {
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)

    const svg = document.querySelector('svg.mindmap-svg')!
    const zoomGroup = document.querySelector('g.mindmap-viewport')!
    const initialTransform = zoomGroup.getAttribute('transform')

    fireEvent.mouseDown(svg, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.mouseMove(svg, { clientX: 180, clientY: 150 })
    fireEvent.mouseUp(svg)

    const pannedTransform = zoomGroup.getAttribute('transform')
    expect(pannedTransform).not.toEqual(initialTransform)
  })

  it('handles mouse wheel zoom on SVG canvas', () => {
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)

    const svg = document.querySelector('svg.mindmap-svg')!
    const zoomGroup = document.querySelector('g.mindmap-viewport')!
    const initialTransform = zoomGroup.getAttribute('transform')

    fireEvent.wheel(svg, { deltaY: -200 })

    const zoomedTransform = zoomGroup.getAttribute('transform')
    expect(zoomedTransform).not.toEqual(initialTransform)
  })

  it('clicking collapse handle hides child nodes and paths, and clicking again restores them', () => {
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)

    // Initially Subsection 1.1 is rendered
    expect(screen.getByText('Subsection 1.1')).toBeDefined()
    expect(document.querySelectorAll('path.mindmap-branch').length).toBe(3)

    // Find collapse handle for Section 1
    const collapseHandles = document.querySelectorAll('.mindmap-collapse-handle')
    expect(collapseHandles.length).toBeGreaterThan(0)

    // Section 1 is the second node with children (root is first, section 1 is second)
    const sec1Handle = screen.getByRole('button', { name: /collapse section 1/i })
    expect(sec1Handle.querySelector('line')).not.toBeNull()
    fireEvent.click(sec1Handle)

    // Subsection 1.1 should now be hidden
    expect(screen.queryByText('Subsection 1.1')).toBeNull()
    // Branch sec1 -> subsec1.1 should be hidden, so 2 branches remain (root->sec1, root->sec2)
    expect(document.querySelectorAll('path.mindmap-branch').length).toBe(2)

    // Clicking again restores child nodes
    const expandSec1Handle = screen.getByRole('button', { name: /expand section 1/i })
    fireEvent.click(expandSec1Handle)

    expect(screen.getByText('Subsection 1.1')).toBeDefined()
    expect(document.querySelectorAll('path.mindmap-branch').length).toBe(3)
  })

  it('handles Expand All and Collapse All buttons', () => {
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Subsection 1.1')).toBeDefined()

    // Click Collapse All button
    const collapseAllBtn = screen.getByRole('button', { name: /gập tất cả/i })
    fireEvent.click(collapseAllBtn)

    // Child nodes should be collapsed
    expect(screen.queryByText('Subsection 1.1')).toBeNull()

    // Click Expand All button
    const expandAllBtn = screen.getByRole('button', { name: /mở tất cả/i })
    fireEvent.click(expandAllBtn)

    // Child nodes should be visible again
    expect(screen.getByText('Subsection 1.1')).toBeDefined()
  })

  it('uses title or root.text fallback when exporting SVG and PNG', async () => {
    const downloadedFiles: string[] = []
    const origAnchorClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      downloadedFiles.push(this.download)
    }

    const mockCtx = {
      drawImage: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    }
    const origGetContext = HTMLCanvasElement.prototype.getContext
    const origToBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx) as any
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: any) => {
      cb(new Blob(['png-data'], { type: 'image/png' }))
    }) as any

    const origImage = globalThis.Image
    class MockImage {
      onload: (() => void) | null = null
      onerror: ((err: any) => void) | null = null
      private _src = ''
      set src(v: string) {
        this._src = v
        setTimeout(() => this.onload?.(), 0)
      }
      get src() {
        return this._src
      }
    }
    ;(globalThis as any).Image = MockImage

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()

    try {
      // 1. When title is provided
      const { unmount } = render(
        <MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} title="Custom Document: Test / 1" />
      )
      const svgBtn = screen.getByRole('button', { name: 'Tải SVG' })
      const pngBtn = screen.getByRole('button', { name: 'Tải PNG' })
      fireEvent.click(svgBtn)
      expect(downloadedFiles).toContain('Custom Document- Test - 1.svg')

      fireEvent.click(pngBtn)
      await vi.waitFor(() => {
        expect(downloadedFiles).toContain('Custom Document- Test - 1.png')
      })
      unmount()

      // 2. When title is omitted, falls back to root?.text
      render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)
      const svgBtn2 = screen.getByRole('button', { name: 'Tải SVG' })
      const pngBtn2 = screen.getByRole('button', { name: 'Tải PNG' })
      fireEvent.click(svgBtn2)
      expect(downloadedFiles).toContain('Root Document.svg')

      fireEvent.click(pngBtn2)
      await vi.waitFor(() => {
        expect(downloadedFiles).toContain('Root Document.png')
      })
    } finally {
      HTMLAnchorElement.prototype.click = origAnchorClick
      HTMLCanvasElement.prototype.getContext = origGetContext
      HTMLCanvasElement.prototype.toBlob = origToBlob
      ;(globalThis as any).Image = origImage
    }
  })
})
