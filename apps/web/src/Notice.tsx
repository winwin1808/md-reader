import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@md-reader/ui'

export type NoticeKind = 'info' | 'error'
export interface NoticeItem { id: number; kind: NoticeKind; text: string }

const INFO_MS = 5000

export function useNotices(): { items: NoticeItem[]; push(kind: NoticeKind, text: string): void; dismiss(id: number): void } {
  const [items, setItems] = useState<NoticeItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const t = timers.current
    return () => {
      for (const h of t) clearTimeout(h)
      t.clear()
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((kind: NoticeKind, text: string) => {
    const id = nextId.current++
    setItems((xs) => [...xs, { id, kind, text }])
    if (kind === 'info') {
      const h = setTimeout(() => {
        timers.current.delete(h)
        dismiss(id)
      }, INFO_MS)
      timers.current.add(h)
    }
  }, [dismiss])

  return { items, push, dismiss }
}

export function NoticeStack(p: { items: NoticeItem[]; onDismiss(id: number): void }): React.JSX.Element {
  const t = useT()
  return (
    <div className="web-notices" role="status" aria-live="polite">
      {p.items.map((n) => (
        <div key={n.id} className="web-notice-item" data-kind={n.kind}>
          <span>{n.text}</span>
          <button type="button" className="web-notice-close" aria-label={t('web.close')} onClick={() => p.onDismiss(n.id)}>×</button>
        </div>
      ))}
    </div>
  )
}
