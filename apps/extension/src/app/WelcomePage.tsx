import React from 'react'
import { useT } from '@md-reader/ui'

export interface WelcomeStatus { pinned: boolean | null; fileAccess: boolean; openedFile: boolean; aiConnected: boolean }

export function WelcomePage(props: {
  status: WelcomeStatus
  onOpenSample(): void
  onOpenFileSettings(): void
  onDone(): void
}): React.JSX.Element {
  const t = useT()
  const { status } = props
  const state = (done: boolean) => (
    <span>{done ? t('ext.welcome.stepDone') : t('ext.welcome.stepTodo')}</span>
  )
  return (
    <main className="welcome">
      <h1>{t('ext.welcome.title')}</h1>
      <p>{t('ext.welcome.lead')}</p>
      <button type="button" className="welcome-primary" onClick={props.onOpenSample}>
        {t('ext.welcome.openSample')}
      </button>
      <section aria-labelledby="welcome-checklist">
        <h2 id="welcome-checklist">{t('ext.welcome.checklist')}</h2>
        <ol>
          {status.pinned !== null && (
            <li data-done={String(status.pinned)}>
              <span>{t('ext.welcome.step.pin')}</span> {state(status.pinned)}
            </li>
          )}
          <li data-done={String(status.fileAccess)}>
            <span>{t('ext.welcome.step.fileAccess')}</span> {state(status.fileAccess)}
            {!status.fileAccess && (
              <button type="button" onClick={props.onOpenFileSettings}>{t('ext.fileAccess.open')}</button>
            )}
          </li>
          <li data-done={String(status.openedFile)}>
            <span>{t('ext.welcome.step.openFile')}</span> {state(status.openedFile)}
          </li>
          <li data-done={String(status.aiConnected)}>
            <span>{t('ext.welcome.step.ai')}</span> {state(status.aiConnected)}
          </li>
        </ol>
      </section>
      <button type="button" className="welcome-secondary" onClick={props.onDone}>
        {t('ext.welcome.enter')}
      </button>
    </main>
  )
}
