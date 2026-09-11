import React from 'react'
import type { ColorTheme } from '../theme/ThemeProvider'

export interface ThemePickerProps {
  currentTheme: ColorTheme
  onSelect: (theme: ColorTheme) => void
}

const THEMES: ColorTheme[] = ['navy', 'green', 'orange', 'pink', 'black']

const THEME_COLORS: Record<ColorTheme, string> = {
  navy: '#000080',
  green: '#008000',
  orange: '#ff8c00',
  pink: '#ff1493',
  black: '#000000',
}

export function ThemePicker(props: ThemePickerProps): React.JSX.Element {
  const { currentTheme, onSelect } = props

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {THEMES.map((theme) => (
        <button
          key={theme}
          onClick={() => onSelect(theme)}
          aria-label={`Select ${theme} theme`}
          title={`Select ${theme} theme`}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: THEME_COLORS[theme],
            border: currentTheme === theme ? '2px solid #3b82f6' : '2px solid transparent',
            outline: currentTheme === theme ? '2px solid white' : 'none',
            cursor: 'pointer',
            padding: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }}
        />
      ))}
    </div>
  )
}
