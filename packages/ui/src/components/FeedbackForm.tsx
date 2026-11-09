import { useRef, useState } from 'react'
import { useT } from '../i18n'

export interface FeedbackDraft {
  kind: 'bug' | 'idea'
  message: string
  email: string
}

export interface FeedbackFormProps {
  diagnostics: { version: string; browser: string; locale: string }
  onSubmit(d: FeedbackDraft): Promise<'sent' | 'failed'>
  fallbackMailto(d: FeedbackDraft): string
}

export function FeedbackForm({ diagnostics, onSubmit, fallbackMailto }: FeedbackFormProps): React.JSX.Element {
  const t = useT()
  const [kind, setKind] = useState<'bug' | 'idea'>('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<'sent' | 'failed' | null>(null)
  const [failedDraft, setFailedDraft] = useState<FeedbackDraft | null>(null)
  const busy = useRef(false)

  const emailTrim = email.trim()
  const invalid = message.trim() === '' || (emailTrim !== '' && !emailTrim.includes('@'))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current || invalid) return
    busy.current = true
    setSending(true)
    setResult(null)
    const draft: FeedbackDraft = { kind, message: message.trim(), email: emailTrim }
    let r: 'sent' | 'failed'
    try {
      r = await onSubmit(draft)
    } catch {
      r = 'failed'
    }
    busy.current = false
    setSending(false)
    setResult(r)
    if (r === 'sent') {
      setMessage('')
      setEmail('')
      setFailedDraft(null)
    } else {
      setFailedDraft(draft)
    }
  }

  return (
    <form className="feedback-form" onSubmit={submit}>
      <fieldset>
        <legend>{t('feedback.kind.legend')}</legend>
        <label>
          <input type="radio" name="kind" value="bug" checked={kind === 'bug'} onChange={() => setKind('bug')} />
          {t('feedback.kind.bug')}
        </label>
        <label>
          <input type="radio" name="kind" value="idea" checked={kind === 'idea'} onChange={() => setKind('idea')} />
          {t('feedback.kind.idea')}
        </label>
      </fieldset>
      <label>
        {t('feedback.message')}
        <textarea value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <label>
        {t('feedback.email')}
        <input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <div className="feedback-attached">
        <p>{t('feedback.attached', diagnostics)}</p>
        <p>{t('feedback.noContent')}</p>
      </div>
      <button type="submit" disabled={invalid || sending}>
        {t('feedback.submit')}
      </button>
      {result === 'sent' && <p role="status">{t('feedback.sent')}</p>}
      {result === 'failed' && failedDraft && (
        <p role="alert">
          {t('feedback.failed')} <a href={fallbackMailto(failedDraft)}>{t('feedback.mailto')}</a>
        </p>
      )}
    </form>
  )
}
