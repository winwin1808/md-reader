import { useCallback, useEffect, useState } from 'react'
import type { SettingsLifecycleProps } from '@md-reader/ui'
import { LIFECYCLE_KEY, parseLifecycleState, compareVersions } from '../../worker/lifecycle'
import type { LifecycleState } from '../../worker/lifecycle'
import { RELEASE_NOTES } from '../../shared/release-notes'
import type { ReleaseNote } from '../../shared/release-notes'

export function hasUnseenNotes(lastSeen: string | null, notes: readonly ReleaseNote[], current: string): boolean {
  if (lastSeen === null) return false
  return notes.some((n) => compareVersions(n.version, current) <= 0 && compareVersions(n.version, lastSeen) > 0)
}

function currentVersion(): string {
  return chrome.runtime?.getManifest?.().version ?? '0.0.0'
}

async function readState(): Promise<LifecycleState> {
  const r = (await chrome.storage?.local?.get(LIFECYCLE_KEY)) as Record<string, unknown> | undefined
  return parseLifecycleState(r?.[LIFECYCLE_KEY])
}

export function useLifecycleSettings(): SettingsLifecycleProps {
  const [state, setState] = useState<LifecycleState>(() => parseLifecycleState(undefined))
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    readState().then(
      (s) => { if (alive) { setState(s); setLoaded(true) } },
      (e) => { console.warn('lifecycle read failed', e) },
    )
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !changes[LIFECYCLE_KEY]) return
      setState(parseLifecycleState(changes[LIFECYCLE_KEY].newValue))
      setLoaded(true)
    }
    chrome.storage?.onChanged?.addListener(onChanged)
    return () => {
      alive = false
      chrome.storage?.onChanged?.removeListener(onChanged)
    }
  }, [])

  const onAutoOpenWhatsNewChange = useCallback(async (v: boolean) => {
    try {
      const cur = await readState()
      const next = { ...cur, autoOpenWhatsNew: v }
      await chrome.storage?.local?.set({ [LIFECYCLE_KEY]: next })
      setState(next)
    } catch (e) {
      console.warn('lifecycle write failed', e)
    }
  }, [])

  const onOpenWhatsNew = useCallback(() => {
    const cur = currentVersion()
    const newest = RELEASE_NOTES.map((n) => n.version)
      .filter((v) => compareVersions(v, cur) <= 0)
      .sort(compareVersions)
      .pop()
    const q = 'app.html?whatsnew=1' + (newest ? '&v=' + encodeURIComponent(newest) : '')
    chrome.tabs?.create?.({ url: chrome.runtime.getURL(q) })
  }, [])

  return {
    autoOpenWhatsNew: state.autoOpenWhatsNew,
    hasUnseenNotes: loaded && hasUnseenNotes(state.lastSeenVersion, RELEASE_NOTES, currentVersion()),
    onAutoOpenWhatsNewChange,
    onOpenWhatsNew,
  }
}
