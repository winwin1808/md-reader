import React from 'react'
import { afterEach, describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'
import type { ColorTheme } from '../theme/ThemeProvider'

describe('ThemePicker', () => {
  afterEach(cleanup)
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
    
    const navyButton = screen.getByRole('button', { name: 'Select navy theme' })
    fireEvent.click(navyButton)
    
    expect(handleSelect).toHaveBeenCalledWith('navy')
  })
})
