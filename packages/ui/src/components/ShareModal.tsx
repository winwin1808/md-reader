import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SHARE_EXPIRY_PRESETS } from '@md-reader/core'
import type { CreateLinkRequest, RoomBinding, ShareLink } from '@md-reader/core'
import { Icon } from './Icon'
import { createT, useT, type TFunction } from '../i18n'
import '../theme/share.css'

export interface ShareModalProps {
  open: boolean
  onClose(): void
  binding: RoomBinding | null
  links: ShareLink[]
  onEnable(): Promise<void>
  onCreateLink(req: CreateLinkRequest): Promise<ShareLink>
  onRevoke(prefix: string): Promise<void>
  onRecreate?: (link: ShareLink) => Promise<void>
  onRevokeAll?: () => Promise<void>
  now?: () => number
  buildUrl(token: string): string
  busy?: boolean
  error?: string | null
  server?: { state: 'missing' | 'unreachable' | 'not-md-reader'; url?: string }
  onSaveServer?(url: string): void
  guideUrl?: string
}

export function formatRemaining(expiresAt: number | null, now: number, t: TFunction = createT('vi')): string {
  if (expiresAt === null) return t('share.expiry.never')
  if (expiresAt <= now) return t('share.expiry.expired')
  const left = expiresAt - now
  if (left < 86_400_000) return t('share.expiry.underDay')
  return t('share.expiry.days', { n: Math.ceil(left / 86_400_000) })
}

type Expiry = '7d' | '30d' | 'never'

export function ShareModal(props: ShareModalProps): React.JSX.Element | null {
  const { open, onClose, binding, links, onEnable, onCreateLink, onRevoke, onRecreate, onRevokeAll, now = Date.now, buildUrl, busy, error, server, onSaveServer, guideUrl } = props
  const t = useT()
  const [serverInput, setServerInput] = useState(server?.url ?? '')
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const copying = useRef(false)
  const [role, setRole] = useState<'view' | 'edit'>('view')
  const [expiry, setExpiry] = useState<Expiry>('30d')
  const [label, setLabel] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [showOff, setShowOff] = useState(false)
  const [created, setCreated] = useState<ShareLink | null>(null)

  useEffect(() => {
    if (!open) {
      setCopied(false)
      setCopyFailed(false)
      setLocalError(null)
      setConfirming(null)
      setConfirmAll(false)
      setCreated(null)
      setShowOff(false)
      setShowLabel(false)
      setLabel('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const visiblePrefixes = links.filter((l) => l.revokedAt === null).map((l) => l.tokenPrefix).join('\u0000')
  useEffect(() => {
    if (visiblePrefixes === '') setConfirmAll(false)
    setConfirming((c) => (c !== null && visiblePrefixes.split('\u0000').includes(c) ? c : null))
  }, [visiblePrefixes])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  if (!open) return null

  const copy = async (l: ShareLink) => {
    if (copying.current) return
    copying.current = true
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(buildUrl(l.token))
      setCopied(true)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setCopyFailed(true)
    } finally {
      copying.current = false
    }
  }

  const run = async (fn: () => Promise<unknown>) => {
    setLocalError(null)
    try {
      await fn()
    } catch (e) {
      setLocalError(e instanceof Error && e.message ? e.message : t('share.actionFailed'))
    }
  }

  const isOff = (l: ShareLink) => l.revokedAt !== null || (l.expiresAt !== null && l.expiresAt <= now())
  const sorted = [...links].sort((x, y) => y.createdAt - x.createdAt)
  const active = sorted.filter((l) => !isOff(l))
  const off = sorted.filter(isOff)
  const visible = active

  const mid = (u: string) => (u.length > 32 ? `${u.slice(0, 18)}…${u.slice(-8)}` : u)
  const onSeg = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setRole((r) => (r === 'view' ? 'edit' : 'view'))
      const next = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]')
      const idx = role === 'view' ? 1 : 0
      next[idx]?.focus()
    }
  }

  const needsSetup = !!server
  const stateMsg = server?.state === 'unreachable' ? t('share.unreachable')
    : server?.state === 'not-md-reader' ? t('share.notServer') : null
  const cmd = `pnpm --filter @md-reader/api exec wrangler login${t('share.setup.cmdSep')}pnpm deploy:api`

  const setupPanel = (
    <div>
      <p className="share-sub">{t('share.setup.intro')}</p>
      <ol className="share-steps" style={{ paddingLeft: 18, margin: '8px 0' }}>
        <li>{t('share.setup.step1')}</li>
        <li>{t('share.setup.step2')} <code>{cmd}</code>{' '}
          <button type="button" className="share-icon-btn" aria-label={t('share.setup.copyCmd')} title={t('share.setup.copyCmd')}
            onClick={() => { void navigator.clipboard?.writeText(cmd).catch(() => {}) }}><Icon name="copy" size={16} /></button>
        </li>
        <li>{t('share.setup.step3')}</li>
      </ol>
      <div className="share-label-row">
        <input type="text" aria-label={t('share.setup.serverAddr')} placeholder={t('share.setup.serverPlaceholder')} value={serverInput} onChange={(e) => setServerInput(e.target.value)} />
        <button type="button" className="share-btn is-primary" onClick={() => onSaveServer?.(serverInput.trim())}>{t('share.setup.saveRetry')}</button>
      </div>
      {stateMsg && <p role="status" className="share-sub">{stateMsg}</p>}
      {guideUrl && <a href={guideUrl} target="_blank" rel="noopener noreferrer" className="share-text-btn">{t('share.setup.guide')}</a>}
    </div>
  )

  const content = (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose} className="share-overlay">
      <div onClick={(e) => e.stopPropagation()} className="share-dialog">
        <div className="share-head">
          <h2 id={titleId} className="share-title">{needsSetup ? t('share.title.setup') : t('share.title')}</h2>
          <button type="button" aria-label={t('share.close')} title={t('share.close')} onClick={onClose} className="share-icon-btn">
            <Icon name="close" size={16} />
          </button>
        </div>
        {!needsSetup && <p className="share-sub">{t('share.anyoneWithLink')}</p>}

        {needsSetup ? setupPanel : binding === null ? (
          <div>
            <p className="share-sub">{t('share.enable.desc')}</p>
            <button type="button" disabled={busy} onClick={() => { void run(() => onEnable()) }} className="share-btn is-primary">{t('share.enable')}</button>
          </div>
        ) : (
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const req = { role, expiresIn: SHARE_EXPIRY_PRESETS[expiry], label: label.trim() || undefined }
                void run(async () => {
                  const l = await onCreateLink(req)
                  setLabel('')
                  setShowLabel(false)
                  if (l && l.token) setCreated(l)
                })
              }}
            >
              <div className="share-create">
                <div className="share-seg" role="radiogroup" aria-label={t('share.permission')} onKeyDown={onSeg}>
                  <button type="button" role="radio" aria-checked={role === 'view'} tabIndex={role === 'view' ? 0 : -1} onClick={() => setRole('view')}>{t('share.role.view')}</button>
                  <button type="button" role="radio" aria-checked={role === 'edit'} tabIndex={role === 'edit' ? 0 : -1} onClick={() => setRole('edit')}>{t('share.role.edit')}</button>
                </div>
                <select className="share-select" aria-label={t('share.expiresLabel')} value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)}>
                  <option value="7d">{t('share.expiry.7d')}</option>
                  <option value="30d">{t('share.expiry.30d')}</option>
                  <option value="never">{t('share.expiry.never')}</option>
                </select>
                <button type="submit" disabled={busy} className="share-btn is-primary">{t('share.createLink')}</button>
              </div>
              {showLabel ? (
                <div className="share-label-row">
                  <input type="text" aria-label={t('share.labelOptional')} placeholder={t('share.labelOptional')} maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />
                </div>
              ) : (
                <button type="button" className="share-text-btn" style={{ marginTop: 6 }} onClick={() => setShowLabel(true)}>{t('share.addLabel')}</button>
              )}
            </form>

            {created && (
              <div className="share-created">
                <span className="share-created-url" title={buildUrl(created.token)} aria-label={t('share.justCreated')}>{mid(buildUrl(created.token))}</span>
                <button type="button" disabled={busy} className="share-btn is-primary" onClick={() => { void copy(created) }}>{t('share.copy')}</button>
              </div>
            )}

            {active.length === 0 ? (
              <p className="share-empty">{t('share.empty')}</p>
            ) : (
              <ul className="share-list">
                {active.map((l) => {
                  const nowMs = now()
                  return (
                    <li key={l.tokenPrefix} className="share-row">
                      <span className={`share-pill${l.role === 'edit' ? ' is-edit' : ''}`}>{l.role === 'edit' ? t('share.role.edit') : t('share.role.view')}</span>
                      <div className="share-row-main">
                        <span className="share-row-name">{l.label || t('share.linkName', { prefix: l.tokenPrefix })}</span>
                        <span className="share-row-meta">{formatRemaining(l.expiresAt, nowMs, t)}</span>
                      </div>
                      {confirming === l.tokenPrefix ? (
                        <span className="share-confirm">
                          <span>{t('share.revokeQ')}</span>
                          <button type="button" disabled={busy} className="share-text-btn is-danger"
                            onClick={() => { setConfirming(null); void run(() => onRevoke(l.tokenPrefix)) }}>{t('share.yes')}</button>
                          <button type="button" className="share-text-btn" onClick={() => setConfirming(null)}>{t('share.no')}</button>
                        </span>
                      ) : (
                        <>
                          {l.token !== '' ? (
                            <button type="button" disabled={busy} className="share-icon-btn" aria-label={t('share.copyLink')} title={t('share.copyLink')} onClick={() => { void copy(l) }}>
                              <Icon name="copy" size={16} />
                            </button>
                          ) : onRecreate ? (
                            <button type="button" disabled={busy} className="share-icon-btn" aria-label={t('share.recreate')}
                              title={t('share.recreateTitle')} onClick={() => { void run(() => onRecreate(l)) }}>
                              <Icon name="refresh" size={16} />
                            </button>
                          ) : null}
                          <button type="button" disabled={busy} className="share-icon-btn is-danger" aria-label={t('share.revokeLink')} title={t('share.revokeLink')} onClick={() => setConfirming(l.tokenPrefix)}>
                            <Icon name="trash" size={16} />
                          </button>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {off.length > 0 && (
              <div className="share-disclosure">
                <button type="button" aria-expanded={showOff} onClick={() => setShowOff((v) => !v)}>
                  <Icon name={showOff ? 'chevron-down' : 'chevron-right'} size={16} />
                  {t('share.offLinks', { count: off.length })}
                </button>
                {showOff && (
                  <ul className="share-list" style={{ marginTop: 4 }}>
                    {off.map((l) => (
                      <li key={l.tokenPrefix} className="share-row is-off">
                        <span className={`share-pill${l.role === 'edit' ? ' is-edit' : ''}`}>{l.role === 'edit' ? t('share.role.edit') : t('share.role.view')}</span>
                        <div className="share-row-main">
                          <span className="share-row-name">{l.label || t('share.linkName', { prefix: l.tokenPrefix })}</span>
                          <span className="share-row-meta">{l.revokedAt !== null ? t('share.revoked') : t('share.expired')}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="share-foot">
              <span>{visible.length > 0 ? t('share.sharingActive', { count: visible.length }) : t('share.noneActive')}</span>
              {onRevokeAll && visible.length > 0 && (
                confirmAll ? (
                  <span className="share-confirm">
                    <span>{t('share.revokeAllQ')}</span>
                    <button type="button" disabled={busy} className="share-text-btn is-danger"
                      onClick={() => { setConfirmAll(false); void run(() => onRevokeAll()) }}>{t('share.yes')}</button>
                    <button type="button" className="share-text-btn" onClick={() => setConfirmAll(false)}>{t('share.no')}</button>
                  </span>
                ) : (
                  <button type="button" disabled={busy} className="share-text-btn is-danger" onClick={() => setConfirmAll(true)}>{t('share.turnOff')}</button>
                )
              )}
            </div>
            <div role="status" aria-live="polite" className="share-toast">{copied ? t('share.copied') : ''}</div>
            {copyFailed && <p className="share-toast">{t('share.copyFailed')}</p>}
          </div>
        )}

        {(error || localError) && <div role="alert" className="share-error">{error || localError}</div>}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}
