import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ContentApp } from './ContentApp'
import React from 'react'

describe('ContentApp', () => {
  it('renders fixed button and calls window.open', () => {
    const originalOpen = window.open
    window.open = vi.fn()
    
    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://123/${path}`)
      }
    } as any

    render(<ContentApp markdown="# Test" />)
    
    const btn = screen.getByRole('button', { name: /Open in MD Reader/i })
    expect(btn).toBeTruthy()
    
    fireEvent.click(btn)
    expect(window.open).toHaveBeenCalledWith('chrome-extension://123/app.html?file=' + encodeURIComponent('http://localhost:3000/'))
    
    window.open = originalOpen
  })
})
