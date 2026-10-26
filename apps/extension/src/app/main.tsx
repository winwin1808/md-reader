import React from 'react'
import { createRoot } from 'react-dom/client'
import { PairDialog, useT } from '@md-reader/ui'
import { BRIDGE_PORTS } from '@md-reader/core/bridge'
import { App } from './App'
import { AppErrorBoundary } from './AppErrorBoundary'
import { LocaleRoot } from './LocaleRoot'
import { PAIR_DECISION_MSG } from '../worker/bridge-storage'
import 'katex/dist/katex.min.css'
import '@md-reader/ui/fonts.css'

function PairPage({ port, client, keyHash }: { port: number; client: string; keyHash: string }): React.JSX.Element {
  const decide = (allow: boolean) => {
    try { void Promise.resolve(chrome.runtime.sendMessage({ type: PAIR_DECISION_MSG, port, allow, keyHash })).catch(() => {}) } catch { /* ignore */ }
  }
  return <PairDialog client={client} onAllow={() => decide(true)} onDeny={() => decide(false)} />
}

function PairInvalid(): React.JSX.Element {
  const t = useT()
  return <p role="alert">{t('pair.invalid')}</p>
}

function pairParams(): { port: number; client: string; keyHash: string } | 'invalid' | null {
  const q = new URLSearchParams(window.location.search)
  if (!q.has('pair')) return null
  const raw = q.get('pair') ?? ''
  const port = /^\d+$/.test(raw) ? Number(raw) : NaN
  if (!Number.isInteger(port) || !BRIDGE_PORTS.includes(port)) return 'invalid'
  const keyHash = q.get('key') ?? ''
  if (!/^[0-9a-f]{64}$/.test(keyHash)) return 'invalid'
  return { port, client: q.get('client') ?? '', keyHash }
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  const pair = pairParams()
  root.render(
    <React.StrictMode>
      <LocaleRoot>
        {pair === 'invalid' ? (
          <PairInvalid />
        ) : pair ? (
          <PairPage port={pair.port} client={pair.client} keyHash={pair.keyHash} />
        ) : (
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        )}
      </LocaleRoot>
    </React.StrictMode>
  )
}
