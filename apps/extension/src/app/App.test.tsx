import React from 'react'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { App } from './App'
import { IndexeddbPersistence } from 'y-indexeddb'

// Mock dependencies
vi.mock('y-indexeddb', () => {
  return {
    IndexeddbPersistence: vi.fn().mockImplementation(() => {
      return {
        destroy: vi.fn(),
      }
    }),
  }
})

describe('App', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock chrome storage
    (window as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ recentFiles: [] }),
          set: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({ theme: 'dark', colorTheme: 'green' }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as any
  })

  it('renders placeholder with loaded theme and yjs doc', async () => {
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
    expect(placeholder.textContent).toContain('MD Reader')
    
    // Check if IndexeddbPersistence is called
    expect(IndexeddbPersistence).toHaveBeenCalled()
    expect((window as any).chrome.storage.sync.get).toHaveBeenCalledWith(['theme', 'colorTheme', 'autoFormatMd'])
  })
  
  it('loads colorTheme and renders ThemePicker', async () => {
    await act(async () => {
      render(<App />)
    })
    // open settings modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    })
    
    const navyBtn = screen.getByRole('button', { name: 'Select navy theme' })
    expect(navyBtn).toBeDefined()
    
    // the green one should be selected
    const greenBtn = screen.getByRole('button', { name: 'Select green theme' })
    expect(greenBtn.style.border).toContain('2px solid rgb(59, 130, 246)')
    
    // changing color theme
    await act(async () => {
      fireEvent.click(navyBtn)
    })
    
    expect((window as any).chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({ colorTheme: 'navy' }))
  })

  it('falls back to system theme and black colorTheme when storage throws', async () => {
    (window as any).chrome.storage.sync.get = vi.fn().mockRejectedValue(new Error('no permission'))
    
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
    // open settings modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    })
    
    // The black button should be selected since fallback is black
    const blackBtn = screen.getByRole('button', { name: 'Select black theme' })
    expect(blackBtn.style.border).toContain('2px solid rgb(59, 130, 246)')
  })

  it('handles IndexeddbPersistence throwing', async () => {
    vi.mocked(IndexeddbPersistence).mockImplementationOnce(function() {
      throw new Error('idb error')
    } as any)
    
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
  })
})
