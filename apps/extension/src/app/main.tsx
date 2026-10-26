import React from 'react'
import { createRoot } from 'react-dom/client'
import { PairDialog } from '@md-reader/ui'
import { BRIDGE_PORTS } from '@md-reader/core/bridge'
import { App } from './App'
import { AppErrorBoundary } from './AppErrorBoundary'
import { LocaleRoot } from './LocaleRoot'
import { PAIR_DECISION_MSG } from '../worker/bridge-storage'
import 'katex/dist/katex.min.css'
import '@md-reader/ui/fonts.css'

function PairPage({ port, client }: { port: number; client: string }): React.JSX.Element {
  const decide = (allow: boolean) => {
    try { void Promise.resolve(chrome.runtime.sendMessage({ type: PAIR_DECISION_MSG, port, allow })).catch(() => {}) } catch { /* ignore */ }
  }
  return <PairDialog client={client} onAllow={() => decide(true)} onDeny={() => decide(false)} />
}

function pairParams(): { port: number; client: string } | 'invalid' | null {
  const q = new URLSearchParams(window.location.search)
  if (!q.has('pair')) return null
  const raw = q.get('pair') ?? ''
  const port = /^\d+$/.test(raw) ? Number(raw) : NaN
  if (!Number.isInteger(port) || !BRIDGE_PORTS.includes(port)) return 'invalid'
  return { port, client: q.get('client') ?? '' }
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  const pair = pairParams()
  root.render(
    <React.StrictMode>
      <LocaleRoot>
        {pair === 'invalid' ? (
          <p role="alert">Invalid pairing request.</p>
        ) : pair ? (
          <PairPage port={pair.port} client={pair.client} />
        ) : (
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        )}
      </LocaleRoot>
    </React.StrictMode>
  )
}
