import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SettingsBackupProps } from '@md-reader/ui'
import { listRecent, docQuery } from '../doc-registry'
import { buildBackup } from '../backup'

export function backupFileName(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `md-reader-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.zip`
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.download = name
  a.href = url
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function useBackupSettings(active: boolean): SettingsBackupProps {
  const [sharedDocs, setSharedDocs] = useState<SettingsBackupProps['sharedDocs']>([])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    listRecent(Number.POSITIVE_INFINITY)
      .then((recs) => {
        if (!cancelled) setSharedDocs(recs.filter((r) => r.room).map((r) => ({ docId: r.docId, title: r.title })))
      })
      .catch((e) => {
        console.warn('[backup] cannot list shared docs', e)
        if (!cancelled) setSharedDocs([])
      })
    return () => { cancelled = true }
  }, [active])

  const onBackupAll = useCallback(async () => {
    const recs = await listRecent(Number.POSITIVE_INFINITY)
    const { blob, included, failed } = await buildBackup(recs)
    downloadBlob(blob, backupFileName(new Date()))
    return { included, failed: failed.length }
  }, [])

  const onOpenSharedDoc = useCallback(async (docId: string) => {
    try {
      window.location.assign(await docQuery(docId))
    } catch (e) {
      console.warn('[backup] cannot open shared doc', e)
    }
  }, [])

  return useMemo(() => ({ onBackupAll, sharedDocs, onOpenSharedDoc }), [onBackupAll, sharedDocs, onOpenSharedDoc])
}
