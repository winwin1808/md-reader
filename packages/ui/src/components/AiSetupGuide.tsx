import React, { useEffect, useRef, useState } from 'react'
import { MCP_PACKAGE_SPEC } from '@md-reader/core'
import { useT } from '../i18n'

export type AiClientKind = 'claudeCode' | 'claudeDesktop' | 'cursor'

const KINDS: { kind: AiClientKind; label: string }[] = [
  { kind: 'claudeCode', label: 'Claude Code' },
  { kind: 'claudeDesktop', label: 'Claude Desktop' },
  { kind: 'cursor', label: 'Cursor' },
]

export function mcpSetupSnippet(kind: AiClientKind): string {
  if (kind === 'claudeCode') return `claude mcp add md-reader -- npx -y ${MCP_PACKAGE_SPEC}`
  return JSON.stringify(
    { mcpServers: { 'md-reader': { command: 'npx', args: ['-y', MCP_PACKAGE_SPEC] } } },
    null,
    2,
  )
}

export interface AiSetupGuideProps {
  hasClients: boolean
}

export function AiSetupGuide({ hasClients }: AiSetupGuideProps) {
  const t = useT()
  const [open, setOpen] = useState(!hasClients)
  const [kind, setKind] = useState<AiClientKind>('claudeCode')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const select = (k: AiClientKind) => {
    if (timer.current) clearTimeout(timer.current)
    setCopyState('idle')
    setKind(k)
  }

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = KINDS[(idx + (e.key === 'ArrowRight' ? 1 : KINDS.length - 1)) % KINDS.length]!
    select(next.kind)
    tabRefs.current[next.kind]?.focus()
  }

  const copy = () => {
    const snippet = mcpSetupSnippet(kind)
    const fail = () => setCopyState('failed')
    if (!navigator.clipboard?.writeText) return fail()
    navigator.clipboard.writeText(snippet).then(() => {
      setCopyState('copied')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopyState('idle'), 2000)
    }, fail)
  }

  return (
    <details className="ai-guide" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('settings.ai.guide.title')}</summary>
      <ol>
        <li>
          {t('settings.ai.guide.step1')}
          <div role="tablist" aria-label={t('settings.ai.guide.tabs')} className="ai-guide-tabs">
            {KINDS.map((k, i) => (
              <button
                key={k.kind}
                ref={(el) => { tabRefs.current[k.kind] = el }}
                type="button"
                role="tab"
                className="ai-guide-tab"
                id={`ai-guide-tab-${k.kind}`}
                aria-selected={kind === k.kind}
                aria-controls="ai-guide-panel"
                tabIndex={kind === k.kind ? 0 : -1}
                onClick={() => select(k.kind)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="ai-guide-panel" aria-labelledby={`ai-guide-tab-${kind}`}>
            <p>{t(`settings.ai.guide.where.${kind}` as Parameters<typeof t>[0])}</p>
            <pre className="ai-guide-code"><code>{mcpSetupSnippet(kind)}</code></pre>
            <button type="button" className="settings-btn" onClick={copy}>
              {copyState === 'copied' ? t('settings.ai.guide.copied') : t('common.copy')}
            </button>
            {copyState === 'failed' && <p role="status">{t('settings.ai.guide.copyFailed')}</p>}
          </div>
          <p>{t('settings.ai.guide.node')}</p>
        </li>
        <li>{t('settings.ai.guide.step2')}</li>
        <li>
          {t('settings.ai.guide.step3')}
          <ul>
            <li>{t('settings.ai.guide.ex1')}</li>
            <li>{t('settings.ai.guide.ex2')}</li>
            <li>{t('settings.ai.guide.ex3')}</li>
            <li>{t('settings.ai.guide.ex4')}</li>
          </ul>
          <a href={t('settings.ai.guide.moreHref')} target="_blank" rel="noopener noreferrer">
            {t('settings.ai.guide.more')}
          </a>
        </li>
      </ol>
    </details>
  )
}
