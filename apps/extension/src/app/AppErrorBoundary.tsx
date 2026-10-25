import React from 'react'
import { useT } from '@md-reader/ui'
import type { MessageKey } from '@md-reader/ui'

function T({ k }: { k: MessageKey }): React.JSX.Element {
  const t = useT()
  return <>{t(k)}</>
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error | null } {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error(error)
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (error) {
      return (
        <div role="alert" className="app-error-boundary">
          <h1><T k="ext.error.render" /></h1>
          <pre>{error.message}</pre>
          <button onClick={() => location.reload()}><T k="ext.error.reload" /></button>
        </div>
      )
    }
    return this.props.children
  }
}
