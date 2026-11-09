import { useT } from '../i18n'

export function ReviewPrompt(props: { onRate(): void; onDismiss(): void }): React.JSX.Element {
  const t = useT()
  return (
    <aside
      className="review-prompt"
      aria-label={t('review.label')}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--rule)',
        color: 'var(--ink)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'fixed',
        insetInlineEnd: 16,
        bottom: 16,
        maxWidth: 360,
        zIndex: 500,
      }}
    >
      <span>{t('review.text')}</span>
      <button type="button" onClick={props.onRate}>{t('review.rate')}</button>
      <button type="button" onClick={props.onDismiss}>{t('review.dismiss')}</button>
    </aside>
  )
}
