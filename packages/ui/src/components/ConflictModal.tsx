import React, { useEffect, useId, useMemo, useRef } from 'react'
import { computeLineDiff } from '@md-reader/core'
import { Icon } from './Icon'
import '../theme/conflict.css'

export interface ConflictModalProps {
  isOpen: boolean
  fileName: string
  localContent: string
  diskContent: string
  baseContent?: string
  onKeepLocal: () => void
  onRevertToDisk: () => void
  onClose: () => void
}

export interface SideBySideDiffLine {
  num: number | null
  text: string
  type: 'same' | 'added' | 'removed' | 'empty'
}

export function computeSideBySideDiff(diskText: string, localText: string): {
  localDiff: SideBySideDiffLine[]
  diskDiff: SideBySideDiffLine[]
} {
  const diffs = computeLineDiff(diskText, localText)
  const localDiff: SideBySideDiffLine[] = []
  const diskDiff: SideBySideDiffLine[] = []

  let diskNum = 1
  let localNum = 1

  for (const item of diffs) {
    if (item.type === 'same') {
      diskDiff.push({ num: diskNum++, text: item.text, type: 'same' })
      localDiff.push({ num: localNum++, text: item.text, type: 'same' })
    } else if (item.type === 'removed') {
      diskDiff.push({ num: diskNum++, text: item.text, type: 'removed' })
      localDiff.push({ num: null, text: '', type: 'empty' })
    } else if (item.type === 'added') {
      diskDiff.push({ num: null, text: '', type: 'empty' })
      localDiff.push({ num: localNum++, text: item.text, type: 'added' })
    }
  }

  return { localDiff, diskDiff }
}

export function ConflictModal({
  isOpen,
  fileName,
  localContent,
  diskContent,
  baseContent,
  onKeepLocal,
  onRevertToDisk,
  onClose,
}: ConflictModalProps): React.JSX.Element | null {
  const titleId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    const prev = document.activeElement as HTMLElement | null
    containerRef.current?.querySelector<HTMLElement>('.conflict-btn-later')?.focus()
    return () => {
      if (prev && prev.isConnected) prev.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen])

  const handleTrap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []
    )
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    const active = document.activeElement
    if (e.shiftKey && (active === first || !containerRef.current?.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !containerRef.current?.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  const { localDiff, diskDiff } = useMemo(
    () => computeSideBySideDiff(diskContent, localContent),
    [diskContent, localContent]
  )

  const threeWay = useMemo(() => {
    if (baseContent === undefined) return null
    return {
      disk: computeLineDiff(baseContent, diskContent),
      mine: computeLineDiff(baseContent, localContent),
    }
  }, [baseContent, diskContent, localContent])

  if (!isOpen) return null

  const marker = (type: string) => (type === 'added' ? '+' : type === 'removed' ? '\u2212' : ' ')

  const renderPane = (
    key: string,
    title: string,
    lines: { num?: number | null; text: string; type: string }[],
    counts?: { added: number; removed: number }
  ) => (
    <section className="conflict-pane" aria-labelledby={`${titleId}-${key}`}>
      <div className="conflict-pane-header">
        <h3 id={`${titleId}-${key}`}>{title}</h3>
        {counts && (
          <span
            className="conflict-diff-counts"
            role="img"
            aria-label={`${counts.added} dòng thêm, ${counts.removed} dòng bỏ`}
          >{`+${counts.added} \u2212${counts.removed}`}</span>
        )}
      </div>
      <div className="conflict-diff-content">
        {lines.map((line, idx) => (
          <div key={idx} className={`conflict-diff-line ${line.type}`}>
            <span className="conflict-diff-marker" aria-hidden="true">{marker(line.type)}</span>
            {line.type === 'added' && <span className="conflict-sr">thêm</span>}
            {line.type === 'removed' && <span className="conflict-sr">bỏ</span>}
            {line.num !== undefined && (
              <span className="conflict-diff-line-number">{line.num !== null ? line.num : ''}</span>
            )}
            <span className="conflict-diff-line-text">{line.text || ' '}</span>
          </div>
        ))}
      </div>
    </section>
  )

  const renderUnified = (key: string, title: string, diff: ReturnType<typeof computeLineDiff>) =>
    renderPane(key, title, diff, {
      added: diff.filter((d) => d.type === 'added').length,
      removed: diff.filter((d) => d.type === 'removed').length,
    })

  return (
    <div className="conflict-modal-overlay" role="dialog" aria-modal="true" aria-labelledby={`${titleId}-title`}>
      <div className="conflict-modal-container" ref={containerRef} onKeyDown={handleTrap}>
        <div className="conflict-modal-header">
          <div className="conflict-modal-heading">
            <h2 id={`${titleId}-title`}>Tài liệu đã đổi ở hai nơi</h2>
            <p className="conflict-modal-hint">
              Bản trên đĩa khác với lần bạn mở. Chọn bản muốn giữ — không có gì bị ghi cho tới khi bạn chọn.
            </p>
            <span className="conflict-modal-filename">{fileName}</span>
          </div>
          <button type="button" className="conflict-modal-close" aria-label="Đóng" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <div className="conflict-modal-body">
          {threeWay ? (
            <>
              {renderUnified('disk', 'Bản trên đĩa', threeWay.disk)}
              {renderUnified('mine', 'Bản của bạn', threeWay.mine)}
              {renderPane(
                'base',
                'Bản gốc chung',
                (baseContent ?? '').split('\n').map((text) => ({ text, type: 'same' }))
              )}
            </>
          ) : (
            <>
              {renderPane('disk', 'Bản trên đĩa', diskDiff)}
              {renderPane('mine', 'Bản của bạn', localDiff)}
            </>
          )}
        </div>

        <div className="conflict-modal-footer">
          <button type="button" className="conflict-btn conflict-btn-later" onClick={onClose}>
            Để sau
          </button>
          <button type="button" className="conflict-btn conflict-btn-revert" onClick={onRevertToDisk}>
            Lấy bản trên đĩa
          </button>
          <button type="button" className="conflict-btn conflict-btn-keep" onClick={onKeepLocal}>
            Giữ bản của tôi và ghi đè
          </button>
        </div>
      </div>
    </div>
  )
}
