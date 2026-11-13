import React, { useEffect, useId, useRef } from 'react'
import { useT } from '../i18n'
import '../theme/conflict.css'

export type PairResult = 'rejected-other' | 'rejected' | 'gone'

const RESULT_KEY = {
  'rejected-other': 'pair.result.other',
  rejected: 'pair.result.rejected',
  gone: 'pair.result.gone',
} as const satisfies Record<PairResult, string>

export function PairDialog(p: {
  client: string
  fingerprint: string
  onAllow(): void
  onDeny(): void
  busy?: boolean
  result?: PairResult
  onClose?(): void
}): React.JSX.Element {
  const t = useT()
  const titleId = useId()
  const denyRef = useRef<HTMLButtonElement | null>(null)
  const denyCb = useRef(p.onDeny)
  denyCb.current = p.onDeny
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const closeCb = useRef(p.onClose)
  closeCb.current = p.onClose
  const busyRef = useRef(!!p.busy)
  busyRef.current = !!p.busy
  const resultRef = useRef(p.result)
  resultRef.current = p.result

  useEffect(() => {
    if (p.result) closeRef.current?.focus()
    else denyRef.current?.focus()
  }, [p.result])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (resultRef.current) closeCb.current?.()
        else if (!busyRef.current) denyCb.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div className="conflict-modal-overlay">
      <div
        className="conflict-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: 440, height: 'auto' }}
      >
        <div className="conflict-modal-header">
          <h2 id={titleId}>{t('pair.title')}</h2>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {p.result ? (
            <>
              <p style={{ margin: 0 }}>{t(RESULT_KEY[p.result])}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="conflict-btn" ref={closeRef} onClick={() => p.onClose?.()}>
                  {t('pair.close')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>{t('pair.body', { client: p.client })}</p>
              <p style={{ margin: '12px 0 0' }}>{t('pair.fingerprint', { fp: p.fingerprint })}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="conflict-btn" ref={denyRef} disabled={p.busy} onClick={p.onDeny}>
                  {t('pair.deny')}
                </button>
                <button type="button" className="conflict-btn" disabled={p.busy} onClick={p.onAllow}>
                  {p.busy ? t('pair.busy') : t('pair.allow')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
