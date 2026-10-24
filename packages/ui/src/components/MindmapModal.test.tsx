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

  it('assigns Lề sách tones: depth-1 branches cycle accent, ok, danger, pencil; descendants inherit', () => {
    const tree: MindNode = {
      id: 'r',
      text: 'R',
      depth: 0,
      children: [0, 1, 2, 3, 4].map((i) => ({
        id: `b${i}`,
        text: `B${i}`,
        depth: 1,
        children: i === 0 ? [{ id: 'c', text: 'C', depth: 2, children: [] }] : [],
      })),
    }
    render(<MindmapModal root={tree} isOpen={true} onClose={vi.fn()} />)
    const strokes = Array.from(document.querySelectorAll('path.mindmap-branch')).map((p) =>
      p.getAttribute('stroke')
    )
    // layout order: r->b0, b0->c, r->b1 ... r->b4
    expect(strokes).toEqual([
      'var(--accent)',
      'var(--accent)',
      'var(--ok)',
      'var(--danger)',
      'var(--pencil)',
      'var(--accent)',
    ])
  })

  it('has exactly one button named Đóng and it calls onClose', () => {
    const onClose = vi.fn()
    render(<MindmapModal root={sampleTree} isOpen={true} onClose={onClose} />)
    const btns = screen.getAllByRole('button', { name: 'Đóng' })
    expect(btns.length).toBe(1)
    fireEvent.click(btns[0] as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('drag past 4px never jumps; a click without movement jumps', () => {
    const onNodeClick = vi.fn()
    render(
      <MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} onNodeClick={onNodeClick} />
    )
    const node = screen.getByText('Section 1')
    fireEvent.pointerDown(node, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(node, { clientX: 110, clientY: 100 })
    fireEvent.pointerUp(node, { clientX: 110, clientY: 100 })
    fireEvent.click(node)
    expect(onNodeClick).not.toHaveBeenCalled()

    fireEvent.pointerDown(node, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerUp(node, { clientX: 101, clientY: 100 })
    fireEvent.click(node)
    expect(onNodeClick).toHaveBeenCalledTimes(1)
  })

  it('wraps a long Vietnamese label to two lines with an ellipsis', () => {
    const long: MindNode = {
      id: 'r',
      text: 'Gốc',
      depth: 0,
      children: [
        {
          id: 'l',
          text: 'Phương pháp tiếp cận hệ thống để thiết kế giao diện đọc tài liệu Markdown thân thiện với người dùng Việt Nam trên mọi thiết bị',
          depth: 1,
          children: [],
        },
      ],
    }
    render(<MindmapModal root={long} isOpen={true} onClose={vi.fn()} />)
    const texts = Array.from(document.querySelectorAll('.mindmap-node-text'))
    const tspans = texts[1]!.querySelectorAll('tspan')
    expect(tspans.length).toBe(2)
    expect(tspans[1]!.textContent!.endsWith('\u2026')).toBe(true)
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

    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(svg, { clientX: 180, clientY: 150 })
    fireEvent.pointerUp(svg)

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

  it('one tone per section branch; a drag ending on a handle does not toggle', () => {
    const mk = (id: string): MindNode => ({ id, text: id, depth: 2, children: [] })
    const tree: MindNode = {
      id: 'r',
      text: 'Root',
      depth: 0,
      children: [
        { id: 'a', text: 'A', depth: 1, children: [mk('B'), mk('C'), mk('D')] },
      ],
    }
    const { container } = render(<MindmapModal root={tree} isOpen={true} onClose={vi.fn()} />)
    const strokeOf = (label: string) =>
      screen.getByText(label).closest('g.mindmap-node')?.querySelector('rect')?.getAttribute('stroke')
    const tones = new Set([strokeOf('B'), strokeOf('C'), strokeOf('D')])
    expect(tones.size).toBe(3)

    const handle = container.querySelector('.mindmap-collapse-handle') as Element
    const label = handle.getAttribute('aria-label')
    const svg = handle
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 100 })
    fireEvent.pointerUp(svg, { clientX: 120, clientY: 100 })
    fireEvent.click(handle)
    expect(container.querySelector('.mindmap-collapse-handle')?.getAttribute('aria-label')).toBe(label)
  })

  describe('keyboard and touch', () => {
    const sel = () =>
      Array.from(document.querySelectorAll('[role="treeitem"]')).find(
        (n) => n.getAttribute('aria-selected') === 'true'
      )!
    const tree = () => document.querySelector('[role="tree"]') as Element

    it('exposes tree semantics', () => {
      render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)
      expect(tree().getAttribute('aria-label')).toBe('Sơ đồ tư duy')
      const items = document.querySelectorAll('[role="treeitem"]')
      expect(items.length).toBe(4)
      expect(sel().getAttribute('aria-label')).toBe('Root Document')
      expect(sel().getAttribute('aria-level')).toBe('1')
      expect(sel().getAttribute('aria-expanded')).toBe('true')
      expect(sel().getAttribute('tabindex')).toBe('0')
      expect(items[3]!.getAttribute('aria-expanded')).toBeNull()
      expect(items[3]!.getAttribute('tabindex')).toBe('-1')
    })

    it('navigates with arrows, Enter and Space', () => {
      const onNodeClick = vi.fn()
      render(
        <MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} onNodeClick={onNodeClick} />
      )
      fireEvent.keyDown(tree(), { key: 'ArrowRight' })
      expect(sel().getAttribute('aria-label')).toBe('Section 1')
      fireEvent.keyDown(tree(), { key: 'ArrowDown' })
      expect(sel().getAttribute('aria-label')).toBe('Section 2')
      fireEvent.keyDown(tree(), { key: 'ArrowLeft' })
      expect(sel().getAttribute('aria-label')).toBe('Root Document')
      fireEvent.keyDown(tree(), { key: 'ArrowRight' })
      fireEvent.keyDown(tree(), { key: 'Enter' })
      expect(onNodeClick).toHaveBeenCalledWith(sampleTree.children[0])
      fireEvent.keyDown(tree(), { key: ' ' })
      expect(screen.queryByText('Subsection 1.1')).toBeNull()
      expect(sel().getAttribute('aria-expanded')).toBe('false')
      fireEvent.keyDown(tree(), { key: 'ArrowRight' })
      expect(screen.getByText('Subsection 1.1')).toBeDefined()
      fireEvent.keyDown(tree(), { key: 'ArrowRight' })
      expect(sel().getAttribute('aria-label')).toBe('Subsection 1.1')
    })

    it('0 fits to view', () => {
      render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)
      const g = document.querySelector('g.mindmap-viewport')!
      const initial = g.getAttribute('transform')
      fireEvent.keyDown(tree(), { key: '+' })
      expect(g.getAttribute('transform')).not.toEqual(initial)
      fireEvent.keyDown(tree(), { key: '0' })
      expect(g.getAttribute('transform')).toEqual(initial)
    })

    it('two-pointer pinch changes the scale', () => {
      render(<MindmapModal root={sampleTree} isOpen={true} onClose={vi.fn()} />)
      const svg = document.querySelector('svg.mindmap-svg')!
      const g = document.querySelector('g.mindmap-viewport')!
      const initial = g.getAttribute('transform')
      fireEvent.pointerDown(svg, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
      fireEvent.pointerDown(svg, { button: 0, pointerId: 2, clientX: 200, clientY: 100 })
      fireEvent.pointerMove(svg, { pointerId: 2, clientX: 400, clientY: 100 })
      expect(g.getAttribute('transform')).not.toEqual(initial)
      fireEvent.pointerUp(svg, { pointerId: 2 })
      fireEvent.pointerUp(svg, { pointerId: 1 })
    })
  })
})
