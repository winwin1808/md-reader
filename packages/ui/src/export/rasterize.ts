export interface RasterizeOptions {
  scale?: number // default 2
  width?: number
  height?: number
}

export interface RasterizedImage {
  buffer: ArrayBuffer
  width: number
  height: number
}

function extractDimensions(svgString: string): { width?: number; height?: number } {
  let width: number | undefined
  let height: number | undefined

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (svg) {
      const wAttr = svg.getAttribute('width')
      const hAttr = svg.getAttribute('height')
      if (wAttr) {
        const val = parseFloat(wAttr)
        if (!Number.isNaN(val) && val > 0) width = val
      }
      if (hAttr) {
        const val = parseFloat(hAttr)
        if (!Number.isNaN(val) && val > 0) height = val
      }

      if (width === undefined || height === undefined) {
        const viewBox = svg.getAttribute('viewBox')
        if (viewBox) {
          const parts = viewBox.trim().split(/[\s,]+/).map(Number)
          if (parts.length === 4) {
            if (width === undefined && !Number.isNaN(parts[2]) && parts[2]! > 0) {
              width = parts[2]
            }
            if (height === undefined && !Number.isNaN(parts[3]) && parts[3]! > 0) {
              height = parts[3]
            }
          }
        }
      }
    }
  } catch {
    // Ignore parser errors and fall back to defaults
  }

  return { width, height }
}

function ensureSvgNamespace(svgString: string): string {
  if (!svgString.includes('xmlns=')) {
    return svgString.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  return svgString
}

export async function rasterizeSvg(
  svgString: string,
  options?: RasterizeOptions
): Promise<RasterizedImage> {
  const extracted = extractDimensions(svgString)
  const baseWidth = options?.width ?? extracted.width ?? 800
  const baseHeight = options?.height ?? extracted.height ?? 600
  const scale = options?.scale ?? 2
  const width = Math.round(baseWidth * scale)
  const height = Math.round(baseHeight * scale)

  const preparedSvg = ensureSvgNamespace(svgString)

  return new Promise<RasterizedImage>((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get 2D context from canvas'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'))
            return
          }
          try {
            const buffer = await blob.arrayBuffer()
            resolve({ buffer, width, height })
          } catch (err) {
            reject(err)
          }
        }, 'image/png')
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = (err) => {
      let msg = 'Image decode error'
      if (err instanceof Error) {
        msg = err.message
      } else if (typeof err === 'string') {
        msg = err
      } else if (err && typeof err === 'object' && 'message' in err) {
        msg = String((err as any).message)
      }
      reject(new Error(`Failed to load SVG image: ${msg}`))
    }

    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preparedSvg)}`
  })
}
