import { afterEach, expect } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
})

// 16c: an IndexedDB error escaping as an unhandled rejection used to surface as an anonymous
// "Unhandled Errors" block. Name the test that was running so a rare flake is attributable.
// Vitest still records the rejection itself (the run fails); this only adds context.
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('unhandledRejection', (reason) => {
    const name = (reason as { name?: string } | null)?.name
    if (name === 'TransactionInactiveError' || name === 'InvalidStateError' || name === 'AbortError') {
      const stack = (reason as Error).stack ?? String(reason)
      console.error(`[idb-unhandled] ${name} during "${expect.getState().currentTestName ?? 'unknown test'}"\n${stack}`)
    }
  })
}
