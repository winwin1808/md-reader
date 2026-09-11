import React from 'react'
import { render, screen, act, cleanup } from '@testing-library/react'
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
          get: vi.fn().mockResolvedValue({ theme: 'dark' }),
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
    expect((window as any).chrome.storage.sync.get).toHaveBeenCalledWith('theme')
  })

  it('falls back to system theme when storage throws', async () => {
    (window as any).chrome.storage.sync.get = vi.fn().mockRejectedValue(new Error('no permission'))
    
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
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
