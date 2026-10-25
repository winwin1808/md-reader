import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { I18nProvider } from './index'
import { SettingsModal } from '../components/SettingsModal'

afterEach(cleanup)

describe('component rendering per locale', () => {
  const ui = (locale: 'vi' | 'en') => (
    <I18nProvider locale={locale}>
      <SettingsModal open onOpenChange={() => {}} settings={{ contrast: 'standard', settingsVersion: 2 }} />
    </I18nProvider>
  )

  it('SettingsModal renders English under locale en', () => {
    render(ui('en'))
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Language')).toBeInTheDocument()
    expect(screen.queryByText('Cài đặt')).toBeNull()
  })

  it('SettingsModal renders Vietnamese under locale vi', () => {
    render(ui('vi'))
    expect(screen.getByText('Cài đặt')).toBeInTheDocument()
    expect(screen.getByText('Ngôn ngữ')).toBeInTheDocument()
  })
})
