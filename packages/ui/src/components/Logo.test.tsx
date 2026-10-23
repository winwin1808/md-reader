import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from './Logo'

describe('Logo', () => {
  it('renders svg role img with default name', () => {
    render(<Logo />)
    const svg = screen.getByRole('img', { name: 'MD Reader' })
    expect(svg.getAttribute('width')).toBe('32')
  })
  it('follows title and size', () => {
    render(<Logo size={64} title="Custom" />)
    const svg = screen.getByRole('img', { name: 'Custom' })
    expect(svg.getAttribute('width')).toBe('64')
    expect(svg.getAttribute('height')).toBe('64')
  })
})
