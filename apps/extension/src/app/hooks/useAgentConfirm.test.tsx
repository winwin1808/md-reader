import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentConfirm, AGENT_CONFIRM_MS } from './useAgentConfirm'

const REQ = { kind: 'share' } as never

describe('useAgentConfirm', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('allow -> true', async () => {
    const { result } = renderHook(() => useAgentConfirm())
    let p!: Promise<boolean>
    act(() => { p = result.current.confirm(REQ, 'Claude') })
    expect(result.current.pending).toEqual({ req: REQ, client: 'Claude' })
    act(() => result.current.allow())
    await expect(p).resolves.toBe(true)
    expect(result.current.pending).toBeNull()
  })
  it('deny -> false', async () => {
    const { result } = renderHook(() => useAgentConfirm())
    let p!: Promise<boolean>
    act(() => { p = result.current.confirm(REQ, 'AI') })
    act(() => result.current.deny())
    await expect(p).resolves.toBe(false)
  })
  it('timeout rejects and clears pending', async () => {
    const { result } = renderHook(() => useAgentConfirm())
    let p!: Promise<boolean>
    act(() => { p = result.current.confirm(REQ, 'AI') })
    const assertion = expect(p).rejects.toThrow('timeout')
    expect(AGENT_CONFIRM_MS).toBe(100_000)
    act(() => { vi.advanceTimersByTime(99_000) })
    expect(result.current.pending).not.toBeNull()
    act(() => { vi.advanceTimersByTime(1_000) })
    await assertion
    expect(result.current.pending).toBeNull()
  })
  it('second confirm while pending rejects busy', async () => {
    const { result } = renderHook(() => useAgentConfirm())
    act(() => { result.current.confirm(REQ, 'AI').catch(() => {}) })
    await expect(result.current.confirm(REQ, 'AI')).rejects.toThrow('busy')
  })
  it('unmount while pending rejects', async () => {
    const { result, unmount } = renderHook(() => useAgentConfirm())
    let p!: Promise<boolean>
    act(() => { p = result.current.confirm(REQ, 'AI') })
    const assertion = expect(p).rejects.toThrow('timeout')
    unmount()
    await assertion
  })
})
