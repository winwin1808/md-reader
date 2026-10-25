import React, { useEffect, useState } from 'react'
import { useT } from '@md-reader/ui'

export function FileAccessHint({ fileUrl, failed }: { fileUrl?: string | null; failed?: boolean }) {
  const t = useT()
  const isFile = !!fileUrl && fileUrl.startsWith('file:')
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!isFile) return
    try {
      chrome.extension?.isAllowedFileSchemeAccess?.((ok: boolean) => setDenied(!ok))
    } catch {
      /* ignore */
    }
  }, [isFile])

  if (!isFile || !(denied || failed)) return null
  return (
    <div className="notice" role="status">
      <span>{t('ext.fileAccess.hint')}</span>
      <div className="notice__actions">
        <button
          type="button"
          onClick={() => { chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id }) }}
        >
          {t('ext.fileAccess.open')}
        </button>
      </div>
    </div>
  )
}
