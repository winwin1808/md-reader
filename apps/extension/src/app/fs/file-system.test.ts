import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isFileSystemAccessSupported,
  openLocalFile,
  saveToHandle,
  saveFileAs,
  verifyHandlePermission,
} from './file-system'

// In-memory mock for IndexedDB
function createMockIndexedDB() {
  const databases = new Map<string, { version: number; stores: Map<string, Map<any, any>> }>()

  return {
    open(dbName: string, version = 1) {
      const request: any = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      }

      setTimeout(() => {
        let dbRecord = databases.get(dbName)
        let isUpgradeNeeded = false

        if (!dbRecord) {
          dbRecord = { version: 0, stores: new Map() }
          databases.set(dbName, dbRecord)
        }

        if (dbRecord.version < version) {
          isUpgradeNeeded = true
          dbRecord.version = version
        }

        const dbInstance = {
          name: dbName,
          version: dbRecord.version,
          objectStoreNames: {
            contains(storeName: string) {
              return dbRecord!.stores.has(storeName)
            },
          },
          createObjectStore(storeName: string) {
            if (!dbRecord!.stores.has(storeName)) {
              dbRecord!.stores.set(storeName, new Map())
            }
            return {}
          },
          transaction(storeName: string, _mode: string) {
            const storeMap = dbRecord!.stores.get(storeName) ?? new Map()
            const tx: any = {
              oncomplete: null,
              onerror: null,
              objectStore(_sName: string) {
                return {
                  put(value: any, key: any) {
                    const req: any = { onsuccess: null, onerror: null, result: key }
                    setTimeout(() => {
                      storeMap.set(key, value)
                      req.onsuccess?.({ target: req })
                    }, 0)
                    return req
                  },
                  get(key: any) {
                    const req: any = { onsuccess: null, onerror: null, result: undefined }
                    setTimeout(() => {
                      req.result = storeMap.get(key)
                      req.onsuccess?.({ target: req })
                    }, 0)
                    return req
                  },
                  delete(key: any) {
                    const req: any = { onsuccess: null, onerror: null, result: undefined }
                    setTimeout(() => {
                      storeMap.delete(key)
                      req.onsuccess?.({ target: req })
                    }, 0)
                    return req
                  },
                }
              },
            }
            return tx
          },
          close() {},
        }

        request.result = dbInstance

        if (isUpgradeNeeded && request.onupgradeneeded) {
          request.onupgradeneeded({ target: request })
        }

        if (request.onsuccess) {
          request.onsuccess({ target: request })
        }
      }, 0)

      return request
    },
  }
}

describe('file-system', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    // Setup window object if in Node environment
    if (!globalThis.window) {
      ;(globalThis as any).window = globalThis
    }
    ;(globalThis as any).indexedDB = createMockIndexedDB()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalWindow === undefined) {
      delete (globalThis as any).window
    } else {
      globalThis.window = originalWindow
    }
    delete (globalThis as any).indexedDB
  })

  describe('isFileSystemAccessSupported', () => {
    it('returns true when showOpenFilePicker is defined on window', () => {
      ;(window as any).showOpenFilePicker = vi.fn()
      expect(isFileSystemAccessSupported()).toBe(true)
    })

    it('returns false when showOpenFilePicker is undefined', () => {
      delete (window as any).showOpenFilePicker
      expect(isFileSystemAccessSupported()).toBe(false)
    })
  })

  describe('openLocalFile', () => {
    it('opens picker with markdown filter, reads file text, and returns handle, file, and content', async () => {
      const mockFile = new File(['# Hello World'], 'test.md', {
        type: 'text/markdown',
        lastModified: 1700000000000,
      })
      // Ensure file.text() is available
      if (!mockFile.text) {
        mockFile.text = async () => '# Hello World'
      }

      const mockHandle = {
        kind: 'file',
        name: 'test.md',
        getFile: vi.fn().mockResolvedValue(mockFile),
      }

      const showOpenFilePicker = vi.fn().mockResolvedValue([mockHandle])
      ;(window as any).showOpenFilePicker = showOpenFilePicker

      const result = await openLocalFile()

      expect(showOpenFilePicker).toHaveBeenCalledWith({
        types: [
          {
            description: 'Markdown Files',
            accept: {
              'text/markdown': ['.md', '.markdown'],
            },
          },
        ],
        multiple: false,
      })
      expect(result).toEqual({
        handle: mockHandle,
        file: mockFile,
        content: '# Hello World',
      })
    })

    it('returns null when user cancels (AbortError)', async () => {
      const abortError = new Error('User cancelled')
      abortError.name = 'AbortError'
      ;(window as any).showOpenFilePicker = vi.fn().mockRejectedValue(abortError)

      const result = await openLocalFile()
      expect(result).toBeNull()
    })

    it('returns null when showOpenFilePicker returns empty array', async () => {
      ;(window as any).showOpenFilePicker = vi.fn().mockResolvedValue([])

      const result = await openLocalFile()
      expect(result).toBeNull()
    })
  })

  describe('saveToHandle', () => {
    it('creates writable stream, writes text, closes, and returns timestamp', async () => {
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }
      const updatedFile = new File(['new content'], 'test.md', {
        lastModified: 1700000001000,
      })
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
        getFile: vi.fn().mockResolvedValue(updatedFile),
      }

      const lastModified = await saveToHandle(mockHandle as any, 'new content')

      expect(mockHandle.createWritable).toHaveBeenCalled()
      expect(mockWritable.write).toHaveBeenCalledWith('new content')
      expect(mockWritable.close).toHaveBeenCalled()
      expect(lastModified).toBe(1700000001000)
    })
  })

  describe('saveFileAs', () => {
    it('calls showSaveFilePicker with suggested name and writes content', async () => {
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }
      const mockFile = new File(['save as content'], 'custom.md', {
        lastModified: 1700000002000,
      })
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
        getFile: vi.fn().mockResolvedValue(mockFile),
      }

      const showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle)
      ;(window as any).showSaveFilePicker = showSaveFilePicker

      const result = await saveFileAs('custom.md', 'save as content')

      expect(showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: 'custom.md',
        types: [
          {
            description: 'Markdown Files',
            accept: {
              'text/markdown': ['.md', '.markdown'],
            },
          },
        ],
      })
      expect(mockHandle.createWritable).toHaveBeenCalled()
      expect(mockWritable.write).toHaveBeenCalledWith('save as content')
      expect(mockWritable.close).toHaveBeenCalled()
      expect(result).toEqual({
        handle: mockHandle,
        file: mockFile,
      })
    })

    it('returns null when user cancels showSaveFilePicker (AbortError)', async () => {
      const abortError = new Error('User cancelled save')
      abortError.name = 'AbortError'
      ;(window as any).showSaveFilePicker = vi.fn().mockRejectedValue(abortError)

      const result = await saveFileAs('custom.md', 'save as content')
      expect(result).toBeNull()
    })
  })

  describe('verifyHandlePermission', () => {
    it('returns true when permission is already granted without requesting', async () => {
      const mockHandle = {
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn(),
      }

      const granted = await verifyHandlePermission(mockHandle as any)

      expect(granted).toBe(true)
      expect(mockHandle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
      expect(mockHandle.requestPermission).not.toHaveBeenCalled()
    })

    it('requests permission when queryPermission is prompt, and returns true if granted', async () => {
      const mockHandle = {
        queryPermission: vi.fn().mockResolvedValue('prompt'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
      }

      const granted = await verifyHandlePermission(mockHandle as any)

      expect(granted).toBe(true)
      expect(mockHandle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
      expect(mockHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    })

    it('returns false when requestPermission is denied', async () => {
      const mockHandle = {
        queryPermission: vi.fn().mockResolvedValue('prompt'),
        requestPermission: vi.fn().mockResolvedValue('denied'),
      }

      const granted = await verifyHandlePermission(mockHandle as any)

      expect(granted).toBe(false)
      expect(mockHandle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
      expect(mockHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    })

    it('returns false when handle.queryPermission throws', async () => {
      const mockHandle = {
        queryPermission: vi.fn().mockRejectedValue(new Error('Permission query failed')),
        requestPermission: vi.fn(),
      }

      const granted = await verifyHandlePermission(mockHandle as any)

      expect(granted).toBe(false)
    })
  })
})
