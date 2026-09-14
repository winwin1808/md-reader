import React, { useEffect, useState } from 'react'

export interface MermaidBlockProps {
  code: string
}

export function MermaidBlock({ code }: MermaidBlockProps): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function renderMermaid() {
      try {
        const m = await import('mermaid')
        m.default.initialize({ startOnLoad: false })
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`
        const result = await m.default.render(id, code)
        
        if (isMounted) {
          setSvg(result.svg)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    }

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
