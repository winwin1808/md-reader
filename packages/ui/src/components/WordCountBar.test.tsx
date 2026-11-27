import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { WordCountBar } from './WordCountBar'

describe('WordCountBar', () => {
  it('formats numbers by locale (de)', () => {
    const text = Array.from({ length: 12345 }, () => 'a').join(' ')
    const { container } = render(<I18nProvider locale="de"><WordCountBar text={text} /></I18nProvider>)
    expect(container.textContent).toContain('12.345')
  })
})
