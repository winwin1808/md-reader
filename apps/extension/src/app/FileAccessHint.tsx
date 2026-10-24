import React, { useEffect, useState } from 'react'

export function FileAccessHint({ fileUrl, failed }: { fileUrl?: string | null; failed?: boolean }) {
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
      <span>Để đọc file trên máy, bật “Cho phép truy cập URL tệp” cho MD Reader trong chrome://extensions.</span>
      <div className="notice__actions">
        <button
          type="button"
          onClick={() => { chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id }) }}
        >
          Mở cài đặt extension
        </button>
      </div>
    </div>
  )
}
