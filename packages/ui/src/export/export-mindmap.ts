/**
 * Mindmap Export utilities: SVG and PNG
 */

export function exportMindmapToSvg(svgElement: SVGSVGElement, title?: string): string {
  const cloned = svgElement.cloneNode(true) as SVGSVGElement
  if (cloned.namespaceURI !== 'http://www.w3.org/2000/svg') {
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  if (!cloned.hasAttribute('xmlns:xlink')) {
    cloned.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink')
  }

  // Reset inner transform on the zoom <g> element
  const viewportElements = cloned.querySelectorAll<SVGGElement>('.mindmap-viewport')
  if (viewportElements.length > 0) {
    viewportElements.forEach((g) => g.removeAttribute('transform'))
  } else {
    // Reset transform on any parent <g> container of mindmap nodes
    const nodeEl = cloned.querySelector('.mindmap-node')
    let parent: Element | null = nodeEl?.parentElement ?? null
    while (parent && parent !== (cloned as unknown as Element)) {
      if (parent.tagName.toLowerCase() === 'g') {
        parent.removeAttribute('transform')
      }
      parent = parent.parentElement
    }
    if (!nodeEl) {
      for (const child of Array.from(cloned.children)) {
        if (child.tagName.toLowerCase() === 'g') {
          child.removeAttribute('transform')
        }
      }
    }
  }

  // Calculate or extract bounding box of all <g class="mindmap-node"> elements
  const nodes = cloned.querySelectorAll<SVGGElement>('.mindmap-node')
  if (nodes.length > 0) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    nodes.forEach((nodeEl) => {
      const transformAttr = nodeEl.getAttribute('transform') || ''
      const match = transformAttr.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/)
      let tx = 0
      let ty = 0
      if (match && match[1] && match[2]) {
        tx = parseFloat(match[1])
        ty = parseFloat(match[2])
      }

      const rect = nodeEl.querySelector('rect')
      const rx = rect ? parseFloat(rect.getAttribute('x') || '0') : 0
      const ry = rect ? parseFloat(rect.getAttribute('y') || '0') : 0
      const rw = rect ? parseFloat(rect.getAttribute('width') || '0') : 100
      const rh = rect ? parseFloat(rect.getAttribute('height') || '0') : 32

      let nodeLeft = tx + rx
      let nodeTop = ty + ry
      let nodeRight = nodeLeft + rw
      let nodeBottom = nodeTop + rh

      const handle = nodeEl.querySelector('.mindmap-collapse-handle')
      if (handle) {
        nodeRight += 12
      }

      if (nodeLeft < minX) minX = nodeLeft
      if (nodeTop < minY) minY = nodeTop
      if (nodeRight > maxX) maxX = nodeRight
      if (nodeBottom > maxY) maxY = nodeBottom
    })

    if (minX !== Infinity) {
      const padding = 40
      const fittedX = Math.round(minX - padding)
      const fittedY = Math.round(minY - padding)
      const fittedWidth = Math.round(maxX - minX + padding * 2)
      const fittedHeight = Math.round(maxY - minY + padding * 2)

      cloned.setAttribute('viewBox', `${fittedX} ${fittedY} ${fittedWidth} ${fittedHeight}`)
      cloned.setAttribute('width', String(fittedWidth))
      cloned.setAttribute('height', String(fittedHeight))
    }
  } else {
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
  }

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

    const widthMatch = svgString.match(/width="([^"]+)"/)
    const heightMatch = svgString.match(/height="([^"]+)"/)
    const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)

    let width = widthMatch && widthMatch[1] ? parseFloat(widthMatch[1]) : 0
    let height = heightMatch && heightMatch[1] ? parseFloat(heightMatch[1]) : 0

    if (!width || !height) {
      if (viewBoxMatch && viewBoxMatch[1]) {
        const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number)
        if (parts.length === 4 && typeof parts[2] === 'number' && typeof parts[3] === 'number' && !isNaN(parts[2]) && !isNaN(parts[3])) {
          width = parts[2]
          height = parts[3]
        }
      }
    }

    if (!width) {
      width =
        svgElement.clientWidth ||
        parseInt(svgElement.getAttribute('width') || '', 10) ||
        800
    }
    if (!height) {
      height =
        svgElement.clientHeight ||
        parseInt(svgElement.getAttribute('height') || '', 10) ||
        600
    }

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
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}
