import { useState } from 'react'
import { flushSync } from 'react-dom'
import { printDocument, printSlides, getDefaultExportCss } from '@md-reader/ui'
import type { ExportFormat } from '@md-reader/ui'
import { exportToHtml } from '@md-reader/core'
import type { ParseResult } from '@md-reader/core'

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useExport(args: { html: string; title: string; parseResult: ParseResult }): {
  exportAs(format: ExportFormat): Promise<void>
  isPrintingSlides: boolean
} {
  const { html, parseResult } = args
  const [isPrintingSlides, setIsPrintingSlides] = useState<boolean>(false)

  const exportAs = async (format: ExportFormat): Promise<void> => {
    try {
      const title = args.title || 'document'
      if (format === 'pdf') {
        printDocument()
      } else if (format === 'slides-pdf') {
        flushSync(() => {
          setIsPrintingSlides(true)
        })
        printSlides()
        const cleanup = () => {
          setIsPrintingSlides(false)
          window.removeEventListener('afterprint', cleanup)
        }
        window.addEventListener('afterprint', cleanup)
        setTimeout(cleanup, 1000)
      } else if (format === 'html') {
        const exportHtml = await exportToHtml({ html, cssContent: getDefaultExportCss(), title })
        download(new Blob([exportHtml], { type: 'text/html;charset=utf-8' }), `${title}.html`)
      } else if (format === 'docx') {
        const { mdastToDocx } = await import('@md-reader/core/docx')
        const blob = await mdastToDocx({ mdast: parseResult.tree, title })
        download(blob, `${title}.docx`)
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  return { exportAs, isPrintingSlides }
}
