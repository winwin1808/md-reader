import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { FeedbackForm } from './FeedbackForm'

afterEach(cleanup)

const diag = { version: '1.5.0', browser: 'Chrome 130', locale: 'vi' }
function setup(onSubmit: ReturnType<typeof vi.fn> = vi.fn(async () => 'sent')) {
  render(
    <I18nProvider locale="vi">
      <FeedbackForm diagnostics={diag} onSubmit={onSubmit as never} fallbackMailto={(d) => `mailto:x@y.z?body=${d.message}`} />
    </I18nProvider>,
  )
  return onSubmit
}
const btn = () => screen.getByRole('button', { name: 'Gửi góp ý' })
const box = () => screen.getByRole('textbox', { name: 'Nội dung' }) as HTMLTextAreaElement
const type = (v: string) => fireEvent.change(box(), { target: { value: v } })

describe('FeedbackForm', () => {
  it('tắt nút khi message rỗng/khoảng trắng', async () => {
    setup()
    await waitFor(() => expect(btn()).toBeDisabled())
    type('   ')
    await waitFor(() => expect(btn()).toBeDisabled())
    type('lỗi')
    await waitFor(() => expect(btn()).not.toBeDisabled())
  })

  it('email không có @ tắt nút', async () => {
    setup()
    type('lỗi')
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'abc' } })
    await waitFor(() => expect(btn()).toBeDisabled())
  })

  it('hiện nguyên văn thông tin gửi kèm', async () => {
    setup()
    await waitFor(() =>
      expect(screen.getByText(/Phiên bản 1\.5\.0 · Trình duyệt Chrome 130 · Ngôn ngữ vi/)).toBeInTheDocument(),
    )
    expect(screen.getByText('Không gửi nội dung tài liệu hay địa chỉ trang.')).toBeInTheDocument()
  })

  it('bấm hai lần chỉ gọi một lần', async () => {
    const onSubmit = vi.fn(() => new Promise<'sent'>(() => {}))
    setup(onSubmit)
    type('  lỗi  ')
    fireEvent.click(btn())
    fireEvent.click(btn())
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'bug', message: 'lỗi', email: '' })
  })

  it('chọn idea', async () => {
    const onSubmit = setup()
    fireEvent.click(screen.getByRole('radio', { name: 'Đề xuất' }))
    type('ý')
    fireEvent.click(btn())
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ kind: 'idea', message: 'ý', email: '' }))
  })

  it('sent -> status và xoá nội dung', async () => {
    setup()
    type('lỗi')
    fireEvent.click(btn())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cảm ơn bạn'))
    await waitFor(() => expect(box().value).toBe(''))
  })

  it('failed -> alert, mailto, giữ nội dung', async () => {
    setup(vi.fn(async () => 'failed'))
    type('lỗi')
    fireEvent.click(btn())
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Gửi qua email' })).toHaveAttribute('href', 'mailto:x@y.z?body=lỗi')
    expect(box().value).toBe('lỗi')
  })

  it('reject -> như failed', async () => {
    setup(vi.fn(async () => { throw new Error('x') }))
    type('lỗi')
    fireEvent.click(btn())
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(box().value).toBe('lỗi')
  })
})
