import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DocumentSearch } from './DocumentSearch'

describe('DocumentSearch', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders null when isOpen is false', () => {
    const container = document.createElement('div')
    const ref = { current: container }
    const { container: root } = render(
      <DocumentSearch isOpen={false} onClose={vi.fn()} containerRef={ref} />
    )
    expect(root.firstChild).toBeNull()
  })

  it('renders search box when isOpen is true and focuses input', () => {
    const container = document.createElement('div')
    const ref = { current: container }
    render(<DocumentSearch isOpen={true} onClose={vi.fn()} containerRef={ref} />)

    const input = screen.getByLabelText('Tìm trong tài liệu')
    expect(input).toBeDefined()
    expect(document.activeElement).toBe(input)
    expect(screen.getByRole('button', { name: 'Kế tiếp' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Trước' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDefined()
  })

  it('highlights matches case-insensitively and updates match count', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Hello world! Hello markdown.</p>'
    document.body.appendChild(container)
    const ref = { current: container }

    render(<DocumentSearch isOpen={true} onClose={vi.fn()} containerRef={ref} />)
    const input = screen.getByLabelText('Tìm trong tài liệu')

    fireEvent.change(input, { target: { value: 'hello' } })

    const marks = container.querySelectorAll('mark.md-search-highlight')
    expect(marks.length).toBe(2)
    expect(marks[0].classList.contains('md-search-active')).toBe(true)
    expect(marks[1].classList.contains('md-search-active')).toBe(false)
    expect(screen.getByText('1 / 2')).toBeDefined()

    document.body.removeChild(container)
  })

  it('shows 0 / 0 when query is not found', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Hello world!</p>'
    const ref = { current: container }

    render(<DocumentSearch isOpen={true} onClose={vi.fn()} containerRef={ref} />)
    const input = screen.getByLabelText('Tìm trong tài liệu')

    fireEvent.change(input, { target: { value: 'xyz' } })

    expect(screen.getByText('0 / 0')).toBeDefined()
    expect(container.querySelectorAll('mark').length).toBe(0)
  })

  it('navigates with next and prev buttons', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>item 1 and item 2 and item 3</p>'
    document.body.appendChild(container)
    const ref = { current: container }

    render(<DocumentSearch isOpen={true} onClose={vi.fn()} containerRef={ref} />)
    const input = screen.getByLabelText('Tìm trong tài liệu')
    fireEvent.change(input, { target: { value: 'item' } })

    const marks = container.querySelectorAll('mark.md-search-highlight')
    expect(marks.length).toBe(3)
    expect(marks[0].classList.contains('md-search-active')).toBe(true)

    const nextBtn = screen.getByRole('button', { name: 'Kế tiếp' })
    const prevBtn = screen.getByRole('button', { name: 'Trước' })

    fireEvent.click(nextBtn)
    expect(screen.getByText('2 / 3')).toBeDefined()
    expect(marks[1].classList.contains('md-search-active')).toBe(true)
    expect(marks[0].classList.contains('md-search-active')).toBe(false)

    fireEvent.click(nextBtn)
    expect(screen.getByText('3 / 3')).toBeDefined()
    expect(marks[2].classList.contains('md-search-active')).toBe(true)

    // wrap around
    fireEvent.click(nextBtn)
    expect(screen.getByText('1 / 3')).toBeDefined()
    expect(marks[0].classList.contains('md-search-active')).toBe(true)

    // prev wraps to end
    fireEvent.click(prevBtn)
    expect(screen.getByText('3 / 3')).toBeDefined()
    expect(marks[2].classList.contains('md-search-active')).toBe(true)

    document.body.removeChild(container)
  })

  it('handles Enter, Shift+Enter, and Esc keys in input', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>foo bar foo</p>'
    document.body.appendChild(container)
    const ref = { current: container }
    const onClose = vi.fn()

    render(<DocumentSearch isOpen={true} onClose={onClose} containerRef={ref} />)
    const input = screen.getByLabelText('Tìm trong tài liệu')
    fireEvent.change(input, { target: { value: 'foo' } })

    expect(screen.getByText('1 / 2')).toBeDefined()

    // Enter -> next
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    expect(screen.getByText('2 / 2')).toBeDefined()

    // Shift+Enter -> prev
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(screen.getByText('1 / 2')).toBeDefined()

    // Esc -> onClose
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    document.body.removeChild(container)
  })

  it('calls onClose when close button is clicked', () => {
    const container = document.createElement('div')
    const ref = { current: container }
    const onClose = vi.fn()

    render(<DocumentSearch isOpen={true} onClose={onClose} containerRef={ref} />)
    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cleans up marks when query is cleared or component unmounts', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>test text</p>'
    const ref = { current: container }

    const { unmount } = render(<DocumentSearch isOpen={true} onClose={vi.fn()} containerRef={ref} />)
    const input = screen.getByLabelText('Tìm trong tài liệu')
    fireEvent.change(input, { target: { value: 'test' } })
    expect(container.querySelectorAll('mark').length).toBe(1)

    fireEvent.change(input, { target: { value: '' } })
    expect(container.querySelectorAll('mark').length).toBe(0)
    expect(container.innerHTML).toBe('<p>test text</p>')

    fireEvent.change(input, { target: { value: 'text' } })
    expect(container.querySelectorAll('mark').length).toBe(1)
    unmount()
    expect(container.querySelectorAll('mark').length).toBe(0)
    expect(container.innerHTML).toBe('<p>test text</p>')
  })

  it('cleans up marks when isOpen changes to false', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>searchable text</p>'
    const ref = { current: container }

    const { rerender } = render(<DocumentSearch isOpen={true} onClose={vi.fn()} containerRef={ref} />)
    const input = screen.getByLabelText('Tìm trong tài liệu')
    fireEvent.change(input, { target: { value: 'searchable' } })
    expect(container.querySelectorAll('mark').length).toBe(1)

    rerender(<DocumentSearch isOpen={false} onClose={vi.fn()} containerRef={ref} />)
    expect(container.querySelectorAll('mark').length).toBe(0)
    expect(container.innerHTML).toBe('<p>searchable text</p>')
  })

  it('excludes script, style, button, and input elements when highlighting', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <p>valid text</p>
      <script>const text = 1;</script>
      <style>.text { color: red; }</style>
      <button>text button</button>
      <input value="text input" />
    `
    const ref = { current: container }

    render(<DocumentSearch isOpen={true} onClose={vi.fn()} containerRef={ref} />)
    const input = screen.getByLabelText('Tìm trong tài liệu')
    fireEvent.change(input, { target: { value: 'text' } })

    // Only the <p> should have a mark
    const marks = container.querySelectorAll('mark.md-search-highlight')
    expect(marks.length).toBe(1)
    expect(marks[0].parentElement?.tagName.toLowerCase()).toBe('p')
  })
})
