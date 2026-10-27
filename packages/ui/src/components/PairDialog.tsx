import React, { useEffect, useId, useRef } from 'react'
import { useT } from '../i18n'
import '../theme/conflict.css'

export function PairDialog(p: { client: string; fingerprint: string; onAllow(): void; onDeny(): void }): React.JSX.Element {
  const t = useT()
  const titleId = useId()
  const denyRef = useRef<HTMLButtonElement | null>(null)
  const denyCb = useRef(p.onDeny)
  denyCb.current = p.onDeny

  useEffect(() => {
    denyRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        denyCb.current()
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
          <p style={{ margin: 0 }}>{t('pair.body', { client: p.client })}</p>
          <p style={{ margin: '12px 0 0' }}>{t('pair.fingerprint', { fp: p.fingerprint })}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="conflict-btn" ref={denyRef} onClick={p.onDeny}>
              {t('pair.deny')}
            </button>
            <button type="button" className="conflict-btn" onClick={p.onAllow}>
              {t('pair.allow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
