import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '../src/app/App'

vi.mock('y-indexeddb', () => {
  return {
    IndexeddbPersistence: class {
      destroy() {}
      once(event: string, cb: () => void) {
        if (event === 'synced') {
          setTimeout(cb, 0)
        }
      }
    },
  }
})

const sampleMarkdown = `# Architecture Overview

Introductory text about the system.

\`\`\`excalidraw
{"type":"excalidraw","version":2,"source":"test","elements":[{"type":"rectangle","id":"rect1","x":10,"y":10,"width":100,"height":50}]}
\`\`\`

## System Components

Details about the components.

### Core Engine

Core engine details.
`

describe('Phase 4 E2E Integration Smoke Test: Mindmap and Excalidraw', () => {
  beforeEach(() => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=architecture.md') as any

    const storageLocal: Record<string, any> = {
      'file_content_architecture.md': sampleMarkdown,
    }

    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn((key: string) => Promise.resolve({ [key]: storageLocal[key] })),
          set: vi.fn((items: any) => {
            Object.assign(storageLocal, items)
            return Promise.resolve()
          }),
          remove: vi.fn(() => Promise.resolve()),
        },
        sync: {
          get: vi.fn(() => Promise.resolve({})),
          set: vi.fn(() => Promise.resolve()),
        },
      },
      runtime: {
        id: 'test-ext-id',
      },
    } as any

    Element.prototype.scrollIntoView = vi.fn()
  })

  it('renders App with markdown, verifies Excalidraw, opens MindmapModal, verifies nodes, collapse/expand, node click scroll, and export buttons', async () => {
    const { container } = render(React.createElement(App))

    // 1. Verifies Excalidraw block is rendered
    await waitFor(() => {
      const excalidrawBlock =
        container.querySelector('.excalidraw-block') ||
        container.querySelector('.excalidraw-svg')
      expect(excalidrawBlock).toBeTruthy()
    })

    // Also verify content is loaded
    expect(screen.getAllByText('Architecture Overview').length).toBeGreaterThanOrEqual(1)

    // 2. Opens MindmapModal via toolbar button or Cmd+M
    fireEvent.keyDown(window, { key: 'm', metaKey: true })

    let modal!: HTMLElement
    await waitFor(() => {
      modal = screen.getByRole('dialog')
      expect(modal).toBeTruthy()
    })

    // 3. Verifies Mindmap nodes are rendered
    expect(modal.querySelector('.mindmap-svg')).toBeTruthy()
    const nodeTexts = Array.from(modal.querySelectorAll('.mindmap-node-text')).map(
      (el) => el.textContent
    )
    expect(nodeTexts).toContain('architecture')
    expect(nodeTexts).toContain('System Components')
    expect(nodeTexts).toContain('Core Engine')

    // 4. Verifies collapse/expand interaction
    const collapseHandles = modal.querySelectorAll('.mindmap-collapse-handle')
    expect(collapseHandles.length).toBeGreaterThan(0)
    const targetHandle = collapseHandles[collapseHandles.length - 1]
    if (targetHandle) {
      // Collapse
      fireEvent.click(targetHandle)
      await waitFor(() => {
        const texts = Array.from(modal.querySelectorAll('.mindmap-node-text')).map(
          (el) => el.textContent
        )
        expect(texts).not.toContain('Core Engine')
      })

      // Expand
      fireEvent.click(targetHandle)
      await waitFor(() => {
        const texts = Array.from(modal.querySelectorAll('.mindmap-node-text')).map(
          (el) => el.textContent
        )
        expect(texts).toContain('Core Engine')
      })
    }

    // 5. Verifies export buttons
    const svgBtn = modal.querySelector('button[aria-label="Tải SVG"]')
    const pngBtn = modal.querySelector('button[aria-label="Tải PNG"]')
    expect(svgBtn).toBeTruthy()
    expect(pngBtn).toBeTruthy()

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
    if (svgBtn) {
      fireEvent.click(svgBtn)
      expect(window.URL.createObjectURL).toHaveBeenCalled()
    }

    // 6. Verifies clicking node scrolls to heading and closes modal
    const engineNode = Array.from(modal.querySelectorAll('.mindmap-node-text')).find(
      (el) => el.textContent === 'Core Engine'
    )
    expect(engineNode).toBeTruthy()
    if (engineNode) {
      fireEvent.click(engineNode)
    }

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
