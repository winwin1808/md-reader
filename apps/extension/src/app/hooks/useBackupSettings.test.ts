// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

vi.mock('../doc-registry', () => ({ listRecent: vi.fn(), docQuery: vi.fn() }))
vi.mock('../backup', () => ({ buildBackup: vi.fn() }))

import { listRecent, docQuery } from '../doc-registry'
import { buildBackup } from '../backup'
import { backupFileName, useBackupSettings } from './useBackupSettings'

const recs = [
  { docId: 'a', title: 'A', room: { roomId: 'r' } },
  { docId: 'b', title: 'B' },
] as any

describe('backupFileName', () => {
  it('formats local date', () => {
    expect(backupFileName(new Date(2026, 10, 9))).toBe('md-reader-backup-2026-11-09.zip')
  })
})

describe('useBackupSettings', () => {
  beforeEach(() => {
    vi.mocked(listRecent).mockReset().mockResolvedValue(recs)
    vi.mocked(docQuery).mockReset()
    vi.mocked(buildBackup).mockReset()
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('does not load when inactive', () => {
    renderHook(() => useBackupSettings(false))
    expect(listRecent).not.toHaveBeenCalled()
  })

  it('sharedDocs only includes records with room', async () => {
    const { result } = renderHook(() => useBackupSettings(true))
    await waitFor(() => expect(result.current.sharedDocs).toEqual([{ docId: 'a', title: 'A' }]))
    expect(listRecent).toHaveBeenCalledWith(Number.POSITIVE_INFINITY)
  })

  it('onBackupAll builds, downloads and reports counts', async () => {
    const blob = new Blob(['x'])
    vi.mocked(buildBackup).mockResolvedValue({ blob, included: 2, failed: ['z'] })
    const create = vi.fn(() => 'blob:u')
    ;(URL as any).createObjectURL = create
    ;(URL as any).revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { result } = renderHook(() => useBackupSettings(false))
    const r = await result.current.onBackupAll()
    expect(buildBackup).toHaveBeenCalledWith(recs)
    expect(create).toHaveBeenCalledWith(blob)
    expect(r).toEqual({ included: 2, failed: 1 })
  })

  it('onBackupAll rejects when buildBackup rejects', async () => {
    vi.mocked(buildBackup).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useBackupSettings(false))
    await expect(result.current.onBackupAll()).rejects.toThrow('boom')
  })

  it('onOpenSharedDoc navigates to docQuery result', async () => {
    vi.mocked(docQuery).mockResolvedValue('?doc=x')
    const assign = vi.fn()
    const orig = window.location
    Object.defineProperty(window, 'location', { value: { ...orig, assign }, configurable: true })
    const { result } = renderHook(() => useBackupSettings(false))
    await result.current.onOpenSharedDoc('x')
    expect(docQuery).toHaveBeenCalledWith('x')
    expect(assign).toHaveBeenCalledWith('?doc=x')
    Object.defineProperty(window, 'location', { value: orig, configurable: true })
  })
})
