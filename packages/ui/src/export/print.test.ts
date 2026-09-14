import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { printDocument } from './print'
import { printDocument as printDocumentExport } from './index'
import { printDocument as printDocumentRoot } from '../index'

describe('printDocument', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls window.print when window is defined', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    printDocument()
    expect(printSpy).toHaveBeenCalledOnce()
  })

  it('does not throw when window is undefined', () => {
    const originalWindow = globalThis.window
    delete (globalThis as { window?: unknown }).window

    expect(() => printDocument()).not.toThrow()

    globalThis.window = originalWindow
  })

  it('does not throw when window.print is undefined', () => {
    const originalPrint = window.print
    delete (window as { print?: unknown }).print

    expect(() => printDocument()).not.toThrow()

    window.print = originalPrint
  })

  it('is exported from ./index and ../index', () => {
    expect(printDocumentExport).toBe(printDocument)
    expect(printDocumentRoot).toBe(printDocument)
  })
})

describe('print.css', () => {
  const cssPath = path.resolve(__dirname, '../theme/print.css')
  const viewerCssPath = path.resolve(__dirname, '../viewer.css')

  it('contains @page configuration', () => {
    const content = fs.readFileSync(cssPath, 'utf8')
    expect(content).toContain('@page')
    expect(content).toContain('margin: 20mm 15mm 20mm 15mm;')
  })

  it('contains @media print rules to hide UI chrome and format content', () => {
    const content = fs.readFileSync(cssPath, 'utf8')
    expect(content).toContain('@media print')
    expect(content).toContain('.sidebar-toc')
    expect(content).toContain('nav.md-toc')
    expect(content).toContain('.settings-btn')
    expect(content).toContain('.md-no-print')
    expect(content).toContain('page-break-after: avoid')
    expect(content).toContain('page-break-inside: avoid')
  })

  it('is imported in viewer.css', () => {
    const viewerContent = fs.readFileSync(viewerCssPath, 'utf8')
    expect(viewerContent).toContain("@import './theme/print.css';")
  })

  it('resets background and text color to black-on-white for .md-viewer and children', () => {
    const content = fs.readFileSync(cssPath, 'utf8')
    expect(content).toContain('.md-viewer')
    expect(content).toContain('.md-viewer *')
    expect(content).toContain('.md-viewer table tr')
    expect(content).toMatch(/body[\s\S]*?\.app-layout[\s\S]*?\.main-content[\s\S]*?\.md-viewer\s*\{[^}]*background:\s*#ffffff\s*!important/i)
    expect(content).toMatch(/body[\s\S]*?\.app-layout[\s\S]*?\.main-content[\s\S]*?\.md-viewer[\s\S]*?\.md-viewer\s*\*[\s\S]*?\{[^}]*background-color:\s*transparent\s*!important/i)
    expect(content).toMatch(/color:\s*#000000\s*!important/i)
  })

  it('ensures links, table text, blockquotes, and normal paragraphs print with high contrast', () => {
    const content = fs.readFileSync(cssPath, 'utf8')
    expect(content).toMatch(/a[\s\S]*?\{[^}]*color:\s*#000000\s*!important/)
    expect(content).toMatch(/blockquote[\s\S]*?\{[^}]*color:\s*#000000\s*!important/)
    expect(content).toMatch(/table[\s\S]*?\{[^}]*color:\s*#000000\s*!important/)
  })

  it('keeps pre/code blocks readable with light background and dark text', () => {
    const content = fs.readFileSync(cssPath, 'utf8')
    expect(content).toMatch(/pre[\s\S]*?code[\s\S]*?\{[^}]*background-color:\s*#f6f8fa\s*!important/)
    expect(content).toMatch(/pre[\s\S]*?code[\s\S]*?\{[^}]*color:\s*#1f2328\s*!important/)
    expect(content).toMatch(/pre[\s\S]*?code[\s\S]*?\{[^}]*border:\s*1px solid #d0d7de\s*!important/)
  })
})

describe('printSlides', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    document.body.className = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds print-slides class to document.body, calls window.print, and removes class on afterprint', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { printSlides } = await import('./print')
    printSlides()
    expect(document.body.classList.contains('print-slides')).toBe(true)
    expect(printSpy).toHaveBeenCalledOnce()

    // trigger afterprint
    const afterprintHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'afterprint')?.[1] as EventListener
    expect(afterprintHandler).toBeDefined()
    
    afterprintHandler(new Event('afterprint'))
    expect(document.body.classList.contains('print-slides')).toBe(false)
    expect(removeEventListenerSpy).toHaveBeenCalledWith('afterprint', afterprintHandler)
  })

  it('removes print-slides class using fallback timeout if afterprint does not fire', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { printSlides } = await import('./print')
    printSlides()
    expect(document.body.classList.contains('print-slides')).toBe(true)
    
    vi.advanceTimersByTime(2000) // fast forward 2 seconds
    expect(document.body.classList.contains('print-slides')).toBe(false)
  })
})

describe('deck-print.css', () => {
  const cssPath = path.resolve(__dirname, '../theme/deck-print.css')
  const viewerCssPath = path.resolve(__dirname, '../viewer.css')

  it('contains landscape slide print styles', () => {
    const content = fs.readFileSync(cssPath, 'utf8')
    expect(content).toContain('.deck-print-container')
    expect(content).toContain('@media print')
    expect(content).toContain('@page slide-deck')
    expect(content).toContain('size: landscape')
    expect(content).toContain('body.print-slides')
    expect(content).toContain('.deck-print-slide')
    expect(content).toContain('page: slide-deck')
    expect(content).toContain('display: flex !important')
  })

  it('is imported in viewer.css', () => {
    const viewerContent = fs.readFileSync(viewerCssPath, 'utf8')
    expect(viewerContent).toContain("@import './theme/deck-print.css';")
  })
})
