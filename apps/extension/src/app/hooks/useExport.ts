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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

export function useExport(args: {
  html: string
  title: string
  parseResult: ParseResult
  resolveImage?: (src: string) => string | Promise<string>
}): {
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
        const fetchImage = async (src: string): Promise<{ base64: string; mimeType: string } | null> => {
          try {
            const url = args.resolveImage ? await args.resolveImage(src) : src
            const res = await fetch(url)
            if (!res.ok) return null
            const blob = await res.blob()
            const bytes = new Uint8Array(await blob.arrayBuffer())
            const mimeType = (res.headers.get('content-type') || blob.type).split(';')[0]!.trim()
            return { base64: bytesToBase64(bytes), mimeType }
          } catch {
            return null
          }
        }
        const exportHtml = await exportToHtml({ html, cssContent: getDefaultExportCss(), title, fetchImage })
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
