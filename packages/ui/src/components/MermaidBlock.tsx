import React, { useEffect, useState } from 'react'

export interface MermaidBlockProps {
  code: string
  theme?: 'default' | 'dark'
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

const THEME_VARS = {
  default: { primaryColor: '#E5EAE7', lineColor: '#5E6A67', textColor: '#1B2422' },
  dark: { primaryColor: '#1F2726', lineColor: '#A3AFAC', textColor: '#E3E8E6' },
} as const

let renderChain: Promise<unknown> = Promise.resolve()

function renderSerialized(code: string, theme: 'default' | 'dark'): Promise<string> {
  const run = async (): Promise<string> => {
    const m = await import('mermaid')
    m.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme, themeVariables: THEME_VARS[theme] })
    const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`
    const result = await m.default.render(id, code)
    return result.svg
  }
  const p = renderChain.then(run, run)
  renderChain = p.catch(() => undefined)
  return p
}

export function MermaidBlock({ code, theme = 'default' }: MermaidBlockProps): React.JSX.Element {
  const key = `${theme}\u0000${code}`
  const [cached] = useState(() => cacheGet(key))
  const [loading, setLoading] = useState(cached === undefined)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(cached ?? null)

  useEffect(() => {
    let isMounted = true

    const hit = cacheGet(key)
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
        const svgOut = await renderSerialized(code, theme)
        cacheSet(key, svgOut)

        if (isMounted) {
          setSvg(svgOut)
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
  }, [code, theme, key])

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
