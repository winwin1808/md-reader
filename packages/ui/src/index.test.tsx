import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CORE_VERSION } from '@md-reader/core'
import { UI_VERSION } from './index'

describe('@md-reader/ui skeleton', () => {
  it('renders in jsdom via testing-library', () => {
    render(<div>hello</div>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('imports @md-reader/core via workspace name and exposes UI_VERSION', () => {
    expect(CORE_VERSION).toBe('0.1.0')
    expect(UI_VERSION).toBe('0.1.0')
  })
})
