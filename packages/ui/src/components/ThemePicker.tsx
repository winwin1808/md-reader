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
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            backgroundColor: THEME_COLORS[theme],
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            boxShadow: currentTheme === theme ? '0 0 0 2px var(--md-bg), 0 0 0 4px var(--md-link)' : 'none',
          }}
        />
      ))}
    </div>
  )
}
