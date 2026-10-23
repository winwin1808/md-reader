import React, { useRef } from 'react'
import { Icon } from './Icon'
import type { Contrast, ThemeMode } from '../theme/ThemeProvider'

export interface PalettePickerProps {
  mode: ThemeMode
  contrast: Contrast
  onModeChange(m: ThemeMode): void
  onContrastChange(c: Contrast): void
}

const OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: 'Giấy' },
  { key: 'dark', label: 'Than chì' },
  { key: 'system', label: 'Theo hệ thống' },
]

// Literal values depict OTHER palettes; allowed only in preview swatches.
const PAPER = { paper: '#F1F3F2', ink: '#1B2422', band: '#F3DE4A' }
const GRAPHITE = { paper: '#161C1B', ink: '#E3E8E6', band: '#D9C640' }

function Page(props: { p: typeof PAPER }): React.JSX.Element {
  const { p } = props
  return (
    <>
      <rect width="60" height="40" fill={p.paper} />
      <rect x="6" y="6" width="30" height="5" fill={p.band} />
      <rect x="6" y="16" width="44" height="3" fill={p.ink} />
      <rect x="6" y="23" width="36" height="3" fill={p.ink} />
      <rect x="6" y="30" width="40" height="3" fill={p.ink} />
    </>
  )
}

function Preview(props: { kind: ThemeMode }): React.JSX.Element {
  const { kind } = props
  return (
    <svg viewBox="0 0 60 40" width="60" height="40" aria-hidden="true" focusable="false" style={{ display: 'block', borderRadius: 4 }}>
      {kind === 'light' && <Page p={PAPER} />}
      {kind === 'dark' && <Page p={GRAPHITE} />}
      {kind === 'system' && (
        <>
          <defs>
            <clipPath id="pp-sys-top"><polygon points="0,0 60,0 0,40" /></clipPath>
            <clipPath id="pp-sys-bot"><polygon points="60,0 60,40 0,40" /></clipPath>
          </defs>
          <g clipPath="url(#pp-sys-top)"><Page p={PAPER} /></g>
          <g clipPath="url(#pp-sys-bot)"><Page p={GRAPHITE} /></g>
        </>
      )}
    </svg>
  )
}

export function PalettePicker(props: PalettePickerProps): React.JSX.Element {
  const { mode, contrast, onModeChange, onContrastChange } = props
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const keyHandled = useRef(false)
  const idx = Math.max(0, OPTIONS.findIndex((o) => o.key === mode))

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
      const next = OPTIONS[(i + d + OPTIONS.length) % OPTIONS.length]!
      onModeChange(next.key)
      refs.current[next.key]?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      keyHandled.current = true
      onModeChange(OPTIONS[i]!.key)
    }
  }

  return (
    <div className="palette-picker">
      <div role="radiogroup" aria-label="Bảng màu" style={{ display: 'flex', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
        {OPTIONS.map((o, i) => {
          const selected = o.key === mode
          return (
            <button
              key={o.key}
              ref={(el) => { refs.current[o.key] = el }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={i === idx ? 0 : -1}
              onClick={() => {
                if (keyHandled.current) { keyHandled.current = false; return }
                onModeChange(o.key)
              }}
              onKeyUp={() => { setTimeout(() => { keyHandled.current = false }, 0) }}
              onKeyDown={(e) => onKeyDown(e, i)}
              className="palette-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: selected ? 7 : 8,
                position: 'relative',
                cursor: 'pointer',
                background: 'var(--md-surface, transparent)',
                color: 'var(--md-text, inherit)',
                border: selected ? '2px solid var(--ink)' : '1px solid var(--rule)',
                borderRadius: 8,
              }}
            >
              {selected && (
                <span className="palette-check" style={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: 'var(--ink)', background: 'var(--paper)', borderRadius: '50%' }}>
                  <Icon name="check" size={16} />
                </span>
              )}
              <Preview kind={o.key} />
              <span>{o.label}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={contrast === 'high'}
        onClick={() => onContrastChange(contrast === 'high' ? 'standard' : 'high')}
        className="settings-choice"
        style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <span
          className="palette-switch-track"
          data-on={contrast === 'high' ? 'true' : 'false'}
          aria-hidden="true"
          style={{
            position: 'relative',
            display: 'inline-block',
            width: 40,
            height: 22,
            borderRadius: 22,
            flexShrink: 0,
            background: contrast === 'high' ? 'var(--accent)' : 'var(--rule)',
            transition: '0.2s',
          }}
        >
          <span
            className="palette-switch-thumb"
            style={{
              position: 'absolute',
              top: 3,
              left: 3,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--paper)',
              transition: '0.2s',
              transform: contrast === 'high' ? 'translateX(18px)' : 'none',
            }}
          />
        </span>
        Tăng tương phản
      </button>
    </div>
  )
}
