import React, { useState } from 'react'

export type ExportFormat = 'html' | 'docx' | 'pdf' | 'slide-pdf'

export interface ExportModalProps {
  onExport: (format: ExportFormat) => Promise<void> | void
  isExporting?: boolean
}

interface FormatOption {
  format: ExportFormat
  title: string
  description: string
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    format: 'html',
    title: 'HTML Độc lập (.html)',
    description: 'Nhúng toàn bộ hình ảnh và style để xem offline',
  },
  {
    format: 'docx',
    title: 'Microsoft Word (.docx)',
    description: 'Văn bản định dạng Word chuẩn, hỗ trợ bảng và biểu đồ',
  },
  {
    format: 'pdf',
    title: 'Tài liệu PDF (.pdf)',
    description: 'In ra giấy hoặc lưu thành file PDF chuẩn sách',
  },
  {
    format: 'slide-pdf',
    title: 'Slide PDF (Khổ ngang)',
    description: 'In các trang trình chiếu thành file PDF khổ ngang (16:9)',
  },
]

export function ExportModal(props: ExportModalProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const { onExport, isExporting = false } = props

  return (
    <>
      <button
        type="button"
        title="Xuất tài liệu"
        aria-label="Xuất tài liệu"
        onClick={() => setIsOpen(true)}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'var(--md-bg)',
          border: '1px solid var(--md-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--md-fg)',
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
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: '16px',
              border: '1px solid var(--md-border)',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)',
              padding: '24px 28px',
              minWidth: '340px',
              maxWidth: '440px',
              width: '100%',
              background: 'var(--md-bg)',
              color: 'var(--md-fg)',
              boxSizing: 'border-box',
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
                  color: 'var(--md-fg)',
                }}
              >
                Xuất tài liệu
              </h2>
              <button
                type="button"
                aria-label="✕"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '16px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: 'var(--md-fg)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.format}
                  type="button"
                  disabled={isExporting}
                  onClick={() => {
                    setIsOpen(false)
                    onExport(opt.format)
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--md-border)',
                    background: 'var(--md-bg-secondary, var(--md-bg))',
                    color: 'var(--md-fg)',
                    cursor: isExporting ? 'not-allowed' : 'pointer',
                    opacity: isExporting ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '3px',
                    }}
                  >
                    {opt.title}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--md-fg-muted, #888)',
                      lineHeight: 1.4,
                    }}
                  >
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>

            {isExporting && (
              <div
                style={{
                  marginTop: '16px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: 'var(--md-fg-muted, #888)',
                }}
              >
                Đang xuất tài liệu...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
