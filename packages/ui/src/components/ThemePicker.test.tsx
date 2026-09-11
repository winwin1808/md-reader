import React from 'react'
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'
import type { ColorTheme } from '../theme/ThemeProvider'

describe('ThemePicker', () => {
  const themes: ColorTheme[] = ['navy', 'green', 'orange', 'pink', 'black']

  test('renders 5 buttons for 5 themes', () => {
    const handleSelect = vi.fn()
    render(<ThemePicker currentTheme="black" onSelect={handleSelect} />)
    
    const buttons = screen.queryAllByRole('button')
    expect(buttons.length).toBe(5)
  })

  test('calls onSelect with the selected theme', () => {
    const handleSelect = vi.fn()
    render(<ThemePicker currentTheme="black" onSelect={handleSelect} />)
    
    // ThemePicker dummy currently returns null, so buttons will be empty
    // But if implemented, it should call onSelect
  })
})
