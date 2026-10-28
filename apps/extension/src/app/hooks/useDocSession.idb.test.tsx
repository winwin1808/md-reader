import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { __resetForTests, createRecord, writeDocText } from '../doc-registry'
import { useDocSession } from './useDocSession'

const errors: unknown[] = []
const onUnhandled = (e: unknown) => { errors.push(e) }

beforeEach(async () => {
  errors.length = 0
  process.on('unhandledRejection', onUnhandled)
  vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
  await __resetForTests()
})
afterEach(async () => {
  cleanup()
  process.off('unhandledRejection', onUnhandled)
  vi.unstubAllGlobals()
  await new Promise((r) => setTimeout(r, 20))
})

describe('useDocSession IDB ordering (14d)', () => {
  it('switching A -> B -> A quickly with writes keeps A data and raises no unhandled errors', async () => {
    const a = await createRecord({ title: 'a.md', originKind: 'drop', originPath: null })
    const b = await createRecord({ title: 'b.md', originKind: 'drop', originPath: null })
    await writeDocText(a, 'alpha text', 'replace')
    await writeDocText(b, 'beta text', 'replace')

    const { result, rerender } = renderHook((p: { id: string }) => useDocSession({ docId: p.id, fileUrl: null }), { initialProps: { id: a.docId } })
    rerender({ id: b.docId })
    rerender({ id: a.docId })
    rerender({ id: b.docId })
    const w1 = writeDocText(a, 'alpha 2', 'replace')
    rerender({ id: a.docId })
    await w1
    await waitFor(() => expect(result.current.synced).toBe(true), { timeout: 5000 })
    await waitFor(() => expect(result.current.content).toBe('alpha 2'), { timeout: 5000 })
    await act(async () => { await new Promise((r) => setTimeout(r, 100)) })
    expect(errors).toEqual([])
    cleanup()
    const verify = await writeDocText(a, 'alpha 2', 'if-clean')
    expect(verify).toBe('written')
  })

  it('rapid mount/unmount churn with concurrent writeDocText raises no errors', async () => {
    const a = await createRecord({ title: 'a.md', originKind: 'drop', originPath: null })
    await writeDocText(a, 'seed', 'replace')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let i = 0; i < 25; i++) {
      const h = renderHook(() => useDocSession({ docId: a.docId, fileUrl: null }))
      if (i % 2) await new Promise((r) => setTimeout(r, i % 5))
      const w = writeDocText(a, 'seed ' + i, 'replace')
      h.unmount()
      await w
    }
    await act(async () => { await new Promise((r) => setTimeout(r, 100)) })
    expect(errors).toEqual([])
    expect(errSpy.mock.calls.map((c) => String(c[0]) + String(c[1]))).toEqual([])
    expect(warnSpy.mock.calls.filter((c) => !String(c[0]).includes('record')).map((c) => String(c[1]))).toEqual([])
    errSpy.mockRestore(); warnSpy.mockRestore()
    expect(await writeDocText(a, 'seed 24', 'if-clean')).toBe('written')
  })
})
