import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SHARE_EXPIRY_PRESETS } from '@md-reader/core'
import type { CreateLinkRequest, RoomBinding, ShareLink } from '@md-reader/core'
import { Icon } from './Icon'
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
}

export function formatRemaining(expiresAt: number | null, now: number): string {
  if (expiresAt === null) return 'Không hết hạn'
  if (expiresAt <= now) return 'Đã hết hạn'
  const left = expiresAt - now
  if (left < 86_400_000) return 'còn dưới 1 ngày'
  return `còn ${Math.ceil(left / 86_400_000)} ngày`
}

type Expiry = '7d' | '30d' | 'never'

export function ShareModal(props: ShareModalProps): React.JSX.Element | null {
  const { open, onClose, binding, links, onEnable, onCreateLink, onRevoke, onRecreate, onRevokeAll, now = Date.now, buildUrl, busy, error } = props
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
      setLocalError(e instanceof Error && e.message ? e.message : 'Không thực hiện được')
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

  const content = (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose} className="share-overlay">
      <div onClick={(e) => e.stopPropagation()} className="share-dialog">
        <div className="share-head">
          <h2 id={titleId} className="share-title">Chia sẻ</h2>
          <button type="button" aria-label="Đóng" title="Đóng" onClick={onClose} className="share-icon-btn">
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="share-sub">Ai có link đều mở được tài liệu này.</p>

        {binding === null ? (
          <div>
            <p className="share-sub">Tài liệu sẽ được tải lên máy chủ đồng bộ. Chỉ người có link mới xem được.</p>
            <button type="button" disabled={busy} onClick={() => { void run(() => onEnable()) }} className="share-btn is-primary">Bật chia sẻ</button>
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
                <div className="share-seg" role="radiogroup" aria-label="Quyền" onKeyDown={onSeg}>
                  <button type="button" role="radio" aria-checked={role === 'view'} tabIndex={role === 'view' ? 0 : -1} onClick={() => setRole('view')}>Xem</button>
                  <button type="button" role="radio" aria-checked={role === 'edit'} tabIndex={role === 'edit' ? 0 : -1} onClick={() => setRole('edit')}>Sửa</button>
                </div>
                <select className="share-select" aria-label="Hết hạn" value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)}>
                  <option value="7d">7 ngày</option>
                  <option value="30d">30 ngày</option>
                  <option value="never">Không hết hạn</option>
                </select>
                <button type="submit" disabled={busy} className="share-btn is-primary">Tạo link</button>
              </div>
              {showLabel ? (
                <div className="share-label-row">
                  <input type="text" aria-label="Nhãn (tuỳ chọn)" placeholder="Nhãn (tuỳ chọn)" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />
                </div>
              ) : (
                <button type="button" className="share-text-btn" style={{ marginTop: 6 }} onClick={() => setShowLabel(true)}>Thêm nhãn</button>
              )}
            </form>

            {created && (
              <div className="share-created">
                <span className="share-created-url" title={buildUrl(created.token)} aria-label="Link vừa tạo">{mid(buildUrl(created.token))}</span>
                <button type="button" disabled={busy} className="share-btn is-primary" onClick={() => { void copy(created) }}>Sao chép</button>
              </div>
            )}

            {active.length === 0 ? (
              <p className="share-empty">Chưa có link nào. Tạo link xem để gửi cho người khác.</p>
            ) : (
              <ul className="share-list">
                {active.map((l) => {
                  const t = now()
                  return (
                    <li key={l.tokenPrefix} className="share-row">
                      <span className={`share-pill${l.role === 'edit' ? ' is-edit' : ''}`}>{l.role === 'edit' ? 'Sửa' : 'Xem'}</span>
                      <div className="share-row-main">
                        <span className="share-row-name">{l.label || `Link ${l.tokenPrefix}`}</span>
                        <span className="share-row-meta">{formatRemaining(l.expiresAt, t)}</span>
                      </div>
                      {confirming === l.tokenPrefix ? (
                        <span className="share-confirm">
                          <span>Thu hồi?</span>
                          <button type="button" disabled={busy} className="share-text-btn is-danger"
                            onClick={() => { setConfirming(null); void run(() => onRevoke(l.tokenPrefix)) }}>Có</button>
                          <button type="button" className="share-text-btn" onClick={() => setConfirming(null)}>Không</button>
                        </span>
                      ) : (
                        <>
                          {l.token !== '' ? (
                            <button type="button" disabled={busy} className="share-icon-btn" aria-label="Sao chép link" title="Sao chép link" onClick={() => { void copy(l) }}>
                              <Icon name="copy" size={16} />
                            </button>
                          ) : onRecreate ? (
                            <button type="button" disabled={busy} className="share-icon-btn" aria-label="Tạo lại link"
                              title="Link tạo trên máy khác — tạo link mới cùng quyền" onClick={() => { void run(() => onRecreate(l)) }}>
                              <Icon name="refresh" size={16} />
                            </button>
                          ) : null}
                          <button type="button" disabled={busy} className="share-icon-btn is-danger" aria-label="Thu hồi link" title="Thu hồi link" onClick={() => setConfirming(l.tokenPrefix)}>
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
                  Link đã tắt ({off.length})
                </button>
                {showOff && (
                  <ul className="share-list" style={{ marginTop: 4 }}>
                    {off.map((l) => (
                      <li key={l.tokenPrefix} className="share-row is-off">
                        <span className={`share-pill${l.role === 'edit' ? ' is-edit' : ''}`}>{l.role === 'edit' ? 'Sửa' : 'Xem'}</span>
                        <div className="share-row-main">
                          <span className="share-row-name">{l.label || `Link ${l.tokenPrefix}`}</span>
                          <span className="share-row-meta">{l.revokedAt !== null ? 'Đã thu hồi' : 'Hết hạn'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="share-foot">
              <span>{visible.length > 0 ? `Đang chia sẻ · ${visible.length} link hoạt động` : 'Chưa có link hoạt động'}</span>
              {onRevokeAll && visible.length > 0 && (
                confirmAll ? (
                  <span className="share-confirm">
                    <span>Thu hồi tất cả link?</span>
                    <button type="button" disabled={busy} className="share-text-btn is-danger"
                      onClick={() => { setConfirmAll(false); void run(() => onRevokeAll()) }}>Có</button>
                    <button type="button" className="share-text-btn" onClick={() => setConfirmAll(false)}>Không</button>
                  </span>
                ) : (
                  <button type="button" disabled={busy} className="share-text-btn is-danger" onClick={() => setConfirmAll(true)}>Tắt chia sẻ</button>
                )
              )}
            </div>
            <div role="status" aria-live="polite" className="share-toast">{copied ? 'Đã sao chép' : ''}</div>
            {copyFailed && <p className="share-toast">Không sao chép được</p>}
          </div>
        )}

        {(error || localError) && <div role="alert" className="share-error">{error || localError}</div>}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}
