import React, { useEffect, useId, useState } from 'react'
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

function formatExpiry(expiresAt: number | null): string {
  return expiresAt === null ? 'Không hết hạn' : new Date(expiresAt).toLocaleDateString('vi-VN')
}

export function ShareModal(props: ShareModalProps): React.JSX.Element | null {
  const { open, onClose, binding, links, onEnable, onCreateLink, onRevoke, buildUrl, busy, error } = props
  const titleId = useId()
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)

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
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(buildUrl(l.token))
      setCopied(l.tokenPrefix)
    } catch {
      setCopied(null)
      setCopyFailed(true)
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
            <button type="button" disabled={busy} onClick={() => { void onEnable() }} style={btn}>Bật chia sẻ</button>
          </div>
        ) : (
          <div>
            <button type="button" disabled={busy} style={btn}
              onClick={() => { void onCreateLink({ role: 'view', expiresIn: SHARE_EXPIRY_PRESETS['30d'] }) }}>
              Tạo link xem
            </button>
            {visible.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--pencil)' }}>Chưa có link nào.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {visible.map((l) => (
                  <li key={l.tokenPrefix} style={{ border: '1px solid var(--rule)', borderRadius: '10px', padding: '10px 12px', background: 'var(--surface)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{l.label || 'Link xem'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--pencil)', margin: '2px 0 8px' }}>
                      <span>{l.tokenPrefix}…</span> · <span>{formatExpiry(l.expiresAt)}</span>
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
                      <button type="button" disabled={busy} style={btn} onClick={() => { void onRevoke(l.tokenPrefix) }}>Thu hồi</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {copyFailed && <p style={{ fontSize: '12px', color: 'var(--pencil)' }}>Không sao chép được</p>}
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: '16px', fontSize: '13px', color: 'var(--accent)' }}>{error}</div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}
