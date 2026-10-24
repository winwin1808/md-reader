import { useCallback, useEffect, useState } from 'react'
import * as Y from 'yjs'
import { getHistory, listHistory, textAtCheckpoint, restoreCheckpoint } from '@md-reader/core'
import type { HistoryEntry, CheckpointTracker } from '@md-reader/core'

function readActors(doc: Y.Doc | null): Record<string, string> {
  if (!doc) return {}
  const a = doc.getMap('meta').get('actors') as unknown
  if (a instanceof Y.Map) return Object.fromEntries(a.entries()) as Record<string, string>
  if (a && typeof a === 'object') return { ...(a as Record<string, string>) }
  return {}
}

export function useHistory(doc: Y.Doc | null, tracker: CheckpointTracker | null, actor: string): {
  entries: HistoryEntry[]; actors: Record<string, string>
  previewId: string | null; previewText: string | null
  preview(id: string | null): void; restore(id: string): boolean
} {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => (doc ? listHistory(doc) : []))
  const [actors, setActors] = useState<Record<string, string>>(() => readActors(doc))
  const [prev, setPrev] = useState<{ id: string | null; text: string | null }>({ id: null, text: null })

  useEffect(() => {
    setPrev({ id: null, text: null })
    if (!doc) { setEntries([]); setActors({}); return }
    const hist = getHistory(doc)
    const meta = doc.getMap('meta')
    const onHist = () => setEntries(listHistory(doc))
    const onMeta = () => setActors(readActors(doc))
    onHist(); onMeta()
    hist.observe(onHist)
    meta.observeDeep(onMeta)
    return () => { hist.unobserve(onHist); meta.unobserveDeep(onMeta) }
  }, [doc])

  const preview = useCallback((id: string | null) => {
    if (!doc || id === null) { setPrev({ id: null, text: null }); return }
    const entry = listHistory(doc).find((e) => e.id === id)
    const text = entry ? textAtCheckpoint(doc, entry) : null
    setPrev(text === null ? { id: null, text: null } : { id, text })
  }, [doc])

  const restore = useCallback((id: string): boolean => {
    if (!doc) return false
    const entry = listHistory(doc).find((e) => e.id === id)
    if (!entry) return false
    const ok = restoreCheckpoint(doc, entry, actor, tracker ?? undefined)
    setPrev({ id: null, text: null })
    return ok
  }, [doc, tracker, actor])

  return { entries, actors, previewId: prev.id, previewText: prev.text, preview, restore }
}
