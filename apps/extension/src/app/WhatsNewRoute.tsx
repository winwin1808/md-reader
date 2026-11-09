import React, { useEffect } from 'react'
import { useLocale } from '@md-reader/ui'
import { WhatsNewPage } from './WhatsNewPage'
import { RELEASE_NOTES } from '../shared/release-notes'
import {
  LIFECYCLE_KEY,
  parseLifecycleState,
  markWhatsNewSeen,
  shouldRedirectToWhatsNew,
  compareVersions,
  type LifecycleState,
} from '../worker/lifecycle'
import './welcome.css'

async function readState(): Promise<LifecycleState> {
  const raw = await chrome.storage?.local?.get(LIFECYCLE_KEY)
  return parseLifecycleState((raw as Record<string, unknown> | undefined)?.[LIFECYCLE_KEY])
}

function newestVersion(): string | null {
  let best: string | null = null
  for (const n of RELEASE_NOTES) if (best === null || compareVersions(n.version, best) > 0) best = n.version
  return best
}

export function WhatsNewRoute(): React.JSX.Element {
  const loc = useLocale()
  const locale: 'vi' | 'en' = String(loc).startsWith('vi') ? 'vi' : 'en'
  const highlight = new URLSearchParams(window.location.search).get('v')

  useEffect(() => {
    void (async () => {
      try {
        const version = highlight ?? newestVersion()
        if (version === null) return
        const s = await readState()
        await chrome.storage?.local?.set({ [LIFECYCLE_KEY]: markWhatsNewSeen(s, version) })
      } catch (e) {
        console.warn('whatsnew: mark seen failed', e)
      }
    })()
  }, [highlight])

  return (
    <WhatsNewPage
      notes={RELEASE_NOTES}
      locale={locale}
      highlight={highlight}
      onDone={() => window.location.assign('app.html')}
    />
  )
}

export async function maybeRedirectToWhatsNew(): Promise<boolean> {
  try {
    const s = await readState()
    const url = shouldRedirectToWhatsNew(window.location.search, s)
    if (!url) return false
    window.location.replace(url)
    return true
  } catch {
    return false
  }
}
