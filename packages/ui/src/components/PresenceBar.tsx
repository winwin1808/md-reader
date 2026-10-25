import type { CSSProperties } from 'react'
import { useT, useLocale } from '../i18n'

export interface Peer { clientId: number; name: string; color: string; isSelf: boolean }

export function peerColor(clientId: number): string {
  const n = (Math.abs(Math.trunc(clientId)) % 6) + 1
  return `var(--peer-${n})`
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (words.length === 0) return '?'
  return words.map((w) => Array.from(w)[0]!.toUpperCase()).join('')
}

export function PresenceBar({ peers, max = 5 }: { peers: Peer[]; max?: number }) {
  const t = useT()
  const locale = useLocale()
  if (peers.length === 0) return null
  const sorted = [...peers].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1
    return a.name.localeCompare(b.name, locale) || a.clientId - b.clientId
  })
  const shown = sorted.slice(0, max)
  const hidden = sorted.slice(max)
  return (
    <div className="presence-bar" role="group" aria-label={t('presence.inRoom', { count: peers.length })}>
      {shown.map((p) => {
        const label = p.isSelf ? t('presence.you', { name: p.name }) : p.name
        return (
          <span
            key={p.clientId}
            className="presence-avatar"
            style={{ '--peer': p.color } as CSSProperties}
            title={label}
            aria-label={label}
          >
            {initials(p.name)}
          </span>
        )
      })}
      {hidden.length > 0 && (
        <span className="presence-avatar presence-more" title={hidden.map((p) => p.name).join(', ')}>
          +{hidden.length}
        </span>
      )}
    </div>
  )
}
