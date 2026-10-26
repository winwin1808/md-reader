import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConfirmRequest } from '@md-reader/ui'

export const AGENT_CONFIRM_MS = 100_000

interface Waiter { resolve(v: boolean): void; reject(e: Error): void; timer: ReturnType<typeof setTimeout> }

export function useAgentConfirm(): {
  pending: { req: ConfirmRequest; client: string } | null
  confirm(c: ConfirmRequest, client: string): Promise<boolean>
  allow(): void
  deny(): void
} {
  const [pending, setPending] = useState<{ req: ConfirmRequest; client: string } | null>(null)
  const waiter = useRef<Waiter | null>(null)

  const confirm = useCallback((c: ConfirmRequest, client: string): Promise<boolean> => {
    if (waiter.current) return Promise.reject(new Error('busy'))
    return new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiter.current = null
        setPending(null)
        reject(new Error('timeout'))
      }, AGENT_CONFIRM_MS)
      waiter.current = { resolve, reject, timer }
      setPending({ req: c, client })
    })
  }, [])

  const settle = useCallback((v: boolean) => {
    const w = waiter.current
    if (!w) return
    waiter.current = null
    clearTimeout(w.timer)
    setPending(null)
    w.resolve(v)
  }, [])
  const allow = useCallback(() => settle(true), [settle])
  const deny = useCallback(() => settle(false), [settle])

  useEffect(() => () => {
    const w = waiter.current
    if (!w) return
    waiter.current = null
    clearTimeout(w.timer)
    w.reject(new Error('timeout'))
  }, [])

  return { pending, confirm, allow, deny }
}
