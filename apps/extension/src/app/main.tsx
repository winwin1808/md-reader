import React from 'react'
import { createRoot } from 'react-dom/client'
import { PairDialog, useT } from '@md-reader/ui'
import { BRIDGE_PORTS } from '@md-reader/core/bridge'
import { App } from './App'
import { AppErrorBoundary } from './AppErrorBoundary'
import { WelcomeRoute } from './WelcomeRoute'
import { WhatsNewRoute, maybeRedirectToWhatsNew } from './WhatsNewRoute'
import { LocaleRoot } from './LocaleRoot'
import { PAIR_DECISION_MSG } from '../worker/bridge-storage'
import { onMathLoaded } from '@md-reader/core/plugins'
import '@md-reader/ui/fonts.css'

type PairReply = { ok?: boolean; outcome?: 'paired' | 'denied' | 'rejected' | 'gone'; pinned?: 'unknown' | 'none' | 'self' | 'other' } | undefined

function PairPage({ port, client, keyHash }: { port: number; client: string; keyHash: string }): React.JSX.Element {
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<'rejected-other' | 'rejected' | 'gone' | undefined>(undefined)
  const deny = () => {
    try { void Promise.resolve(chrome.runtime.sendMessage({ type: PAIR_DECISION_MSG, port, allow: false, keyHash })).catch(() => {}) } catch { /* ignore */ }
  }
  const allow = async () => {
    setBusy(true)
    try {
      const reply = (await chrome.runtime.sendMessage({ type: PAIR_DECISION_MSG, port, allow: true, keyHash })) as PairReply
      if (reply?.outcome === 'rejected') setResult(reply.pinned === 'other' ? 'rejected-other' : 'rejected')
      else if (reply?.outcome === 'gone') setResult('gone')
    } catch {
      setResult('gone')
    }
  }
  const fp = keyHash.slice(0, 4).toUpperCase() + '-' + keyHash.slice(4, 8).toUpperCase()
  return (
    <PairDialog
      client={client}
      fingerprint={fp}
      busy={busy && !result}
      result={result}
      onAllow={() => void allow()}
      onDeny={deny}
      onClose={() => window.close()}
    />
  )
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

onMathLoaded(() => { void import('katex/dist/katex.min.css') })

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  const pair = pairParams()
  const welcome = new URLSearchParams(window.location.search).get('welcome') === '1'
  const whatsnew = new URLSearchParams(window.location.search).get('whatsnew') === '1'
  const tree = (
    <React.StrictMode>
      <LocaleRoot>
        {welcome ? (
          <WelcomeRoute />
        ) : whatsnew ? (
          <WhatsNewRoute />
        ) : pair === 'invalid' ? (
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
  if (welcome || whatsnew || pair) {
    root.render(tree)
  } else {
    void (async () => {
      const ctrl = new AbortController()
      const redirected = await Promise.race([
        maybeRedirectToWhatsNew(ctrl.signal),
        new Promise<boolean>((r) => setTimeout(() => { ctrl.abort(); r(false) }, 300)),
      ])
      if (!redirected) root.render(tree)
    })()
  }
}
