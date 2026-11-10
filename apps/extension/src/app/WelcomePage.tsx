import React from 'react'
import { Logo, useT } from '@md-reader/ui'

export interface WelcomeStatus { pinned: boolean | null; fileAccess: boolean; openedFile: boolean; aiConnected: boolean }

export function WelcomePage(props: {
  status: WelcomeStatus
  onOpenSample(): void
  onOpenFileSettings(): void
  onDone(): void
}): React.JSX.Element {
  const t = useT()
  const { status } = props
  const steps: { key: string; done: boolean; label: string; action?: React.JSX.Element }[] = []
  if (status.pinned !== null) steps.push({ key: 'pin', done: status.pinned, label: t('ext.welcome.step.pin') })
  steps.push({
    key: 'file', done: status.fileAccess, label: t('ext.welcome.step.fileAccess'),
    action: !status.fileAccess ? (
      <button type="button" onClick={props.onOpenFileSettings}>{t('ext.fileAccess.open')}</button>
    ) : undefined,
  })
  steps.push({ key: 'open', done: status.openedFile, label: t('ext.welcome.step.openFile') })
  steps.push({ key: 'ai', done: status.aiConnected, label: t('ext.welcome.step.ai') })
  const total = steps.length
  const done = steps.filter((s) => s.done).length
  const pct = Math.round((done / total) * 100)
  const notes = [
    ['read', t('ext.welcome.note.read')],
    ['edit', t('ext.welcome.note.edit')],
    ['present', t('ext.welcome.note.present')],
    ['share', t('ext.welcome.note.share')],
  ] as const
  return (
    <main className="welcome">
      <header className="welcome-brand"><Logo size={28} /><span>MD Reader</span></header>
      <div className="welcome-hero">
        <div className="welcome-intro">
          <h1>{t('ext.welcome.title')}</h1>
          <p className="welcome-lead">{t('ext.welcome.lead')}</p>
          <div className="welcome-cta">
            <button type="button" className="welcome-primary" onClick={props.onOpenSample}>{t('ext.welcome.openSample')}</button>
            <button type="button" className="welcome-secondary" onClick={props.onDone}>{t('ext.welcome.enter')}</button>
          </div>
          <p className="welcome-hint">{t('ext.welcome.sampleHint')}</p>
        </div>
        <figure className="welcome-figure" aria-hidden="true">
          <div className="welcome-sheets">
            <div className="welcome-sheet-under" /><div className="welcome-sheet-under" />
            <div className="welcome-sheet">
              <h3>{t('ext.welcome.sheet.title')}</h3>
              <p>{t('ext.welcome.sheet.para')}</p>
              <ol>
                <li>{t('ext.welcome.sheet.item1')}</li>
                <li>{t('ext.welcome.sheet.item2')}</li>
                <li>{t('ext.welcome.sheet.item3')}</li>
              </ol>
              <pre><code>pnpm build</code></pre>
            </div>
          </div>
          <ul className="welcome-notes">
            {notes.map(([k, text], i) => (
              <li key={k} className="welcome-note" style={{ '--i': i } as React.CSSProperties}>{text}</li>
            ))}
          </ul>
        </figure>
      </div>
      <section className="welcome-setup" aria-labelledby="welcome-checklist">
        <div className="welcome-setup-head">
          <h2 id="welcome-checklist">{t('ext.welcome.checklist')}</h2>
          <p className="welcome-progress">{t('ext.welcome.progress', { done, total })}</p>
        </div>
        <div className="welcome-meter" role="progressbar" aria-label={t('ext.welcome.checklist')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <ol>
          {steps.map((s, i) => (
            <li key={s.key} data-done={String(s.done)}>
              <span className="welcome-step-mark" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
              <span className="welcome-step-label">{s.label}</span>
              <span className="welcome-step-state">{s.done ? t('ext.welcome.stepDone') : t('ext.welcome.stepTodo')}</span>
              {s.action}
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
