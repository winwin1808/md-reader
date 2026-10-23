import React, { useEffect, useState } from 'react'

export interface MermaidBlockProps {
  code: string
}

const MAX_CACHE = 50
const svgCache = new Map<string, string>()

export function __clearMermaidCache(): void {
  svgCache.clear()
}

function cacheGet(code: string): string | undefined {
  const hit = svgCache.get(code)
  if (hit !== undefined) {
    svgCache.delete(code)
    svgCache.set(code, hit)
  }
  return hit
}

function cacheSet(code: string, svg: string): void {
  svgCache.delete(code)
  svgCache.set(code, svg)
  while (svgCache.size > MAX_CACHE) {
    const oldest = svgCache.keys().next().value
    if (oldest === undefined) break
    svgCache.delete(oldest)
  }
}

export function MermaidBlock({ code }: MermaidBlockProps): React.JSX.Element {
  const [cached] = useState(() => cacheGet(code))
  const [loading, setLoading] = useState(cached === undefined)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(cached ?? null)

  useEffect(() => {
    let isMounted = true

    const hit = cacheGet(code)
    if (hit !== undefined) {
      setSvg(hit)
      setError(null)
      setLoading(false)
      return () => {
        isMounted = false
      }
    }

    async function renderMermaid() {
      try {
        const m = await import('mermaid')
        m.default.initialize({ startOnLoad: false, securityLevel: 'strict' })
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`
        const result = await m.default.render(id, code)
        cacheSet(code, result.svg)

        if (isMounted) {
          setSvg(result.svg)
          setError(null)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    }

    setLoading(true)
    renderMermaid()

    return () => {
      isMounted = false
    }
  }, [code])

  if (loading) {
    return (
      <pre style={{ opacity: 0.5 }}>
        <code>{code}</code>
      </pre>
    )
  }

  if (error) {
    return (
      <div>
        <p style={{ color: 'red' }}>Error rendering mermaid graph: {error}</p>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return <div dangerouslySetInnerHTML={{ __html: svg || '' }} />
}
