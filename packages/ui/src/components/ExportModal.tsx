import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { useT } from '../i18n'
import type { MessageKey } from '../i18n'

export type ExportFormat = 'html' | 'pdf' | 'docx' | 'slides-pdf'

export interface ExportModalProps {
  onExport: (format: ExportFormat) => Promise<void>
  hasSlides: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface FormatOption {
  format: ExportFormat
  icon: IconName
  title: MessageKey
  description: MessageKey
  working: MessageKey
}

const FORMAT_OPTIONS: FormatOption[] = [
  { format: 'html', icon: 'export', title: 'settings.export.html.title', description: 'settings.export.html.desc', working: 'settings.export.html.working' },
  { format: 'pdf', icon: 'book', title: 'settings.export.pdf.title', description: 'settings.export.pdf.desc', working: 'settings.export.pdf.working' },
  { format: 'docx', icon: 'edit', title: 'settings.export.docx.title', description: 'settings.export.docx.desc', working: 'settings.export.docx.working' },
  { format: 'slides-pdf', icon: 'present', title: 'settings.export.slidespdf.title', description: 'settings.export.slidespdf.desc', working: 'settings.export.slidespdf.working' },
]

function useModalOpen(open: boolean | undefined, onOpenChange: ((open: boolean) => void) | undefined): [boolean, (v: boolean) => void] {
  const [inner, setInner] = useState(false)
  const controlled = open !== undefined
  const isOpen = controlled ? Boolean(open) : inner
  const returnRef = useRef<Element | null>(null)
  useEffect(() => {
    if (isOpen) {
      returnRef.current = document.activeElement
      return
    }
    const el = returnRef.current as HTMLElement | null
    returnRef.current = null
    if (el && el.isConnected && typeof el.focus === 'function') el.focus()
  }, [isOpen])
  const setIsOpen = (v: boolean) => {
    if (!controlled) setInner(v)
    onOpenChange?.(v)
  }
  return [isOpen, setIsOpen]
}

export function ExportModal(props: ExportModalProps): React.JSX.Element {
  const t = useT()
  const { onExport, hasSlides } = props
  const [isOpen, setIsOpen] = useModalOpen(props.open, props.onOpenChange)
  const [working, setWorking] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<{ format: ExportFormat; message: string } | null>(null)
  const workingRef = useRef<ExportFormat | null>(null)

  const run = async (format: ExportFormat) => {
    if (workingRef.current) return
    workingRef.current = format
    setWorking(format)
    setError(null)
    try {
      await onExport(format)
      workingRef.current = null
      setWorking(null)
      setIsOpen(false)
    } catch (err) {
      workingRef.current = null
      setWorking(null)
      setError({ format, message: err instanceof Error ? err.message : String(err) })
    }
  }

  const requestClose = () => {
    if (workingRef.current) return
    setError(null)
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !workingRef.current) {
        setError(null)
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const options = FORMAT_OPTIONS.filter((o) => o.format !== 'slides-pdf' || hasSlides)

  const modalContent = isOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy={working !== null}
      onClick={requestClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: '16px',
          border: '1px solid var(--rule)',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.35)',
          padding: '24px 28px',
          minWidth: '340px',
          maxWidth: '440px',
          width: '100%',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: 'var(--paper)',
          color: 'var(--ink)',
          boxSizing: 'border-box',
          margin: 'auto',
          position: 'relative',
        }}
      >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              >
                {t('settings.export.title')}
              </h2>
              <button
                type="button"
                aria-label={t('common.close')}
                disabled={working !== null}
                onClick={requestClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  display: 'inline-flex',
                  cursor: working ? 'not-allowed' : 'pointer',
                  color: 'var(--ink)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {options.map((opt) => {
                const isWorking = working === opt.format
                return (
                  <button
                    key={opt.format}
                    type="button"
                    disabled={working !== null}
                    onClick={() => { void run(opt.format) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      textAlign: 'left',
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--rule)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      cursor: working ? 'not-allowed' : 'pointer',
                      opacity: working && !isWorking ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Icon name={opt.icon} size={20} />
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px' }}>
                        {isWorking ? t(opt.working) : t(opt.title)}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--pencil)', lineHeight: 1.4 }}>
                        {t(opt.description)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {error && (
              <div role="alert" style={{ marginTop: '16px', fontSize: '13px', color: 'var(--ink)' }}>
                <span>{error.message}</span>{' '}
                <button type="button" onClick={() => { void run(error.format) }}>
                  {t('common.retry')}
                </button>
              </div>
            )}
          </div>
        </div>
  ) : null

  return (
    <>
      {props.open === undefined && <button
        type="button"
        title={t('settings.export.title')}
        aria-label={t('settings.export.title')}
        onClick={() => setIsOpen(true)}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'var(--paper)',
          border: '1px solid var(--rule)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--ink)',
          padding: 0,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>}

      {isOpen && (typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent)}
    </>
  )
}
