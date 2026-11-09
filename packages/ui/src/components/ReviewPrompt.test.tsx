import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { ReviewPrompt } from './ReviewPrompt'

afterEach(cleanup)

function setup(locale: 'vi' | 'en' = 'vi') {
  const onRate = vi.fn()
  const onDismiss = vi.fn()
  render(
    <I18nProvider locale={locale}>
      <ReviewPrompt onRate={onRate} onDismiss={onDismiss} />
    </I18nProvider>,
  )
  return { onRate, onDismiss }
}

describe('ReviewPrompt', () => {
  it('vi: có câu mời và đúng hai nút', () => {
    setup()
    expect(screen.getByRole('complementary', { name: 'Mời đánh giá' })).toBeInTheDocument()
    expect(screen.getByText(/đánh giá trên Chrome Web Store/)).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
  it('bấm Đánh giá gọi onRate một lần', () => {
    const { onRate, onDismiss } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Đánh giá' }))
    expect(onRate).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
  })
  it('bấm Không hỏi nữa gọi onDismiss', () => {
    const { onRate, onDismiss } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Không hỏi nữa' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onRate).not.toHaveBeenCalled()
  })
  it('en: có Rate it', () => {
    setup('en')
    expect(screen.getByRole('button', { name: 'Rate it' })).toBeInTheDocument()
  })
})
