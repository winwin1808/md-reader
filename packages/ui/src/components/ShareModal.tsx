import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SHARE_EXPIRY_PRESETS } from '@md-reader/core'
import type { CreateLinkRequest, RoomBinding, ShareLink } from '@md-reader/core'
import { Icon } from './Icon'

export interface ShareModalProps {
  open: boolean
  onClose(): void
  binding: RoomBinding | null
  links: ShareLink[]
  onEnable(): Promise<void>
  onCreateLink(req: CreateLinkRequest): Promise<ShareLink>
  onRevoke(prefix: string): Promise<void>
  onRevokeAll?: () => Promise<void>
  now?: () => number
  buildUrl(token: string): string
  busy?: boolean
  error?: string | null
}

const btn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid var(--rule)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  cursor: 'pointer',
  fontSize: '13px',
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
  const { open, onClose, binding, links, onEnable, onCreateLink, onRevoke, onRevokeAll, now = Date.now, buildUrl, busy, error } = props
  const titleId = useId()
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const copying = useRef(false)
  const [role, setRole] = useState<'view' | 'edit'>('view')
  const [expiry, setExpiry] = useState<Expiry>('30d')
  const [label, setLabel] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)

  useEffect(() => {
    if (!open) {
      setCopied(null)
      setCopyFailed(false)
      setLocalError(null)
      setConfirming(null)
      setConfirmAll(false)
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

  if (!open) return null

  const copy = async (l: ShareLink) => {
    if (copying.current) return
    copying.current = true
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(buildUrl(l.token))
      setCopied(l.tokenPrefix)
    } catch {
      setCopied(null)
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

  const visible = links.filter((l) => l.revokedAt === null)

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: '20px 16px', boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: '16px', border: '1px solid var(--rule)', padding: '24px 28px',
          minWidth: '340px', maxWidth: '480px', width: '100%', maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Chia sẻ</h2>
          <button type="button" aria-label="Đóng" onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'inline-flex', padding: '4px 8px' }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {binding === null ? (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--pencil)', lineHeight: 1.5 }}>
              Tài liệu sẽ được tải lên máy chủ đồng bộ. Chỉ người có link mới xem được.
            </p>
            <button type="button" disabled={busy} onClick={() => { void run(() => onEnable()) }} style={btn}>Bật chia sẻ</button>
          </div>
        ) : (
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const req = { role, expiresIn: SHARE_EXPIRY_PRESETS[expiry], label: label.trim() || undefined }
                void run(async () => { await onCreateLink(req); setLabel('') })
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: '12px', fontSize: '13px' }}>
                <legend style={{ fontSize: '12px', color: 'var(--pencil)' }}>Quyền</legend>
                <label><input type="radio" name="share-role" checked={role === 'view'} onChange={() => setRole('view')} /> Xem</label>
                <label><input type="radio" name="share-role" checked={role === 'edit'} onChange={() => setRole('edit')} /> Sửa</label>
              </fieldset>
              <label style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                Hết hạn
                <select value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)}>
                  <option value="7d">7 ngày</option>
                  <option value="30d">30 ngày</option>
                  <option value="never">Không hết hạn</option>
                </select>
              </label>
              <label style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                Nhãn (tuỳ chọn)
                <input type="text" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
              </label>
              <button type="submit" disabled={busy} style={btn}>Tạo link</button>
            </form>
            {visible.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--pencil)' }}>Chưa có link nào.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {visible.map((l) => {
                  const t = now()
                  const expired = l.expiresAt !== null && l.expiresAt <= t
                  return (
                  <li key={l.tokenPrefix} className={expired ? 'is-expired' : undefined} style={{ border: '1px solid var(--rule)', borderRadius: '10px', padding: '10px 12px', background: 'var(--surface)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      <span style={{ fontSize: '11px', border: '1px solid var(--rule)', borderRadius: '4px', padding: '1px 6px', marginRight: '6px' }}>{l.role === 'edit' ? 'Sửa' : 'Xem'}</span>
                      {l.label || (l.role === 'edit' ? 'Link sửa' : 'Link xem')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--pencil)', margin: '2px 0 8px' }}>
                      <span>{l.tokenPrefix}…</span> · <span>{formatRemaining(l.expiresAt, t)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {l.token !== '' ? (
                        <>
                          <input readOnly value={buildUrl(l.token)} aria-label="Link chia sẻ"
                            style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid var(--rule)', borderRadius: '6px', background: 'var(--paper)', color: 'var(--ink)', fontSize: '12px' }} />
                          <button type="button" disabled={busy} style={btn} onClick={() => { void copy(l) }}>
                            {copied === l.tokenPrefix ? 'Đã sao chép' : 'Sao chép'}
                          </button>
                        </>
                      ) : (
                        <span style={{ flex: 1, fontSize: '12px', color: 'var(--pencil)' }}>Chỉ sao chép được ngay khi tạo</span>
                      )}
                      {confirming === l.tokenPrefix ? (
                        <>
                          <span style={{ fontSize: '12px' }}>Thu hồi link này?</span>
                          <button type="button" disabled={busy} style={btn}
                            onClick={() => { setConfirming(null); void run(() => onRevoke(l.tokenPrefix)) }}>Thu hồi</button>
                          <button type="button" style={btn} onClick={() => setConfirming(null)}>Huỷ</button>
                        </>
                      ) : (
                        <button type="button" disabled={busy} style={btn} onClick={() => setConfirming(l.tokenPrefix)}>Thu hồi</button>
                      )}
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}
            {onRevokeAll && visible.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {confirmAll ? (
                  <>
                    <span style={{ fontSize: '12px' }}>Thu hồi tất cả link? Phòng vẫn giữ, có thể tạo link mới.</span>
                    <button type="button" disabled={busy} style={btn}
                      onClick={() => { setConfirmAll(false); void run(() => onRevokeAll()) }}>Tắt chia sẻ</button>
                    <button type="button" style={btn} onClick={() => setConfirmAll(false)}>Huỷ</button>
                  </>
                ) : (
                  <button type="button" disabled={busy} style={btn} onClick={() => setConfirmAll(true)}>Tắt chia sẻ</button>
                )}
              </div>
            )}
            {copyFailed && <p style={{ fontSize: '12px', color: 'var(--pencil)' }}>Không sao chép được</p>}
          </div>
        )}

        {(error || localError) && (
          <div role="alert" style={{ marginTop: '16px', fontSize: '13px', color: 'var(--accent)' }}>{error || localError}</div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}
