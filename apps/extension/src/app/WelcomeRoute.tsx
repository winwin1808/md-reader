import React, { useEffect, useState } from 'react'
import { useLocale } from '@md-reader/ui'
import { WelcomePage, type WelcomeStatus } from './WelcomePage'
import { WELCOME_ORIGIN, welcomeMarkdown } from './welcome-doc'
import { findOrCreateByOrigin, writeDocText, docQuery, listRecent } from './doc-registry'
import { useBridgeSettings } from './hooks/useBridgeSettings'
import './welcome.css'

async function readPinned(): Promise<boolean | null> {
  try {
    const s = await chrome.action?.getUserSettings?.()
    return typeof s?.isOnToolbar === 'boolean' ? s.isOnToolbar : null
  } catch { return null }
}

function readFileAccess(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const fn = chrome.extension?.isAllowedFileSchemeAccess
      if (!fn) return resolve(false)
      fn((ok: boolean) => resolve(!!ok))
    } catch { resolve(false) }
  })
}

async function readOpenedFile(): Promise<boolean> {
  try {
    const recent = await listRecent(50)
    return recent.some((r) => !String(r.originPath).startsWith('mdr://welcome/'))
  } catch { return false }
}

export function WelcomeRoute(): React.JSX.Element {
  const loc = useLocale()
  const locale: 'vi' | 'en' = String(loc).startsWith('vi') ? 'vi' : 'en'
  const { clients } = useBridgeSettings()
  const [base, setBase] = useState<Omit<WelcomeStatus, 'aiConnected'>>({ pinned: null, fileAccess: false, openedFile: false })

  useEffect(() => {
    let alive = true
    void Promise.all([readPinned(), readFileAccess(), readOpenedFile()]).then(([pinned, fileAccess, openedFile]) => {
      if (alive) setBase({ pinned, fileAccess, openedFile })
    })
    return () => { alive = false }
  }, [])

  const onOpenSample = async (): Promise<void> => {
    try {
      const rec = await findOrCreateByOrigin({
        title: locale === 'vi' ? 'Chào mừng đến MD Reader' : 'Welcome to MD Reader',
        originKind: 'drop',
        originPath: WELCOME_ORIGIN[locale],
      })
      await writeDocText(rec, welcomeMarkdown(locale), 'if-clean')
      window.location.assign('app.html' + (await docQuery(rec.docId)) + '&tour=1')
    } catch (e) {
      console.warn('welcome: open sample failed', e)
    }
  }

  return (
    <WelcomePage
      status={{ ...base, aiConnected: clients.length > 0 }}
      onOpenSample={() => { void onOpenSample() }}
      onOpenFileSettings={() => { void chrome.tabs?.create?.({ url: 'chrome://extensions/?id=' + chrome.runtime?.id }) }}
      onDone={() => window.location.assign('app.html')}
    />
  )
}
