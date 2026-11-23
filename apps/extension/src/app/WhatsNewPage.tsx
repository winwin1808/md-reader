import React from 'react'
import { useT } from '@md-reader/ui'
import type { ReleaseNote } from '../shared/release-notes'
import { RELEASE_NOTES_URL } from './feedback-client'
import { compareVersions } from '../worker/lifecycle'

export function WhatsNewPage(props: {
  notes: readonly ReleaseNote[]
  locale: 'vi' | 'en'
  highlight: string | null
  onDone(): void
}): React.JSX.Element {
  const t = useT()
  const { locale, highlight } = props
  const sorted = [...props.notes].sort((a, b) => compareVersions(b.version, a.version))
  const hi = sorted.find((n) => n.version === highlight)
  const ordered = hi ? [hi, ...sorted.filter((n) => n !== hi)] : sorted
  const newest = sorted[0]?.version
  const fullNotesHref = newest ? `${RELEASE_NOTES_URL}#v${newest}` : RELEASE_NOTES_URL
  return (
    <main className="welcome whatsnew">
      <h1>{t('ext.whatsnew.title')}</h1>
      {ordered.length === 0 && <p>{t('ext.whatsnew.empty')}</p>}
      {ordered.map((n) => {
        const isHi = n === hi
        return (
          <section key={n.version} data-version={n.version} data-highlight={isHi ? 'true' : undefined}>
            <h2>{n.title[locale]}</h2>
            <p className="whatsnew-version">
              {isHi && <span className="whatsnew-badge">{t('ext.whatsnew.new')}</span>}{' '}
              {t('ext.whatsnew.version', { version: n.version })}
            </p>
            <ul>
              {n.items[locale].map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </section>
        )
      })}
      <p>
        <a href={fullNotesHref} target="_blank" rel="noopener noreferrer">
          {t('ext.whatsnew.fullNotes')}
        </a>
      </p>
      <button type="button" className="welcome-primary" onClick={props.onDone}>
        {t('ext.welcome.enter')}
      </button>
    </main>
  )
}
