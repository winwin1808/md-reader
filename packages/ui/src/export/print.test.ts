import { describe, it, expect, vi, beforeEach } from 'vitest'
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
    // @ts-expect-error testing SSR / non-browser environment
    delete (globalThis as { window?: unknown }).window

    expect(() => printDocument()).not.toThrow()

    globalThis.window = originalWindow
  })

  it('does not throw when window.print is undefined', () => {
    const originalPrint = window.print
    // @ts-expect-error testing missing print function
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
})
