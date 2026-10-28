import React, { useEffect, useId, useRef } from 'react'
import { useT } from '../i18n'
import '../theme/conflict.css'

export interface ConfirmRequest {
  kind: 'share' | 'revoke'
  docTitle: string
  role?: 'view' | 'edit'
  expiresInDays?: 7 | 30 | null
  tokenPrefix?: string
}

export function ConfirmAgentDialog(p: {
  req: ConfirmRequest
  client: string
  onAllow(): void
  onDeny(): void
}): React.JSX.Element {
  const t = useT()
  const titleId = useId()
  const allowRef = useRef<HTMLButtonElement | null>(null)
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

  const { req } = p
  let body: string
  if (req.kind === 'share') {
    const role = t(req.role === 'edit' ? 'agent.role.edit' : 'agent.role.view')
    const expiry = req.expiresInDays
      ? t('agent.expiry.days', { n: req.expiresInDays })
      : t('agent.expiry.never')
    body = t('agent.share', { client: p.client, role, expiry, title: req.docTitle })
  } else {
    body = t('agent.revoke', { client: p.client, prefix: req.tokenPrefix ?? '', title: req.docTitle })
  }

  return (
    <div className="conflict-modal-overlay">
      <div
        className="conflict-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: 440, height: 'auto' }}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return
          const items = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          )
          const first = items[0]
          const last = items[items.length - 1]
          if (!first || !last) return
          const cur = document.activeElement
          if (!e.shiftKey && cur === last) {
            e.preventDefault()
            first.focus()
          } else if (e.shiftKey && cur === first) {
            e.preventDefault()
            last.focus()
          }
        }}
      >
        <div className="conflict-modal-header">
          <h2 id={titleId}>{t('agent.title')}</h2>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: 0 }}>{body}</p>
          <div
            style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="conflict-btn" ref={denyRef} onClick={p.onDeny}>
              {t('agent.deny')}
            </button>
            <button type="button" className="conflict-btn" ref={allowRef} onClick={p.onAllow}>
              {t('agent.allow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
