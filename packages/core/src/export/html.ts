export interface ExportHtmlOptions {
  html: string
  cssContent: string
  title: string
  /** Document language for <html lang>. Defaults to 'vi'. */
  lang?: string
  /**
   * Optional custom fetcher for images. Defaults to global fetch if available.
   * Return base64 data string and mimeType, or null on error.
   */
  fetchImage?: (url: string) => Promise<{ base64: string; mimeType: string } | null>
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return typeof btoa === 'function' ? btoa(binary) : ''
}

async function defaultFetchImage(url: string): Promise<{ base64: string; mimeType: string } | null> {
  if (typeof globalThis.fetch !== 'function') {
    return null
  }
  try {
    const response = await globalThis.fetch(url)
    if (!response.ok) {
      return null
    }
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
    const mimeType = (contentType.split(';')[0] ?? '').trim() || 'application/octet-stream'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)
    return { base64, mimeType }
  } catch {
    return null
  }
}

export async function exportToHtml(options: ExportHtmlOptions): Promise<string> {
  const { html, cssContent, title, fetchImage, lang = 'vi' } = options
  const fetcher = fetchImage ?? defaultFetchImage

  const imgTagRegex = /<img\b([^>]*)>/gi
  const srcAttrRegex = /\bsrc\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i

  const urlsToFetch = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = imgTagRegex.exec(html)) !== null) {
    const attrs = match[1] ?? ''
    const srcMatch = srcAttrRegex.exec(attrs)
    if (srcMatch) {
      const url = srcMatch[2] ?? srcMatch[3]
      if (url && !url.startsWith('data:')) {
        urlsToFetch.add(url)
      }
    }
  }

  const urlToDataUri = new Map<string, string>()
  if (urlsToFetch.size > 0) {
    await Promise.all(
      Array.from(urlsToFetch).map(async (url) => {
        try {
          const result = await fetcher(url)
          if (result && result.base64 && result.mimeType) {
            urlToDataUri.set(url, `data:${result.mimeType};base64,${result.base64}`)
          }
        } catch {
          // Graceful fallback to original src
        }
      })
    )
  }

  const processedHtml = html.replace(/<img\b([^>]*)>/gi, (fullTag, attrs: string) => {
    const srcMatch = srcAttrRegex.exec(attrs)
    if (!srcMatch) {
      return fullTag
    }
    const url = srcMatch[2] ?? srcMatch[3]
    if (!url || url.startsWith('data:')) {
      return fullTag
    }
    const dataUri = urlToDataUri.get(url)
    if (!dataUri) {
      return fullTag
    }
    const fullSrc = srcMatch[0]
    const quote = srcMatch[1] ?? '"'
    const newSrc = `src=${quote}${dataUri}${quote}`
    const newAttrs = attrs.replace(fullSrc, () => newSrc)
    return `<img${newAttrs}>`
  })

  const escapedTitle = escapeHtml(title)

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <style>${cssContent}</style>
</head>
<body>
  <div class="md-viewer">${processedHtml}</div>
</body>
</html>`
}
