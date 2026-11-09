import React, { useEffect, useRef } from 'react'
import { useLocale } from '@md-reader/ui'
import { WhatsNewPage } from './WhatsNewPage'
import { RELEASE_NOTES, type ReleaseNote } from '../shared/release-notes'
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

export const WHATSNEW_SHOWN_KEY = 'mdr:whatsnew-shown'

function currentVersion(): string {
  try {
    return chrome.runtime?.getManifest?.().version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function resolveSeenVersion(v: string | null, notes: readonly ReleaseNote[], current: string): string | null {
  if (v !== null && notes.some((n) => n.version === v) && compareVersions(v, current) <= 0) return v
  let best: string | null = null
  for (const n of notes) {
    if (!n.showOnUpdate || compareVersions(n.version, current) > 0) continue
    if (best === null || compareVersions(n.version, best) > 0) best = n.version
  }
  return best
}

function markSeen(highlight: string | null): Promise<void> {
  return (async () => {
    try {
      const version = resolveSeenVersion(highlight, RELEASE_NOTES, currentVersion())
      if (version === null) return
      const s = await readState()
      await chrome.storage?.local?.set({ [LIFECYCLE_KEY]: markWhatsNewSeen(s, version) })
    } catch (e) {
      console.warn('whatsnew: mark seen failed', e)
    }
  })()
}

export function WhatsNewRoute(): React.JSX.Element {
  const loc = useLocale()
  const locale: 'vi' | 'en' = String(loc).startsWith('vi') ? 'vi' : 'en'
  const highlight = new URLSearchParams(window.location.search).get('v')
  const marked = useRef<Promise<void> | null>(null)

  useEffect(() => {
    try { sessionStorage.setItem(WHATSNEW_SHOWN_KEY, '1') } catch { /* ignore */ }
    marked.current = markSeen(highlight)
  }, [highlight])

  const onDone = (): void => {
    const done = marked.current ?? Promise.resolve()
    void Promise.race([done, new Promise<void>((r) => setTimeout(r, 1000))]).then(() => window.location.assign('app.html'))
  }

  return <WhatsNewPage notes={RELEASE_NOTES} locale={locale} highlight={highlight} onDone={onDone} />
}

const NO_REDIRECT_PARAMS = ['doc', 'd', 'file', 'speaker', 'welcome', 'whatsnew', 'pair']

export async function maybeRedirectToWhatsNew(signal?: AbortSignal): Promise<boolean> {
  try {
    const q = new URLSearchParams(window.location.search)
    if (NO_REDIRECT_PARAMS.some((k) => q.has(k))) return false
    try { if (sessionStorage.getItem(WHATSNEW_SHOWN_KEY)) return false } catch { /* ignore */ }
    const s = await readState()
    const url = shouldRedirectToWhatsNew(window.location.search, s)
    if (!url) return false
    if (signal?.aborted) return false
    window.location.replace(url)
    return true
  } catch {
    return false
  }
}
