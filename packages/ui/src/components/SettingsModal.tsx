import React, { useState } from 'react';
import type { ColorTheme } from '../theme/ThemeProvider';
import { ThemePicker } from './ThemePicker';

export type FontFamily = 'sans' | 'serif' | 'mono';

export interface SettingsModalProps {
  mode?: 'light' | 'dark' | 'system';
  colorTheme?: ColorTheme;
  autoFormatMd?: boolean;
  fontFamily?: FontFamily;
  onModeChange?: (mode: 'light' | 'dark' | 'system') => void;
  onColorThemeChange?: (colorTheme: ColorTheme) => void;
  onAutoFormatChange?: (autoFormat: boolean) => void;
  onFontFamilyChange?: (fontFamily: FontFamily) => void;
  themePicker?: React.ReactNode;
  autoFormat?: boolean;
}

export function SettingsModal(props: SettingsModalProps): React.JSX.Element {
  const {
    colorTheme,
    autoFormatMd,
    fontFamily = 'sans',
    onColorThemeChange,
    onAutoFormatChange,
    onFontFamilyChange,
    themePicker,
    autoFormat,
  } = props;


  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Settings"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          color: 'inherit',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          borderRadius: '10px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
            style={{
              background: 'var(--md-bg)',
              color: 'var(--md-fg)',
              padding: '24px 28px',
              borderRadius: '16px',
              border: '1px solid var(--md-border)',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)',
              minWidth: '340px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'inherit',
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              {themePicker ?? (
                colorTheme && onColorThemeChange ? (
                  <ThemePicker currentTheme={colorTheme} onSelect={onColorThemeChange} />
                ) : null
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>Kiểu phông chữ</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {([
                  { key: 'sans', label: 'Sans-serif' },
                  { key: 'serif', label: 'Serif' },
                  { key: 'mono', label: 'Monospace' },
                ] as const).map((opt) => {
                  const isSelected = fontFamily === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => onFontFamilyChange?.(opt.key)}
                      aria-pressed={isSelected}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--md-link, #0969da)' : '1px solid var(--md-border, #d0d7de)',
                        background: isSelected ? 'var(--md-surface-subtle, rgba(125, 125, 125, 0.1))' : 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={typeof autoFormatMd === 'boolean' ? autoFormatMd : Boolean(autoFormat)}
                onChange={(e) => onAutoFormatChange?.(e.target.checked)}
              />
              Auto-format .md files
            </label>
          </div>
        </div>
      )}
    </>
  );
}
