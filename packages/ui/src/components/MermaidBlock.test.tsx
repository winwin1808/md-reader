import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MermaidBlock } from './MermaidBlock'

vi.mock('mermaid', () => {
  return {
    default: {
      initialize: vi.fn(),
      render: vi.fn().mockImplementation(async (id: string, code: string) => {
        if (code === 'error') {
          throw new Error('Mermaid syntax error')
        }
        return { svg: `<svg id="${id}" data-testid="mermaid-svg">${code}</svg>` }
      })
    }
  }
})

describe('MermaidBlock', () => {
  it('renders loading state initially and then svg on success', async () => {
    const { container } = render(<MermaidBlock code="graph TD; A-->B;" />)
    
    // initially loading
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.style.opacity).toBe('0.5')
    expect(pre?.textContent).toBe('graph TD; A-->B;')

    // wait for success
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-svg')).toBeDefined()
    })

    const svg = screen.getByTestId('mermaid-svg')
    expect(svg.textContent).toBe('graph TD; A-->B;')
  })

  it('renders error state when mermaid throws', async () => {
    render(<MermaidBlock code="error" />)

    await waitFor(() => {
      expect(screen.getByText(/Error rendering mermaid graph/)).toBeDefined()
    })
    
    expect(screen.getByText('error')).toBeDefined() // raw code should be rendered
  })
})
