import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@md-reader/ui'
import { SharePage } from './SharePage'
import { webLocale } from './main'

describe('web i18n', () => {
  it('?lang=en renders English', () => {
    expect(webLocale('?lang=en', ['vi'])).toBe('en')
    expect(webLocale('', ['vi-VN'])).toBe('vi')
    render(<I18nProvider locale={webLocale('?lang=en', ['vi'])}><SharePage token={null} /></I18nProvider>)
    expect(screen.getByText('Page not found')).toBeTruthy()
  })
})
