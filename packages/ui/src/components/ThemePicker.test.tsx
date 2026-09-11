import React from 'react'
import { afterEach, describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'
import type { ColorTheme } from '../theme/ThemeProvider'

describe('ThemePicker', () => {
  afterEach(cleanup)


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

  test('renders 30px x 30px swatches with active ring styling', () => {
    const handleSelect = vi.fn()
    render(<ThemePicker currentTheme="navy" onSelect={handleSelect} />)

    const navyButton = screen.getByRole('button', { name: 'Select navy theme' })
    const greenButton = screen.getByRole('button', { name: 'Select green theme' })

    expect(navyButton.style.width).toBe('30px')
    expect(navyButton.style.height).toBe('30px')
    expect(navyButton.style.boxShadow).toBe('0 0 0 2px var(--md-bg), 0 0 0 4px var(--md-link)')

    expect(greenButton.style.width).toBe('30px')
    expect(greenButton.style.height).toBe('30px')
    expect(greenButton.style.boxShadow).toBe('none')
  })
})
