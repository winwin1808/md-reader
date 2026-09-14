import React from 'react'

export type FontScale = 'sm' | 'md' | 'lg' | 'xl'

export interface TopToolbarProps {
  title: string
  tocOpen: boolean
  onToggleToc: () => void
  fontScale: FontScale
  onFontScaleChange: (scale: FontScale) => void
  isReadingMode: boolean
  onToggleReadingMode: () => void
  onOpenSearch?: () => void
  onPresent?: () => void
  onOpenMindmap?: () => void
  rightActions?: React.ReactNode
}

const FONT_SCALES: FontScale[] = ['sm', 'md', 'lg', 'xl']

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  sm: '85%',
  md: '100%',
  lg: '115%',
  xl: '130%',
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--md-fg)',
  cursor: 'pointer',
  padding: '6px 8px',
  borderRadius: '6px',
}

export function TopToolbar(props: TopToolbarProps): React.JSX.Element {
  const currentIndex = FONT_SCALES.indexOf(props.fontScale)

  const handleDecreaseFont = () => {
    if (currentIndex > 0) {
      const prevScale = FONT_SCALES[currentIndex - 1]
      if (prevScale) {
        props.onFontScaleChange(prevScale)
      }
    }
  }

  const handleIncreaseFont = () => {
    if (currentIndex >= 0 && currentIndex < FONT_SCALES.length - 1) {
      const nextScale = FONT_SCALES[currentIndex + 1]
      if (nextScale) {
        props.onFontScaleChange(nextScale)
      }
    }
  }

  return (
    <header
      className="top-toolbar md-no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 90,
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--md-bg)',
        borderBottom: '1px solid var(--md-border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          type="button"
          title="Mục lục"
          aria-label="Mục lục"
          style={buttonStyle}
          onClick={props.onToggleToc}
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
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span
          style={{
            maxWidth: '300px',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            fontWeight: 600,
            color: 'var(--md-fg)',
          }}
        >
          {props.title || 'Untitled'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid var(--md-border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            title="Giảm cỡ chữ"
            aria-label="Giảm cỡ chữ"
            disabled={props.fontScale === 'sm'}
            onClick={handleDecreaseFont}
            style={{
              ...buttonStyle,
              borderRadius: 0,
              padding: '4px 8px',
              fontSize: '12px',
              cursor: props.fontScale === 'sm' ? 'not-allowed' : 'pointer',
              opacity: props.fontScale === 'sm' ? 0.5 : 1,
            }}
          >
            A-
          </button>
          <span
            style={{
              padding: '0 8px',
              fontSize: '12px',
              color: 'var(--md-fg)',
              userSelect: 'none',
            }}
          >
            {FONT_SCALE_LABELS[props.fontScale] || '100%'}
          </span>
          <button
            type="button"
            title="Tăng cỡ chữ"
            aria-label="Tăng cỡ chữ"
            disabled={props.fontScale === 'xl'}
            onClick={handleIncreaseFont}
            style={{
              ...buttonStyle,
              borderRadius: 0,
              padding: '4px 8px',
              fontSize: '12px',
              cursor: props.fontScale === 'xl' ? 'not-allowed' : 'pointer',
              opacity: props.fontScale === 'xl' ? 0.5 : 1,
            }}
          >
            A+
          </button>
        </div>

        <button
          type="button"
          title="Tìm kiếm (Cmd+F)"
          aria-label="Tìm kiếm"
          style={buttonStyle}
          onClick={props.onOpenSearch}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <button
          type="button"
          title="Chế độ tập trung"
          aria-label="Chế độ tập trung"
          style={buttonStyle}
          onClick={props.onToggleReadingMode}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </button>

        {props.onPresent && (
          <button
            type="button"
            title="Trình chiếu (P)"
            aria-label="Trình chiếu"
            style={buttonStyle}
            onClick={props.onPresent}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        )}

        {props.onOpenMindmap && (
          <button
            type="button"
            title="Mindmap (Cmd+M)"
            aria-label="Mindmap"
            style={buttonStyle}
            onClick={props.onOpenMindmap}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        )}

        {props.rightActions}
      </div>
    </header>
  )
}
