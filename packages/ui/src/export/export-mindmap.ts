/**
 * Mindmap Export utilities: SVG and PNG
 */

export function exportMindmapToSvg(svgElement: SVGSVGElement, title?: string): string {
  const cloned = svgElement.cloneNode(true) as SVGSVGElement
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  // Set default dimensions if not present
  const width =
    svgElement.clientWidth ||
    parseInt(svgElement.getAttribute('width') || '', 10) ||
    800
  const height =
    svgElement.clientHeight ||
    parseInt(svgElement.getAttribute('height') || '', 10) ||
    600

  if (!cloned.getAttribute('width')) cloned.setAttribute('width', String(width))
  if (!cloned.getAttribute('height')) cloned.setAttribute('height', String(height))
  if (!cloned.getAttribute('viewBox')) cloned.setAttribute('viewBox', `0 0 ${width} ${height}`)

  // Embed default font and styles for standalone rendering
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  styleEl.textContent = `
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .mindmap-branch { fill: none; }
    .mindmap-node-rect { fill: #ffffff; }
    .mindmap-node-text { fill: #0f172a; font-size: 13px; }
    .mindmap-collapsed-badge { font-family: sans-serif; }
  `
  cloned.insertBefore(styleEl, cloned.firstChild)

  if (title) {
    const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    titleEl.textContent = title
    cloned.insertBefore(titleEl, cloned.firstChild)
  }

  const serializer = new XMLSerializer()
  return serializer.serializeToString(cloned)
}

export function exportMindmapToPng(
  svgElement: SVGSVGElement,
  title?: string,
  scale = 2
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgString = exportMindmapToSvg(svgElement, title)

    const width =
      svgElement.clientWidth ||
      parseInt(svgElement.getAttribute('width') || '', 10) ||
      800
    const height =
      svgElement.clientHeight ||
      parseInt(svgElement.getAttribute('height') || '', 10) ||
      600

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to get 2D canvas context'))
      return
    }

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const hasCreateObjectURL =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    const url = hasCreateObjectURL
      ? URL.createObjectURL(svgBlob)
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

    const img = new Image()

    img.onload = () => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      if (hasCreateObjectURL && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas toBlob returned null'))
        }
      }, 'image/png')
    }

    img.onerror = (err) => {
      if (hasCreateObjectURL && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
      reject(err)
    }

    img.src = url
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
